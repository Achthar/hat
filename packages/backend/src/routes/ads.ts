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
