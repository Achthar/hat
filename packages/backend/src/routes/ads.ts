import { Hono } from "hono";
import type { Env } from "../types.js";
import * as db from "../db.js";

export const adRoutes = new Hono<{ Bindings: Env }>();

/// Get active ads to display in extension
adRoutes.get("/active", async (c) => {
  const ads = await db.getActiveAds(c.env.DB);
  return c.json({ ads });
});

/// Create a new ad (advertiser)
adRoutes.post("/create", async (c) => {
  const body = await c.req.json();
  const id = crypto.randomUUID();

  await db.insertAd(c.env.DB, id, body.advertiserId, body.imageUrl, body.targetUrl, body.title, body.budgetUsdc ?? 0, body.imageWide, body.imageTall);

  // Set custom rates if provided
  const updates: string[] = [];
  const binds: unknown[] = [];
  if (body.clickRewardUsdc && body.clickRewardUsdc > 0) {
    updates.push("click_reward_usdc = ?");
    binds.push(body.clickRewardUsdc);
  }
  if (body.viewRewardPerSecond && body.viewRewardPerSecond > 0) {
    updates.push("view_reward_per_second = ?");
    binds.push(body.viewRewardPerSecond);
  }
  if (updates.length > 0) {
    binds.push(id);
    await c.env.DB.prepare(`UPDATE ads SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
  }

  return c.json({
    id,
    advertiserId: body.advertiserId,
    imageUrl: body.imageUrl,
    targetUrl: body.targetUrl,
    title: body.title,
    budgetAllocatedUsdc: body.budgetUsdc ?? 0,
    clickRewardUsdc: body.clickRewardUsdc ?? 0,
    viewRewardPerSecond: body.viewRewardPerSecond ?? 0.0001,
    budgetSpentUsdc: 0,
    active: true,
  }, 201);
});

/// Get ads by advertiser
adRoutes.get("/by-advertiser/:address", async (c) => {
  const address = c.req.param("address");
  const ads = await db.getAdsByAdvertiser(c.env.DB, address);
  return c.json({ ads });
});

/// Get detailed analytics for a single ad campaign
adRoutes.get("/:id/analytics", async (c) => {
  try {
    const adId = c.req.param("id");
    const d1 = c.env.DB;

    const [views, clicks, uniqueViewers, viewUsdc, clickUsdc] = await Promise.all([
      d1.prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(duration_seconds),0) as totalSeconds FROM view_sessions WHERE ad_id = ? AND ended_at IS NOT NULL").bind(adId).first(),
      d1.prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(usdc_reward),0) as totalUsdc FROM ad_clicks WHERE ad_id = ?").bind(adId).first(),
      d1.prepare("SELECT COUNT(DISTINCT user_address) as cnt FROM view_sessions WHERE ad_id = ?").bind(adId).first(),
      d1.prepare("SELECT COALESCE(SUM(usdc_earned),0) as total FROM view_sessions WHERE ad_id = ? AND ended_at IS NOT NULL").bind(adId).first(),
      d1.prepare("SELECT COALESCE(SUM(usdc_reward),0) as total FROM ad_clicks WHERE ad_id = ?").bind(adId).first(),
    ]);

    const totalViews = (views?.cnt as number) ?? 0;
    const totalViewSeconds = (views?.totalSeconds as number) ?? 0;
    const totalClicks = (clicks?.cnt as number) ?? 0;
    const viewSpendUsdc = (viewUsdc?.total as number) ?? 0;
    const clickSpendUsdc = (clickUsdc?.total as number) ?? 0;
    const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;

    return c.json({
      adId,
      uniqueViewers: (uniqueViewers?.cnt as number) ?? 0,
      views: totalViews,
      totalViewSeconds,
      avgViewSeconds: totalViews > 0 ? Math.round(totalViewSeconds / totalViews) : 0,
      clicks: totalClicks,
      ctr: Math.round(ctr * 100) / 100,
      spend: {
        views: viewSpendUsdc,
        clicks: clickSpendUsdc,
        total: viewSpendUsdc + clickSpendUsdc,
      },
    });
  } catch (e) {
    return c.json({ error: "Failed to fetch analytics", details: String(e) }, 500);
  }
});

/// Pause (deactivate) an ad campaign
adRoutes.post("/:id/pause", async (c) => {
  const { advertiserAddress } = await c.req.json();
  if (!advertiserAddress) return c.json({ error: "advertiserAddress required" }, 400);
  await db.deactivateAd(c.env.DB, c.req.param("id"), advertiserAddress);
  return c.json({ success: true, active: false });
});

/// Resume (activate) an ad campaign
adRoutes.post("/:id/resume", async (c) => {
  const { advertiserAddress } = await c.req.json();
  if (!advertiserAddress) return c.json({ error: "advertiserAddress required" }, 400);
  await db.activateAd(c.env.DB, c.req.param("id"), advertiserAddress);
  return c.json({ success: true, active: true });
});
