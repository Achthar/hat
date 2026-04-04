import { Hono } from "hono";
import type { AdBanner } from "@hat/common";

export const adRoutes = new Hono();

// In-memory store for hackathon MVP
const ads: AdBanner[] = [];

/// Get active ads to display in extension
adRoutes.get("/active", async (c) => {
  const active = ads.filter((a) => a.active && a.budgetSpentUsdc < a.budgetAllocatedUsdc);
  return c.json({ ads: active });
});

/// Create a new ad (advertiser)
adRoutes.post("/create", async (c) => {
  const body = await c.req.json();
  const ad: AdBanner = {
    id: crypto.randomUUID(),
    advertiserId: body.advertiserId,
    imageUrl: body.imageUrl,
    targetUrl: body.targetUrl,
    title: body.title,
    budgetAllocatedUsdc: body.budgetUsdc,
    budgetSpentUsdc: 0,
    active: true,
  };
  ads.push(ad);
  return c.json(ad, 201);
});

/// Get ads by advertiser
adRoutes.get("/by-advertiser/:id", async (c) => {
  const id = c.req.param("id");
  return c.json({ ads: ads.filter((a) => a.advertiserId === id) });
});
