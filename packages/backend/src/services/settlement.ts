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
  clickRewardsUsdc: number;
  nanopaymentTxIds: string[];
  hatTxHash?: string;
}

export async function runSettlement(d1: D1Database, env: Env, requireVerified = true): Promise<SettlementResult> {
  const [sessions, clicks] = await Promise.all([
    db.getUnsettledSessions(d1, requireVerified),
    db.getUnsettledClicks(d1, requireVerified),
  ]);

  if (sessions.length === 0 && clicks.length === 0) {
    return { id: "", recipientCount: 0, totalUsdc: 0, totalHat: 0, clickRewardsUsdc: 0, nanopaymentTxIds: [] };
  }

  // Aggregate earnings per user (view time + click rewards)
  const perUser = new Map<string, { usdc: number; hat: number; sessionIds: string[]; clickIds: string[] }>();

  for (const s of sessions) {
    const addr = s.user_address as string;
    const existing = perUser.get(addr) || { usdc: 0, hat: 0, sessionIds: [], clickIds: [] };
    existing.usdc += s.usdc_earned as number;
    existing.hat += (s.usdc_earned as number) * HAT_PER_USDC;
    existing.sessionIds.push(s.id as string);
    perUser.set(addr, existing);
  }

  // Add click-through rewards
  let clickRewardsUsdc = 0;
  for (const click of clicks) {
    const addr = click.user_address as string;
    const existing = perUser.get(addr) || { usdc: 0, hat: 0, sessionIds: [], clickIds: [] };
    existing.usdc += click.usdc_reward as number;
    existing.hat += click.hat_reward as number;
    existing.clickIds.push(click.id as string);
    clickRewardsUsdc += click.usdc_reward as number;
    perUser.set(addr, existing);
  }

  const settlementId = crypto.randomUUID();
  const nanopaymentTxIds: string[] = [];
  let hatTxHash: string | undefined;
  let totalUsdc = 0;
  let totalHat = 0;

  // ── Step 1: USDC nanopayments via Circle Gateway (gas-free) ──
  if (env.GATEWAY_PRIVATE_KEY) {
    const payments = [...perUser.entries()]
      .filter(([, data]) => data.usdc > 0)
      .map(([addr, data]) =>
        sendNanopayment(env, addr, data.usdc)
          .then((result) => {
            if (result.success) {
              nanopaymentTxIds.push(result.transaction);
              console.log(`[settlement] Nanopayment to ${addr}: $${data.usdc} USDC (tx: ${result.transaction})`);
            }
          })
          .catch((e) => console.error(`[settlement] Nanopayment failed for ${addr}:`, e))
      );
    await Promise.all(payments);
  } else {
    console.log("[settlement] Skipping nanopayments (no GATEWAY_PRIVATE_KEY)");
  }

  // ── Step 2: HAT token bonus minting (on-chain) ──────────────
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
    // Mark view sessions settled
    for (const sid of data.sessionIds) {
      await db.markSettled(d1, settlementId, sid);
    }
    // Mark clicks settled
    for (const cid of data.clickIds) {
      await db.markClickSettled(d1, settlementId, cid);
    }
    await db.updateUserEarnings(d1, data.hat, data.usdc, addr);
    for (const s of sessions.filter((s) => s.user_address === addr)) {
      await db.updateAdSpend(d1, s.usdc_earned as number, s.ad_id as string);
    }
    // Also charge click rewards to the ad's spend
    for (const click of clicks.filter((cl) => cl.user_address === addr)) {
      await db.updateAdSpend(d1, click.usdc_reward as number, click.ad_id as string);
    }
  }
  await db.insertSettlement(d1, settlementId, nanopaymentTxIds.join(",") || null, hatTxHash ?? null, totalUsdc, totalHat, recipients.length);

  return { id: settlementId, recipientCount: recipients.length, totalUsdc, totalHat, clickRewardsUsdc, nanopaymentTxIds, hatTxHash };
}
