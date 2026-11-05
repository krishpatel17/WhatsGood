import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Blobs } from "./blobs";
import type { Db } from "./db";
import { selectLlm } from "./llm/select";
import type { Llm } from "./llm/types";
import { profileRoutes } from "./profile/routes";
import { restaurantRoutes } from "./restaurants/routes";
import { recommendationRoutes } from "./feedback/routes";
import { auditPicks } from "./audit/audit";

export type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ANTHROPIC_API_KEY?: string;
  APIFY_TOKEN?: string;
  /** Local development only: see scripts/subscription-bridge.ts. */
  LLM_BRIDGE_URL?: string;
  LLM_BRIDGE_PROVIDER?: string;
  LLM_BRIDGE_MODEL?: string;
};

export type Deps = {
  db: Db;
  blobs: Blobs;
  llm: Llm;
  fetch: typeof fetch;
  apifyToken?: string;
};

export type AppEnv = { Bindings: Env; Variables: { deps: Deps } };

export function depsFromEnv(env: Env | undefined): Partial<Deps> {
  if (!env) return {};
  const llm = selectLlm({ apiKey: env.ANTHROPIC_API_KEY, bridgeUrl: env.LLM_BRIDGE_URL, bridgeProvider: env.LLM_BRIDGE_PROVIDER, bridgeModel: env.LLM_BRIDGE_MODEL });
  return { db: env.DB, blobs: env.BUCKET, llm, fetch: (input, init) => fetch(input, init), apifyToken: env.APIFY_TOKEN };
}

/** Builds the API. Tests pass in-memory dependencies; production builds them from the Worker env. */
export function createApp(override: Partial<Deps> = {}) {
  const app = new Hono<AppEnv>();
  app.use("*", cors());
  app.use("*", async (c, next) => {
    c.set("deps", { ...depsFromEnv(c.env), ...override } as Deps);
    await next();
  });

  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/profiles", profileRoutes);
  app.route("/restaurants", restaurantRoutes);
  app.route("/recommendations", recommendationRoutes);
  app.get("/admin/audit", async (c) => c.json(await auditPicks(c.get("deps").db)));
  return app;
}
