import { Hono } from "hono";
import { RATE_PER_SECOND_USDC, HAT_PER_USDC } from "@hat/common";
// RATE_PER_SECOND_USDC is the global fallback; ads can override with view_reward_per_second
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

    // Use the ad's custom rate if set, otherwise fall back to global default
    const ad = await db.getAd(c.env.DB, session.ad_id as string);
    const ratePerSecond = (ad?.view_reward_per_second as number) || RATE_PER_SECOND_USDC;
    const usdcEarned = durationSeconds * ratePerSecond;
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

/// Record a click-through on an ad (viewer clicked the banner)
viewRoutes.post("/click", async (c) => {
  try {
    const { userId, adId, sessionId } = await c.req.json();
    if (!userId || !adId) return c.json({ error: "userId and adId required" }, 400);

    const ad = await db.getAd(c.env.DB, adId);
    if (!ad) return c.json({ error: "Ad not found" }, 404);

    const clickReward = (ad.click_reward_usdc as number) || 0;
    const hatReward = clickReward * HAT_PER_USDC;
    const clickId = `click-${userId}-${adId}-${Date.now()}`;

    await db.insertClick(c.env.DB, clickId, userId, adId, sessionId ?? null, clickReward, hatReward);

    return c.json({
      clickId,
      adId,
      usdcReward: clickReward,
      hatReward,
      targetUrl: ad.target_url,
    });
  } catch (e) {
    console.error("views/click error:", e);
    return c.json({ error: "Failed to record click", details: String(e) }, 500);
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
