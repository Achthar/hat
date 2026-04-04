import { Hono } from "hono";
import type { Env } from "../types.js";
import {
  getGatewayBalance,
  getPlatformAddress,
  getGatewayWalletAddress,
  depositToGateway,
} from "../services/gateway.js";
import * as db from "../db.js";

export const nanopaymentRoutes = new Hono<{ Bindings: Env }>();

/// Get platform Gateway wallet info (address, balance, config status)
nanopaymentRoutes.get("/status", async (c) => {
  try {
    if (!c.env.GATEWAY_PRIVATE_KEY) {
      return c.json({ enabled: false, message: "GATEWAY_PRIVATE_KEY not configured" });
    }

    const platformAddress = getPlatformAddress(c.env);
    const gatewayWallet = getGatewayWalletAddress(c.env);

    // Balance check hits the RPC — don't let it crash the whole endpoint
    let balance = "0";
    try {
      balance = await getGatewayBalance(c.env);
    } catch {
      // RPC may be down — return what we can
    }

    return c.json({
      enabled: !!gatewayWallet,
      platformAddress,
      gatewayWallet,
      balance,
      network: "arc-testnet",
    });
  } catch (e) {
    return c.json({ error: "Failed to get Gateway status", details: String(e) }, 500);
  }
});

/// Record an advertiser's USDC deposit to the Gateway.
/// The advertiser sends native USDC on-chain (via the Dashboard),
/// then calls this endpoint to record the deposit in our DB.
nanopaymentRoutes.post("/record-deposit", async (c) => {
  try {
    const { advertiserAddress, amountUsdc, txHash } = await c.req.json();
    if (!advertiserAddress || !amountUsdc) {
      return c.json({ error: "advertiserAddress and amountUsdc required" }, 400);
    }

    const id = crypto.randomUUID();
    await db.insertGatewayDeposit(c.env.DB, id, advertiserAddress, amountUsdc, txHash ?? null);

    const totalDeposited = await db.getAdvertiserTotalDeposited(c.env.DB, advertiserAddress);
    const totalSpent = await db.getAdvertiserTotalSpent(c.env.DB, advertiserAddress);

    return c.json({
      id,
      advertiserAddress,
      amountUsdc,
      txHash,
      totalDeposited,
      totalSpent,
      available: totalDeposited - totalSpent,
    }, 201);
  } catch (e) {
    return c.json({ error: "Failed to record deposit", details: String(e) }, 500);
  }
});

/// Get an advertiser's full balance breakdown including live accrued spend
nanopaymentRoutes.get("/balance/:address", async (c) => {
  try {
    const address = c.req.param("address");
    const [totalDeposited, totalSpent, accrued, active] = await Promise.all([
      db.getAdvertiserTotalDeposited(c.env.DB, address),
      db.getAdvertiserTotalSpent(c.env.DB, address),
      db.getAdvertiserAccruedUsdc(c.env.DB, address),
      db.getAdvertiserActiveSessions(c.env.DB, address),
    ]);

    return c.json({
      advertiserAddress: address,
      totalDeposited,
      totalSpent,        // settled + recorded in ads table
      accrued,           // unsettled sessions (ended but not yet paid out)
      activeSessions: active.count,  // in-progress views right now
      totalOwed: totalSpent + accrued,
      available: totalDeposited - totalSpent - accrued,
    });
  } catch (e) {
    return c.json({ error: "Failed to get balance", details: String(e) }, 500);
  }
});

/// Withdraw: send remaining USDC back to advertiser from platform wallet.
/// Only withdraws the available balance (deposited - spent - accrued).
nanopaymentRoutes.post("/withdraw", async (c) => {
  try {
    const { advertiserAddress } = await c.req.json();
    if (!advertiserAddress) return c.json({ error: "advertiserAddress required" }, 400);

    const totalDeposited = await db.getAdvertiserTotalDeposited(c.env.DB, advertiserAddress);
    const totalSpent = await db.getAdvertiserTotalSpent(c.env.DB, advertiserAddress);
    const accrued = await db.getAdvertiserAccruedUsdc(c.env.DB, advertiserAddress);
    const available = totalDeposited - totalSpent - accrued;

    if (available <= 0) {
      return c.json({ error: "No funds available to withdraw", available: 0 }, 400);
    }

    // Send native USDC back from platform wallet to advertiser
    const { ethers } = await import("ethers");
    const { ARC_TESTNET_RPC } = await import("@hat/common");
    const provider = new ethers.JsonRpcProvider(c.env.ARC_RPC_URL || ARC_TESTNET_RPC);
    const wallet = new ethers.Wallet(c.env.GATEWAY_PRIVATE_KEY, provider);
    const value = ethers.parseEther(String(available));

    const tx = await wallet.sendTransaction({ to: advertiserAddress, value });
    const receipt = await tx.wait();

    // Record negative deposit to track the withdrawal
    const id = crypto.randomUUID();
    await db.insertGatewayDeposit(c.env.DB, id, advertiserAddress, -available, receipt!.hash);

    return c.json({
      success: true,
      withdrawn: available,
      txHash: receipt!.hash,
      remaining: 0,
    });
  } catch (e) {
    return c.json({ error: "Withdrawal failed", details: String(e) }, 500);
  }
});

/// Get recent settled view sessions with payment details
nanopaymentRoutes.get("/payments", async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT vs.id, vs.user_address, vs.ad_id, vs.duration_seconds,
             vs.usdc_earned, vs.hat_earned, vs.settlement_id, vs.ended_at,
             a.title as ad_title, a.advertiser_address,
             s.vault_tx_hash as nanopayment_tx, s.hat_tx_hash, s.settled_at
      FROM view_sessions vs
      LEFT JOIN ads a ON vs.ad_id = a.id
      LEFT JOIN settlements s ON vs.settlement_id = s.id
      WHERE vs.settled = 1
      ORDER BY vs.ended_at DESC
      LIMIT 100
    `).all();
    return c.json({ payments: result.results });
  } catch (e) {
    return c.json({ error: "Failed to fetch payments", details: String(e) }, 500);
  }
});

/// Get platform-wide stats for the dashboard
nanopaymentRoutes.get("/dashboard-stats", async (c) => {
  try {
    const [users, sessions, settlements, deposits] = await Promise.all([
      c.env.DB.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN verified=1 THEN 1 ELSE 0 END) as verified FROM users").first(),
      c.env.DB.prepare("SELECT COUNT(*) as total, SUM(usdc_earned) as total_usdc, SUM(hat_earned) as total_hat FROM view_sessions WHERE ended_at IS NOT NULL").first(),
      c.env.DB.prepare("SELECT COUNT(*) as total, SUM(total_usdc) as settled_usdc, SUM(total_hat) as settled_hat FROM settlements").first(),
      c.env.DB.prepare("SELECT COALESCE(SUM(amount_usdc), 0) as total FROM gateway_deposits").first(),
    ]);

    let balance = "0";
    try {
      balance = await getGatewayBalance(c.env);
    } catch { /* RPC may be down */ }

    return c.json({
      users: { total: users?.total ?? 0, verified: users?.verified ?? 0 },
      sessions: { total: sessions?.total ?? 0, totalUsdc: sessions?.total_usdc ?? 0, totalHat: sessions?.total_hat ?? 0 },
      settlements: { total: settlements?.total ?? 0, settledUsdc: settlements?.settled_usdc ?? 0, settledHat: settlements?.settled_hat ?? 0 },
      gateway: {
        balance,
        totalDeposited: deposits?.total ?? 0,
        mode: c.env.GATEWAY_WALLET_ADDRESS ? "gateway" : "direct",
        platformAddress: getPlatformAddress(c.env),
        walletAddress: getGatewayWalletAddress(c.env),
      },
    });
  } catch (e) {
    return c.json({ error: "Failed to fetch stats", details: String(e) }, 500);
  }
});

/// Trigger platform-side deposit from EOA into Gateway Wallet contract.
/// This moves USDC from the platform EOA into the Gateway Wallet so that
/// nanopayment signatures can be settled against it.
nanopaymentRoutes.post("/fund-gateway", async (c) => {
  try {
    const { amountUsdc } = await c.req.json();
    if (!amountUsdc || amountUsdc <= 0) {
      return c.json({ error: "amountUsdc required (> 0)" }, 400);
    }

    const txHash = await depositToGateway(c.env, amountUsdc);
    return c.json({ success: true, txHash, amountUsdc });
  } catch (e) {
    return c.json({ error: "Gateway deposit failed", details: String(e) }, 500);
  }
});
