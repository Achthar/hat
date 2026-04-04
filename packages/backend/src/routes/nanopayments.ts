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

/// Get an advertiser's deposit summary (total deposited, spent, available)
nanopaymentRoutes.get("/balance/:address", async (c) => {
  try {
    const address = c.req.param("address");
    const totalDeposited = await db.getAdvertiserTotalDeposited(c.env.DB, address);
    const totalSpent = await db.getAdvertiserTotalSpent(c.env.DB, address);

    return c.json({
      advertiserAddress: address,
      totalDeposited,
      totalSpent,
      available: totalDeposited - totalSpent,
    });
  } catch (e) {
    return c.json({ error: "Failed to get balance", details: String(e) }, 500);
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
