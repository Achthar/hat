import { Hono } from "hono";
import { WORLD_ID_VERIFY_URL, WORLD_ID_ACTION } from "@hat/common";
import type { Env } from "../types.js";
import * as db from "../db.js";
import { signRpRequest } from "../services/rp-signing.js";

export const authRoutes = new Hono<{ Bindings: Env }>();

/// Generate RP context for IDKit widget
authRoutes.post("/rp-context", async (c) => {
  const rpId = c.env.WORLD_ID_RP_ID;
  const signingKey = c.env.WORLD_ID_SIGNING_KEY;
  if (!signingKey || !rpId) {
    return c.json({ error: "World ID not configured" }, 500);
  }

  const { action } = await c.req.json();
  const rpContext = signRpRequest(signingKey, action || WORLD_ID_ACTION);
  rpContext.rp_id = rpId;

  return c.json(rpContext);
});

/// Verify World ID v4 proof and register user
authRoutes.post("/verify-world-id", async (c) => {
  const { proof, address } = await c.req.json();
  if (!address) return c.json({ error: "address required" }, 400);
  if (!proof) return c.json({ error: "proof required" }, 400);

  const rpId = c.env.WORLD_ID_RP_ID;
  const res = await fetch(`${WORLD_ID_VERIFY_URL}/${rpId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proof),
  });

  if (!res.ok) {
    const err = await res.text();
    return c.json({ error: "World ID verification failed", details: err }, 400);
  }

  const result: Record<string, unknown> = await res.json();

  let nullifier: string;
  if (Array.isArray(result.responses) && result.responses.length > 0) {
    nullifier = (result.responses as Record<string, unknown>[])[0].nullifier as string;
  } else if (result.nullifier_hash) {
    nullifier = result.nullifier_hash as string;
  } else {
    return c.json({ error: "No nullifier in verification response" }, 400);
  }

  const existing = await db.getUserByNullifier(c.env.DB, nullifier);
  if (existing) {
    return c.json({ error: "This World ID has already been linked to an account" }, 409);
  }

  await db.upsertUser(c.env.DB, address);
  await db.verifyUser(c.env.DB, nullifier, address);

  return c.json({ verified: true, nullifier, address });
});

/// Connect wallet
authRoutes.post("/connect-wallet", async (c) => {
  const { address } = await c.req.json();
  if (!address) return c.json({ error: "address required" }, 400);

  await db.upsertUser(c.env.DB, address);
  const user = await db.getUser(c.env.DB, address);

  return c.json({
    address,
    verified: !!user?.verified,
    totalHatEarned: user?.total_hat_earned ?? 0,
    totalUsdcEarned: user?.total_usdc_earned ?? 0,
  });
});

/// Get user profile
authRoutes.get("/user/:address", async (c) => {
  const address = c.req.param("address");
  const user = await db.getUser(c.env.DB, address);
  if (!user) return c.json({ error: "User not found" }, 404);

  return c.json({
    address: user.address,
    verified: !!user.verified,
    totalHatEarned: user.total_hat_earned,
    totalUsdcEarned: user.total_usdc_earned,
  });
});
