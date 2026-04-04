import { Hono } from "hono";
import type { Env } from "../types.js";
import { getGatewayBalance, getPlatformAddress } from "../services/gateway.js";

export const nanopaymentRoutes = new Hono<{ Bindings: Env }>();

/// Get platform Gateway wallet info (address + balance)
nanopaymentRoutes.get("/status", async (c) => {
  try {
    if (!c.env.GATEWAY_PRIVATE_KEY) {
      return c.json({ enabled: false, message: "Nanopayments not configured" });
    }
    const address = getPlatformAddress(c.env);
    const balance = await getGatewayBalance(c.env);
    return c.json({ enabled: true, address, balance, network: "arc-testnet" });
  } catch (e) {
    return c.json({ error: "Failed to get Gateway status", details: String(e) }, 500);
  }
});
