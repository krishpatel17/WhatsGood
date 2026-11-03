import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Db } from "./db";
import { profileRoutes } from "./profile/routes";

export type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ANTHROPIC_API_KEY?: string;
  APIFY_TOKEN?: string;
};

export type Deps = {
  db: Db;
};

export type AppEnv = { Bindings: Env; Variables: { deps: Deps } };

export function depsFromEnv(env: Env | undefined): Partial<Deps> {
  if (!env) return {};
  return { db: env.DB };
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
  return app;
}
