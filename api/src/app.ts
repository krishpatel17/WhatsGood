import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Blobs } from "./blobs";
import type { Db } from "./db";
import { anthropicLlm } from "./llm/anthropic";
import type { Llm } from "./llm/types";
import { profileRoutes } from "./profile/routes";
import { restaurantRoutes } from "./restaurants/routes";
import { recommendationRoutes } from "./feedback/routes";

export type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ANTHROPIC_API_KEY?: string;
  APIFY_TOKEN?: string;
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
  return { db: env.DB, blobs: env.BUCKET, llm: anthropicLlm({ apiKey: env.ANTHROPIC_API_KEY }), fetch: (input, init) => fetch(input, init), apifyToken: env.APIFY_TOKEN };
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
  return app;
}
