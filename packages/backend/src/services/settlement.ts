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
  failedPayments: string[];
  hatTxHash?: string;
}

export async function runSettlement(d1: D1Database, env: Env, requireVerified = true): Promise<SettlementResult> {
  const [sessions, clicks] = await Promise.all([
    db.getUnsettledSessions(d1, requireVerified),
    db.getUnsettledClicks(d1, requireVerified),
  ]);

  if (sessions.length === 0 && clicks.length === 0) {
    return { id: "", recipientCount: 0, totalUsdc: 0, totalHat: 0, clickRewardsUsdc: 0, nanopaymentTxIds: [], failedPayments: [] };
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
  const failedPayments: string[] = [];
  const paidUsers = new Set<string>(); // track who actually got paid
  let hatTxHash: string | undefined;
  let totalUsdc = 0;
  let totalHat = 0;

  // ── Step 1: USDC payments ──────────────────────────────────
  // Send nanopayments in parallel. Only mark sessions as settled
  // for users whose payment actually succeeded.
  // Skip nullifier-based IDs (not valid wallet addresses)
  const isValidAddress = (addr: string) => addr.startsWith("0x") && addr.length === 42;

  if (env.GATEWAY_PRIVATE_KEY) {
    const payments = [...perUser.entries()]
      .filter(([addr, data]) => data.usdc > 0 && isValidAddress(addr))
      .map(async ([addr, data]) => {
        try {
          const result = await sendNanopayment(env, addr, data.usdc);
          if (result.success) {
            nanopaymentTxIds.push(result.transaction);
            paidUsers.add(addr);
            console.log(`[settlement] Paid ${addr}: $${data.usdc} USDC (tx: ${result.transaction})`);
          } else {
            failedPayments.push(addr);
            console.error(`[settlement] Payment not successful for ${addr}`);
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          failedPayments.push(`${addr}: ${errMsg}`);
          console.error(`[settlement] Payment FAILED for ${addr}:`, errMsg);
        }
      });
    await Promise.all(payments);
  } else {
    console.log("[settlement] Skipping payments (no GATEWAY_PRIVATE_KEY)");
  }

  // ── Step 2: HAT token bonus minting (on-chain) ──────────────
  // Only mint for users who got paid
  const hasOnChain = !!env.DEPLOYER_PRIVATE_KEY && !!CONTRACTS.HAT_TOKEN;
  if (hasOnChain && paidUsers.size > 0) {
    const allRecipients: string[] = [];
    const allAmounts: bigint[] = [];
    for (const [addr, data] of perUser) {
      if (!paidUsers.has(addr)) continue;
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
      } catch (e) {
        console.error("[settlement] HAT batchMint failed:", e);
      }
    }
  }

  // ── Step 3: Update DB — ONLY for successfully paid users ────
  for (const [addr, data] of perUser) {
    if (!paidUsers.has(addr)) continue; // skip failed — they'll retry next cycle

    totalUsdc += data.usdc;
    totalHat += data.hat;

    for (const sid of data.sessionIds) {
      await db.markSettled(d1, settlementId, sid);
    }
    for (const cid of data.clickIds) {
      await db.markClickSettled(d1, settlementId, cid);
    }
    await db.updateUserEarnings(d1, data.hat, data.usdc, addr);
    for (const s of sessions.filter((s) => s.user_address === addr)) {
      await db.updateAdSpend(d1, s.usdc_earned as number, s.ad_id as string);
    }
    for (const click of clicks.filter((cl) => cl.user_address === addr)) {
      await db.updateAdSpend(d1, click.usdc_reward as number, click.ad_id as string);
    }
  }

  if (totalUsdc > 0 || failedPayments.length > 0) {
    await db.insertSettlement(d1, settlementId, nanopaymentTxIds.join(",") || null, hatTxHash ?? null, totalUsdc, totalHat, paidUsers.size);
  }

  return {
    id: settlementId,
    recipientCount: paidUsers.size,
    totalUsdc,
    totalHat,
    clickRewardsUsdc,
    nanopaymentTxIds,
    failedPayments,
    hatTxHash,
  };
}
