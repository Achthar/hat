import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types.js";
import { authRoutes } from "./routes/auth.js";
import { viewRoutes } from "./routes/views.js";
import { settlementRoutes } from "./routes/settlement.js";
import { adRoutes } from "./routes/ads.js";
import { devRoutes } from "./routes/dev.js";
import { nanopaymentRoutes } from "./routes/nanopayments.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.route("/api/auth", authRoutes);
app.route("/api/views", viewRoutes);
app.route("/api/settlement", settlementRoutes);
app.route("/api/ads", adRoutes);
app.route("/api/dev", devRoutes);
app.route("/api/nanopayments", nanopaymentRoutes);

app.get("/api/health", (c) => c.json({ status: "ok" }));

// ── Cron: auto-settle every 15 minutes ─────────────────────────
import { runSettlement } from "./services/settlement.js";

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env) {
    console.log(`[cron] Settlement triggered at ${new Date(event.scheduledTime).toISOString()}`);
    try {
      const result = await runSettlement(env.DB, env, false); // includeUnverified for demo
      if (result.recipientCount > 0) {
        console.log(`[cron] Settled: ${result.recipientCount} recipients, $${result.totalUsdc.toFixed(4)} USDC, ${Math.floor(result.totalHat)} HAT`);
      } else {
        console.log("[cron] Nothing to settle");
      }
    } catch (e) {
      console.error("[cron] Settlement failed:", e);
    }
  },
};
