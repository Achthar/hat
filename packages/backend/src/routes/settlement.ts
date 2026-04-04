import { Hono } from "hono";
import type { Env } from "../types.js";
import { runSettlement } from "../services/settlement.js";
import * as db from "../db.js";

export const settlementRoutes = new Hono<{ Bindings: Env }>();

/// Trigger batch settlement
settlementRoutes.post("/batch", async (c) => {
  try {
    // Pass includeUnverified=true via query param or body for demo mode
    let includeUnverified = false;
    try {
      const body = await c.req.json();
      includeUnverified = body?.includeUnverified === true;
    } catch {
      // No body — default to verified-only
    }
    const requireVerified = !includeUnverified;

    const result = await runSettlement(c.env.DB, c.env, requireVerified);
    if (result.recipientCount === 0) {
      return c.json({ message: "No unsettled sessions to process" });
    }
    return c.json(result);
  } catch (e) {
    console.error("Settlement failed:", e);
    return c.json({ error: "Settlement failed", details: String(e) }, 500);
  }
});

/// Get settlement history
settlementRoutes.get("/history", async (c) => {
  const batches = await db.getSettlements(c.env.DB);
  return c.json({ batches });
});
