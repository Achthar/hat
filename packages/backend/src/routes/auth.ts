import { Hono } from "hono";
import { WORLD_ID_VERIFY_URL } from "@hat/common";

export const authRoutes = new Hono();

const RP_ID = process.env.WORLD_ID_RP_ID!;
const SIGNING_KEY = process.env.WORLD_ID_SIGNING_KEY!;

/// Verify World ID v4 proof and register user
authRoutes.post("/verify-world-id", async (c) => {
  const body = await c.req.json();
  const { proof, address } = body;

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

  // TODO: Store nullifier <-> address mapping in DB
  // TODO: Check nullifier uniqueness (one human = one account)

  return c.json({
    verified: true,
    nullifier,
    address,
  });
});

/// Connect wallet (non-World-ID flow, limited features)
authRoutes.post("/connect-wallet", async (c) => {
  const { address } = await c.req.json();
  // TODO: Verify signature to prove wallet ownership
  return c.json({ address, verified: false });
});
