import { Hono } from "hono";
import { RATE_PER_SECOND_USDC, HAT_PER_SECOND } from "@hat/common";
import { stmts } from "../db.js";

export const viewRoutes = new Hono();

/// Start tracking an ad view session
viewRoutes.post("/start", async (c) => {
  const { userId, adId } = await c.req.json();
  if (!userId || !adId) return c.json({ error: "userId and adId required" }, 400);

  const sessionId = `${userId}-${adId}-${Date.now()}`;
  stmts.insertSession.run(sessionId, userId, adId, Date.now());

  return c.json({ sessionId });
});

/// End an ad view session and calculate earnings
viewRoutes.post("/end", async (c) => {
  const { sessionId } = await c.req.json();
  const session = stmts.getSession.get(sessionId) as Record<string, unknown> | undefined;

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }
  if (session.ended_at) {
    return c.json({ error: "Session already ended" }, 400);
  }

  const endedAt = Date.now();
  const durationSeconds = Math.floor((endedAt - (session.started_at as number)) / 1000);
  const usdcEarned = durationSeconds * RATE_PER_SECOND_USDC;
  const hatEarned = durationSeconds * HAT_PER_SECOND;

  stmts.endSession.run(endedAt, durationSeconds, usdcEarned, hatEarned, sessionId);

  return c.json({
    sessionId,
    durationSeconds,
    usdcEarned,
    hatEarned,
    adId: session.ad_id,
    userId: session.user_address,
  });
});

/// Heartbeat — extension pings to confirm user is still viewing
viewRoutes.post("/heartbeat", async (c) => {
  const { sessionId } = await c.req.json();
  const session = stmts.getSession.get(sessionId) as Record<string, unknown> | undefined;
  if (!session || session.ended_at) {
    return c.json({ error: "Session not found or ended" }, 404);
  }
  return c.json({ alive: true });
});
