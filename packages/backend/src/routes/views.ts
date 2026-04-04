import { Hono } from "hono";
import { RATE_PER_SECOND_USDC, HAT_PER_USDC } from "@hat/common";
import type { Env } from "../types.js";
import * as db from "../db.js";

export const viewRoutes = new Hono<{ Bindings: Env }>();

/// Start tracking an ad view session
viewRoutes.post("/start", async (c) => {
  try {
    const { userId, adId } = await c.req.json();
    if (!userId || !adId) return c.json({ error: "userId and adId required" }, 400);

    // Ensure user exists (handles anonymous + wallet users)
    await db.upsertUser(c.env.DB, userId);

    const sessionId = `${userId}-${adId}-${Date.now()}`;
    await db.insertSession(c.env.DB, sessionId, userId, adId, Date.now());

    return c.json({ sessionId });
  } catch (e) {
    console.error("views/start error:", e);
    return c.json({ error: "Failed to start session", details: String(e) }, 500);
  }
});

/// End an ad view session and calculate earnings
viewRoutes.post("/end", async (c) => {
  try {
    const { sessionId } = await c.req.json();
    const session = await db.getSession(c.env.DB, sessionId);

    if (!session) return c.json({ error: "Session not found" }, 404);
    if (session.ended_at) return c.json({ error: "Session already ended" }, 400);

    const endedAt = Date.now();
    const durationSeconds = Math.floor((endedAt - (session.started_at as number)) / 1000);
    const usdcEarned = durationSeconds * RATE_PER_SECOND_USDC;
    const hatEarned = usdcEarned * HAT_PER_USDC;

    await db.endSession(c.env.DB, sessionId, endedAt, durationSeconds, usdcEarned, hatEarned);

    return c.json({
      sessionId,
      durationSeconds,
      usdcEarned,
      hatEarned,
      adId: session.ad_id,
      userId: session.user_address,
    });
  } catch (e) {
    console.error("views/end error:", e);
    return c.json({ error: "Failed to end session", details: String(e) }, 500);
  }
});

/// Heartbeat
viewRoutes.post("/heartbeat", async (c) => {
  const { sessionId } = await c.req.json();
  const session = await db.getSession(c.env.DB, sessionId);
  if (!session || session.ended_at) {
    return c.json({ error: "Session not found or ended" }, 404);
  }
  return c.json({ alive: true });
});
