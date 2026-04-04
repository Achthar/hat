import { Hono } from "hono";
import type { Env } from "../types.js";
import * as db from "../db.js";

export const devRoutes = new Hono<{ Bindings: Env }>();

/// Seed demo data
devRoutes.post("/seed", async (c) => {
  const d1 = c.env.DB;
  const advAddr = "0xAdvertiser0000000000000000000001";
  await db.upsertUser(d1, advAddr);

  // Banner base — use frontend origin if provided, fall back to localhost for dev
  const bannerBase = (c.req.header("origin") || "http://localhost:3000") + "/banners";

  const ads = [
    { id: "demo-ad-1", title: "World App — Proof of Human", imageUrl: `${bannerBase}/world-app.svg`, imageWide: `${bannerBase}/world-app-wide.svg`, imageTall: `${bannerBase}/world-app-tall.svg`, targetUrl: "https://world.org", budget: 50 },
    { id: "demo-ad-2", title: "Circle USDC — Digital Dollars", imageUrl: `${bannerBase}/circle-usdc.svg`, imageWide: `${bannerBase}/circle-usdc-wide.svg`, imageTall: `${bannerBase}/circle-usdc-tall.svg`, targetUrl: "https://circle.com", budget: 30 },
    { id: "demo-ad-3", title: "HAT — Earn While You Browse", imageUrl: `${bannerBase}/hat-token.svg`, imageWide: `${bannerBase}/hat-token-wide.svg`, imageTall: `${bannerBase}/hat-token-tall.svg`, targetUrl: "http://localhost:3000", budget: 20 },
  ];

  for (const ad of ads) {
    try {
      await db.insertAd(d1, ad.id, advAddr, ad.imageUrl, ad.targetUrl, ad.title, ad.budget, ad.imageWide, ad.imageTall);
    } catch {
      // already exists
    }
  }

  return c.json({ message: "Seeded demo data", ads: ads.length });
});

/// Mock verify a user (skip World ID)
devRoutes.post("/mock-verify", async (c) => {
  const { address } = await c.req.json();
  if (!address) return c.json({ error: "address required" }, 400);

  await db.upsertUser(c.env.DB, address);
  await db.verifyUser(c.env.DB, `mock-nullifier-${address}`, address);

  return c.json({ verified: true, address });
});

/// Reset all data
devRoutes.post("/reset", async (c) => {
  const d1 = c.env.DB;
  await d1.exec("DELETE FROM view_sessions");
  await d1.exec("DELETE FROM settlements");
  await d1.exec("DELETE FROM ads");
  await d1.exec("DELETE FROM users");
  return c.json({ message: "All data cleared" });
});

/// Stats
devRoutes.get("/stats", async (c) => {
  const d1 = c.env.DB;
  const q = async (sql: string) => ((await d1.prepare(sql).first()) as Record<string, number>).count;

  return c.json({
    users: await q("SELECT COUNT(*) as count FROM users"),
    verifiedUsers: await q("SELECT COUNT(*) as count FROM users WHERE verified = 1"),
    totalSessions: await q("SELECT COUNT(*) as count FROM view_sessions"),
    unsettledSessions: await q("SELECT COUNT(*) as count FROM view_sessions WHERE settled = 0 AND ended_at IS NOT NULL"),
    activeAds: await q("SELECT COUNT(*) as count FROM ads WHERE active = 1"),
    settlements: await q("SELECT COUNT(*) as count FROM settlements"),
  });
});
