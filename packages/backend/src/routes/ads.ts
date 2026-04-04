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

  await db.insertAd(c.env.DB, id, body.advertiserId, body.imageUrl, body.targetUrl, body.title, body.budgetUsdc ?? 0);

  return c.json({
    id,
    advertiserId: body.advertiserId,
    imageUrl: body.imageUrl,
    targetUrl: body.targetUrl,
    title: body.title,
    budgetAllocatedUsdc: body.budgetUsdc ?? 0,
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
