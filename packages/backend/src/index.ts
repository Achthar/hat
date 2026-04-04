import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types.js";
import { authRoutes } from "./routes/auth.js";
import { viewRoutes } from "./routes/views.js";
import { settlementRoutes } from "./routes/settlement.js";
import { adRoutes } from "./routes/ads.js";
import { devRoutes } from "./routes/dev.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.route("/api/auth", authRoutes);
app.route("/api/views", viewRoutes);
app.route("/api/settlement", settlementRoutes);
app.route("/api/ads", adRoutes);
app.route("/api/dev", devRoutes);

app.get("/api/health", (c) => c.json({ status: "ok" }));

export default app;
