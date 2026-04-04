import { Hono } from "hono";
import { runSettlement } from "../services/settlement.js";
import { stmts } from "../db.js";

export const settlementRoutes = new Hono();

/// Trigger batch settlement — distributes USDC + mints HAT for all unsettled sessions
settlementRoutes.post("/batch", async (c) => {
  try {
    const result = await runSettlement();
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
  const batches = stmts.getSettlements.all();
  return c.json({ batches });
});
