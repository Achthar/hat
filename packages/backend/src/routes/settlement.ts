import { Hono } from "hono";
import { ethers } from "ethers";
import { PAYOUT_VAULT_ABI, HAT_TOKEN_ABI } from "@hat/common";

export const settlementRoutes = new Hono();

/// Trigger batch settlement — distributes USDC + mints HAT for all unsettled sessions
settlementRoutes.post("/batch", async (c) => {
  // TODO: Aggregate unsettled view sessions from DB
  // TODO: Group by advertiser for USDC distribution
  // TODO: Call PayoutVault.distribute() for each advertiser
  // TODO: Call HATToken.batchMint() for all viewers
  // TODO: Mark sessions as settled

  return c.json({
    message: "Settlement batch triggered",
    // txHashes: { vault: "0x...", hat: "0x..." }
  });
});

/// Get settlement history
settlementRoutes.get("/history", async (c) => {
  // TODO: Return past settlement batches
  return c.json({ batches: [] });
});
