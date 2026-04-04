import { ethers } from "ethers";
import { HAT_TOKEN_ABI, HAT_PER_USDC, CONTRACTS, ARC_TESTNET_RPC } from "@hat/common";
import type { Env } from "../types.js";
import * as db from "../db.js";
import { sendNanopayment } from "./gateway.js";

export interface SettlementResult {
  id: string;
  recipientCount: number;
  totalUsdc: number;
  totalHat: number;
  nanopaymentTxIds: string[];
  hatTxHash?: string;
}

export async function runSettlement(d1: D1Database, env: Env): Promise<SettlementResult> {
  const sessions = await db.getUnsettledSessions(d1);

  if (sessions.length === 0) {
    return { id: "", recipientCount: 0, totalUsdc: 0, totalHat: 0, nanopaymentTxIds: [] };
  }

  // Aggregate earnings per user
  const perUser = new Map<string, { usdc: number; hat: number; sessionIds: string[] }>();
  for (const s of sessions) {
    const addr = s.user_address as string;
    const existing = perUser.get(addr) || { usdc: 0, hat: 0, sessionIds: [] };
    existing.usdc += s.usdc_earned as number;
    // HAT derived from USDC earned (incentive layer)
    existing.hat += (s.usdc_earned as number) * HAT_PER_USDC;
    existing.sessionIds.push(s.id as string);
    perUser.set(addr, existing);
  }

  const settlementId = crypto.randomUUID();
  const nanopaymentTxIds: string[] = [];
  let hatTxHash: string | undefined;
  let totalUsdc = 0;
  let totalHat = 0;

  // ── Step 1: USDC nanopayments via Circle Gateway (gas-free) ──
  // Each verified viewer receives a nanopayment signed offchain and
  // settled in batches by Circle's Gateway infrastructure.
  if (env.GATEWAY_PRIVATE_KEY) {
    for (const [addr, data] of perUser) {
      if (data.usdc <= 0) continue;
      try {
        const result = await sendNanopayment(env, addr, data.usdc);
        if (result.success) {
          nanopaymentTxIds.push(result.transaction);
          console.log(`[settlement] Nanopayment to ${addr}: $${data.usdc} USDC (tx: ${result.transaction})`);
        }
      } catch (e) {
        console.error(`[settlement] Nanopayment failed for ${addr}:`, e);
      }
    }
  } else {
    console.log("[settlement] Skipping nanopayments (no GATEWAY_PRIVATE_KEY)");
  }

  // ── Step 2: HAT token bonus minting (on-chain) ──────────────
  // HAT is the incentive layer on top of USDC payments.
  // Amount = USDC earned * HAT_PER_USDC multiplier.
  const hasOnChain = !!env.DEPLOYER_PRIVATE_KEY && !!CONTRACTS.HAT_TOKEN;
  if (hasOnChain) {
    const allRecipients: string[] = [];
    const allAmounts: bigint[] = [];
    for (const [addr, data] of perUser) {
      allRecipients.push(addr);
      allAmounts.push(BigInt(Math.floor(data.hat * 1e18)));
    }
    if (allRecipients.length > 0) {
      const provider = new ethers.JsonRpcProvider(env.ARC_RPC_URL || ARC_TESTNET_RPC);
      const wallet = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
      const hat = new ethers.Contract(CONTRACTS.HAT_TOKEN, HAT_TOKEN_ABI, wallet);
      try {
        const tx = await hat.batchMint(allRecipients, allAmounts);
        const receipt = await tx.wait();
        hatTxHash = receipt.hash;
        console.log(`[settlement] HAT batchMint: ${allRecipients.length} recipients (tx: ${hatTxHash})`);
      } catch (e) {
        console.error("[settlement] HAT batchMint failed:", e);
      }
    }
  } else {
    console.log("[settlement] Skipping HAT mint (no deployer key or contract)");
  }

  // ── Step 3: Update DB ────────────────────────────────────────
  const recipients: string[] = [];
  for (const [addr, data] of perUser) {
    recipients.push(addr);
    totalUsdc += data.usdc;
    totalHat += data.hat;
  }

  for (const [addr, data] of perUser) {
    for (const sid of data.sessionIds) {
      await db.markSettled(d1, settlementId, sid);
    }
    await db.updateUserEarnings(d1, data.hat, data.usdc, addr);
    for (const s of sessions.filter((s) => s.user_address === addr)) {
      await db.updateAdSpend(d1, s.usdc_earned as number, s.ad_id as string);
    }
  }
  await db.insertSettlement(d1, settlementId, nanopaymentTxIds.join(",") || null, hatTxHash ?? null, totalUsdc, totalHat, recipients.length);

  return { id: settlementId, recipientCount: recipients.length, totalUsdc, totalHat, nanopaymentTxIds, hatTxHash };
}
