import { Hono } from "hono";
import { RATE_PER_SECOND_USDC, HAT_PER_SECOND } from "@hat/common";

export const viewRoutes = new Hono();

// In-memory store for hackathon MVP (replace with DB)
const activeSessions = new Map<string, { adId: string; userId: string; startedAt: number }>();

/// Start tracking an ad view session
viewRoutes.post("/start", async (c) => {
  const { userId, adId } = await c.req.json();

  const sessionId = `${userId}-${adId}-${Date.now()}`;
  activeSessions.set(sessionId, {
    adId,
    userId,
    startedAt: Date.now(),
  });

  return c.json({ sessionId });
});

/// End an ad view session and calculate earnings
viewRoutes.post("/end", async (c) => {
  const { sessionId } = await c.req.json();
  const session = activeSessions.get(sessionId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const endedAt = Date.now();
  const durationSeconds = Math.floor((endedAt - session.startedAt) / 1000);

  const usdcEarned = durationSeconds * RATE_PER_SECOND_USDC;
  const hatEarned = durationSeconds * HAT_PER_SECOND;

  activeSessions.delete(sessionId);

  // TODO: Persist to DB for settlement batch
  // TODO: Verify user is World ID verified before counting

  return c.json({
    sessionId,
    durationSeconds,
    usdcEarned,
    hatEarned,
    adId: session.adId,
    userId: session.userId,
  });
});

/// Heartbeat — extension pings to confirm user is still viewing
viewRoutes.post("/heartbeat", async (c) => {
  const { sessionId } = await c.req.json();
  const session = activeSessions.get(sessionId);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }
  return c.json({ alive: true });
});
