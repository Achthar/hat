import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth.js";
import { viewRoutes } from "./routes/views.js";
import { settlementRoutes } from "./routes/settlement.js";
import { adRoutes } from "./routes/ads.js";

const app = new Hono();

app.use("*", cors());

app.route("/api/auth", authRoutes);
app.route("/api/views", viewRoutes);
app.route("/api/settlement", settlementRoutes);
app.route("/api/ads", adRoutes);

app.get("/api/health", (c) => c.json({ status: "ok" }));

const port = Number(process.env.PORT) || 3001;
console.log(`HAT Backend running on port ${port}`);
serve({ fetch: app.fetch, port });
