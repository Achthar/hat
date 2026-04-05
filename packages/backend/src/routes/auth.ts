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
  try {
    const rpContext = signRpRequest(signingKey, action || WORLD_ID_ACTION);
    rpContext.rp_id = rpId;
    return c.json(rpContext);
  } catch (e) {
    console.error("[rp-context] signing failed:", e);
    return c.json({ error: "RP signing failed", details: String(e) }, 500);
  }
});

/// Verify World ID v4 proof and register user
/// address is optional — if omitted, the nullifier is used as the user identity
authRoutes.post("/verify-world-id", async (c) => {
  const { proof, address } = await c.req.json();
  if (!proof) return c.json({ error: "proof required" }, 400);

  // v4 docs recommend rp_id; fall back to app_id
  const verifyId = c.env.WORLD_ID_RP_ID || c.env.WORLD_ID_APP_ID;
  const verifyUrl = `${WORLD_ID_VERIFY_URL}/${verifyId}`;

  // IDKit v4 result already has { protocol_version, nonce, action, responses[] }
  // Forward it directly to the verify API
  const verifyBody = proof.responses ? proof : {
    // Fallback for legacy IDKit v2 flat format
    protocol_version: "3.0",
    nonce: `0x${Date.now().toString(16)}`,
    action: WORLD_ID_ACTION,
    environment: "production",
    responses: [{
      identifier: proof.verification_level || proof.credential_type || "orb",
      merkle_root: proof.merkle_root,
      nullifier: proof.nullifier_hash,
      proof: proof.proof,
    }],
  };

  console.log("[verify] URL:", verifyUrl);
  console.log("[verify] protocol:", verifyBody.protocol_version);
  console.log("[verify] body:", JSON.stringify(verifyBody).slice(0, 800));

  const res = await fetch(verifyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "HAT-Backend/1.0",
    },
    body: JSON.stringify(verifyBody),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[verify] failed:", res.status, err.slice(0, 300));
    return c.json({ error: "World ID verification failed", details: err, verifyUrl, status: res.status }, 400);
  }

  const result: Record<string, unknown> = await res.json();
  console.log("[verify] success response:", JSON.stringify(result).slice(0, 500));

  // Extract nullifier from v4 response — check multiple locations
  let nullifier: string | undefined;
  // v4: top-level nullifier field
  if (result.nullifier) {
    nullifier = result.nullifier as string;
  }
  // v4: results array (not responses)
  if (!nullifier && Array.isArray(result.results)) {
    const first = (result.results as Record<string, unknown>[]).find(r => r.nullifier);
    if (first) nullifier = first.nullifier as string;
  }
  // v3/v4: responses array
  if (!nullifier && Array.isArray(result.responses)) {
    const first = (result.responses as Record<string, unknown>[]).find(r => r.nullifier);
    if (first) nullifier = first.nullifier as string;
  }
  // Legacy: nullifier_hash
  if (!nullifier && result.nullifier_hash) {
    nullifier = result.nullifier_hash as string;
  }
  if (!nullifier) {
    return c.json({ error: "No nullifier in verification response", response: result }, 400);
  }

  // Always use the provided wallet address if available
  const resolvedAddress = address || nullifier;

  const existing = await db.getUserByNullifier(c.env.DB, nullifier);
  if (existing) {
    // Return the wallet address the user provided (not the stored one)
    return c.json({
      verified: true,
      nullifier,
      address: address || (existing.address as string),
      totalHatEarned: existing.total_hat_earned ?? 0,
      totalUsdcEarned: existing.total_usdc_earned ?? 0,
    });
  }

  // New user
  await db.upsertUser(c.env.DB, resolvedAddress);
  await db.verifyUser(c.env.DB, nullifier, resolvedAddress);

  return c.json({ verified: true, nullifier, address: resolvedAddress });
});

/// Link a wallet address to an existing World ID-verified account
authRoutes.post("/link-wallet", async (c) => {
  const { nullifier, address } = await c.req.json();
  if (!nullifier || !address) return c.json({ error: "nullifier and address required" }, 400);

  const existing = await db.getUserByNullifier(c.env.DB, nullifier);
  if (!existing) return c.json({ error: "No verified account found for this nullifier" }, 404);

  const oldAddress = existing.address as string;

  // Create new user record with the wallet address, migrate earnings
  await db.upsertUser(c.env.DB, address);
  await c.env.DB.prepare(
    "UPDATE users SET verified = 1, nullifier = ?, total_hat_earned = ?, total_usdc_earned = ? WHERE address = ?"
  ).bind(nullifier, existing.total_hat_earned, existing.total_usdc_earned, address).run();

  // Clean up the old nullifier-as-address record if different
  if (oldAddress !== address) {
    await c.env.DB.prepare("DELETE FROM users WHERE address = ?").bind(oldAddress).run();
    // Point view sessions to the new address
    await c.env.DB.prepare("UPDATE view_sessions SET user_address = ? WHERE user_address = ?").bind(address, oldAddress).run();
  }

  return c.json({ linked: true, address });
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
