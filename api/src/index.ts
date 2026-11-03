import { Hono } from "hono";
import { cors } from "hono/cors";

export type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ANTHROPIC_API_KEY?: string;
  APIFY_TOKEN?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true }));

export default app;
