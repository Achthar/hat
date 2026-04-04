import { ethers } from "ethers";
import { PAYOUT_VAULT_ABI, HAT_TOKEN_ABI, CONTRACTS, ARC_TESTNET_RPC } from "@hat/common";
import { db, stmts } from "../db.js";

const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL || ARC_TESTNET_RPC);

function getWallet() {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  return new ethers.Wallet(key, provider);
}

export interface SettlementResult {
  id: string;
  recipientCount: number;
  totalUsdc: number;
  totalHat: number;
  vaultTxHash?: string;
  hatTxHash?: string;
}

/// Aggregate unsettled verified sessions and distribute USDC + mint HAT
export async function runSettlement(): Promise<SettlementResult> {
  const sessions = stmts.getUnsettledSessions.all() as Array<Record<string, unknown>>;

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

  // Group by advertiser for vault distribution
  const perAdvertiser = new Map<string, { recipients: string[]; amounts: bigint[] }>();
  for (const s of sessions) {
    const ad = db.prepare("SELECT advertiser_address FROM ads WHERE id = ?").get(s.ad_id as string) as
      | Record<string, unknown>
      | undefined;
    if (!ad) continue;
    const advAddr = ad.advertiser_address as string;
    const existing = perAdvertiser.get(advAddr) || { recipients: [], amounts: [] };
    existing.recipients.push(s.user_address as string);
    // USDC has 6 decimals
    existing.amounts.push(BigInt(Math.floor((s.usdc_earned as number) * 1e6)));
    perAdvertiser.set(advAddr, existing);
  }

  const settlementId = crypto.randomUUID();
  let vaultTxHash: string | undefined;
  let hatTxHash: string | undefined;
  let totalUsdc = 0;
  let totalHat = 0;

  const wallet = getWallet();

  // 1. Distribute USDC from each advertiser's vault deposit
  if (CONTRACTS.PAYOUT_VAULT) {
    const vault = new ethers.Contract(CONTRACTS.PAYOUT_VAULT, PAYOUT_VAULT_ABI, wallet);
    for (const [advertiser, { recipients, amounts }] of perAdvertiser) {
      try {
        const tx = await vault.distribute(advertiser, recipients, amounts);
        const receipt = await tx.wait();
        vaultTxHash = receipt.hash;
      } catch (e) {
        console.error(`Vault distribute failed for advertiser ${advertiser}:`, e);
      }
    }
  }

  // 2. Batch mint HAT tokens to all recipients
  const recipients: string[] = [];
  const hatAmounts: bigint[] = [];
  for (const [addr, data] of perUser) {
    recipients.push(addr);
    // HAT has 18 decimals
    hatAmounts.push(BigInt(Math.floor(data.hat * 1e18)));
    totalUsdc += data.usdc;
    totalHat += data.hat;
  }

  if (CONTRACTS.HAT_TOKEN && recipients.length > 0) {
    const hat = new ethers.Contract(CONTRACTS.HAT_TOKEN, HAT_TOKEN_ABI, wallet);
    try {
      const tx = await hat.batchMint(recipients, hatAmounts);
      const receipt = await tx.wait();
      hatTxHash = receipt.hash;
    } catch (e) {
      console.error("HAT batchMint failed:", e);
    }
  }

  // 3. Mark sessions as settled and update user earnings
  const markSettledMany = db.transaction(() => {
    for (const [addr, data] of perUser) {
      for (const sid of data.sessionIds) {
        stmts.markSettled.run(settlementId, sid);
      }
      stmts.updateUserEarnings.run(data.hat, data.usdc, addr);
      // Update ad spend
      for (const s of sessions.filter((s) => s.user_address === addr)) {
        stmts.updateAdSpend.run(s.usdc_earned, s.ad_id);
      }
    }
    stmts.insertSettlement.run(
      settlementId,
      vaultTxHash ?? null,
      hatTxHash ?? null,
      totalUsdc,
      totalHat,
      recipients.length
    );
  });
  markSettledMany();

  return {
    id: settlementId,
    recipientCount: recipients.length,
    totalUsdc,
    totalHat,
    vaultTxHash,
    hatTxHash,
  };
}
