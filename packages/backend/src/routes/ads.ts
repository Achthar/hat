import { Hono } from "hono";
import { stmts } from "../db.js";

export const adRoutes = new Hono();

/// Get active ads to display in extension
adRoutes.get("/active", async (c) => {
  const ads = stmts.getActiveAds.all();
  return c.json({ ads });
});

/// Create a new ad (advertiser)
adRoutes.post("/create", async (c) => {
  const body = await c.req.json();
  const id = crypto.randomUUID();

  stmts.insertAd.run(
    id,
    body.advertiserId,
    body.imageUrl,
    body.targetUrl,
    body.title,
    body.budgetUsdc ?? 0
  );

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
  const ads = stmts.getAdsByAdvertiser.all(address);
  return c.json({ ads });
});
