import { Hono } from "hono";
import { WORLD_ID_VERIFY_URL } from "@hat/common";
import { stmts } from "../db.js";

export const authRoutes = new Hono();

const RP_ID = process.env.WORLD_ID_RP_ID || "";

/// Verify World ID v4 proof and register user
authRoutes.post("/verify-world-id", async (c) => {
  const { proof, address } = await c.req.json();

  if (!address) return c.json({ error: "address required" }, 400);

  // Forward proof to World ID v4 verify endpoint
  const res = await fetch(`${WORLD_ID_VERIFY_URL}/${RP_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proof),
  });

  if (!res.ok) {
    const err = await res.text();
    return c.json({ error: "World ID verification failed", details: err }, 400);
  }

  const result = await res.json();
  const nullifier = result.nullifier_hash;

  // Check nullifier uniqueness
  const existing = stmts.getUserByNullifier.get(nullifier);
  if (existing) {
    return c.json({ error: "This World ID has already been linked to an account" }, 409);
  }

  // Upsert user and mark verified
  stmts.upsertUser.run(address);
  stmts.verifyUser.run(nullifier, address);

  return c.json({ verified: true, nullifier, address });
});

/// Connect wallet (non-World-ID flow, limited features)
authRoutes.post("/connect-wallet", async (c) => {
  const { address } = await c.req.json();
  if (!address) return c.json({ error: "address required" }, 400);

  stmts.upsertUser.run(address);
  const user = stmts.getUser.get(address) as Record<string, unknown>;

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
  const user = stmts.getUser.get(address) as Record<string, unknown> | undefined;
  if (!user) return c.json({ error: "User not found" }, 404);

  return c.json({
    address: user.address,
    verified: !!user.verified,
    totalHatEarned: user.total_hat_earned,
    totalUsdcEarned: user.total_usdc_earned,
  });
});
