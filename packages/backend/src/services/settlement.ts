import { ethers } from "ethers";
import { PAYOUT_VAULT_ABI, HAT_TOKEN_ABI, CONTRACTS, ARC_TESTNET_RPC } from "@hat/common";
import type { Env } from "../types.js";
import * as db from "../db.js";

export interface SettlementResult {
  id: string;
  recipientCount: number;
  totalUsdc: number;
  totalHat: number;
  vaultTxHash?: string;
  hatTxHash?: string;
}

export async function runSettlement(d1: D1Database, env: Env): Promise<SettlementResult> {
  const sessions = await db.getUnsettledSessions(d1);

  if (sessions.length === 0) {
    return { id: "", recipientCount: 0, totalUsdc: 0, totalHat: 0 };
  }

  // Aggregate earnings per user
  const perUser = new Map<string, { usdc: number; hat: number; sessionIds: string[] }>();
  for (const s of sessions) {
    const addr = s.user_address as string;
    const existing = perUser.get(addr) || { usdc: 0, hat: 0, sessionIds: [] };
    existing.usdc += s.usdc_earned as number;
    existing.hat += s.hat_earned as number;
    existing.sessionIds.push(s.id as string);
    perUser.set(addr, existing);
  }

  // Group by advertiser
  const perAdvertiser = new Map<string, { recipients: string[]; amounts: bigint[] }>();
  for (const s of sessions) {
    const ad = await db.getAdAdvertiser(d1, s.ad_id as string);
    if (!ad) continue;
    const advAddr = ad.advertiser_address as string;
    const existing = perAdvertiser.get(advAddr) || { recipients: [], amounts: [] };
    existing.recipients.push(s.user_address as string);
    existing.amounts.push(BigInt(Math.floor((s.usdc_earned as number) * 1e6)));
    perAdvertiser.set(advAddr, existing);
  }

  const settlementId = crypto.randomUUID();
  let vaultTxHash: string | undefined;
  let hatTxHash: string | undefined;
  let totalUsdc = 0;
  let totalHat = 0;

  const hasOnChain = !!env.DEPLOYER_PRIVATE_KEY && !!CONTRACTS.PAYOUT_VAULT;

  if (hasOnChain) {
    const provider = new ethers.JsonRpcProvider(env.ARC_RPC_URL || ARC_TESTNET_RPC);
    const wallet = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);

    // Distribute USDC
    if (CONTRACTS.PAYOUT_VAULT) {
      const vault = new ethers.Contract(CONTRACTS.PAYOUT_VAULT, PAYOUT_VAULT_ABI, wallet);
      for (const [advertiser, { recipients, amounts }] of perAdvertiser) {
        try {
          const tx = await vault.distribute(advertiser, recipients, amounts);
          const receipt = await tx.wait();
          vaultTxHash = receipt.hash;
        } catch (e) {
          console.error(`Vault distribute failed for ${advertiser}:`, e);
        }
      }
    }

    // Batch mint HAT
    if (CONTRACTS.HAT_TOKEN) {
      const allRecipients: string[] = [];
      const allAmounts: bigint[] = [];
      for (const [addr, data] of perUser) {
        allRecipients.push(addr);
        allAmounts.push(BigInt(Math.floor(data.hat * 1e18)));
      }
      if (allRecipients.length > 0) {
        const hat = new ethers.Contract(CONTRACTS.HAT_TOKEN, HAT_TOKEN_ABI, wallet);
        try {
          const tx = await hat.batchMint(allRecipients, allAmounts);
          const receipt = await tx.wait();
          hatTxHash = receipt.hash;
        } catch (e) {
          console.error("HAT batchMint failed:", e);
        }
      }
    }
  } else {
    console.log("[settlement] Skipping on-chain calls (no deployer key or contracts)");
  }

  // Compute totals
  const recipients: string[] = [];
  for (const [addr, data] of perUser) {
    recipients.push(addr);
    totalUsdc += data.usdc;
    totalHat += data.hat;
  }

  // Mark settled + update earnings in D1
  for (const [addr, data] of perUser) {
    for (const sid of data.sessionIds) {
      await db.markSettled(d1, settlementId, sid);
    }
    await db.updateUserEarnings(d1, data.hat, data.usdc, addr);
    for (const s of sessions.filter((s) => s.user_address === addr)) {
      await db.updateAdSpend(d1, s.usdc_earned as number, s.ad_id as string);
    }
  }
  await db.insertSettlement(d1, settlementId, vaultTxHash ?? null, hatTxHash ?? null, totalUsdc, totalHat, recipients.length);

  return { id: settlementId, recipientCount: recipients.length, totalUsdc, totalHat, vaultTxHash, hatTxHash };
}
