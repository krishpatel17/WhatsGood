// Node-only: runs the menu import (US-03 + US-05) over every benchmark restaurant (A2).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Blobs } from "../blobs";
import { MODEL } from "../llm/anthropic";
import { type LlmPath, llmPath } from "../llm/select";
import type { Llm } from "../llm/types";
import { importMenu } from "../menu/import";
import type { Dish } from "../menu/schema";
import { createRestaurant } from "../restaurants/repo";
import { loadManifest } from "./benchmark-set";
import { localDb } from "./localdb";

// Claude Opus 5.5 list prices, US dollars per million tokens.
export const PRICE_PER_MTOK = { input: 4, output: 20 };

export type RestaurantResult = {
  id: string;
  tier: string;
  sourceType: string;
  status: "active" | "needs_review" | "failed";
  failure: string | null;
  seconds: number;
  retries: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  snapshot: string | null;
  dishes: Dish[];
};

/** v1: plain download. v2-render: JavaScript pages rendered in a local browser first (src/menu/render.ts). */
export type Importer = "v1" | "v2-render";

export type BenchmarkResults = { promptTag: string; model: string; llmPath: LlmPath; importer?: Importer; startedAt: string; restaurants: RestaurantResult[] };

type Git = (args: string[]) => { ok: boolean; out: string };

/** Refuses to run unless the prompts in the working tree are exactly the frozen tag's. */
export function checkPromptsFrozen(tag: string, git: Git): void {
  if (!git(["rev-parse", "--verify", `refs/tags/${tag}`]).ok) throw new Error(`tag ${tag} does not exist; tag the commit you benchmark first`);
  if (!git(["diff", "--quiet", tag, "--", "api/src/prompts"]).ok) throw new Error(`prompts in api/src/prompts differ from tag ${tag}; commit and re-tag, or check out the tag`);
}

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const extFor = (contentType: string) => EXT[contentType.split(";")[0].trim()] ?? "html";

/** Wraps fetch so every fetched page is saved as validation/a2-benchmark/snapshots/<id>.<ext>. */
function recordingFetch(root: string, inner: typeof fetch, idFor: Map<string, string>, saved: Map<string, string>): typeof fetch {
  const dir = root + "validation/a2-benchmark/snapshots/";
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const res = await inner(input, init);
    const id = idFor.get(url);
    if (!id || !res.ok) return res;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "text/html";
    mkdirSync(dir, { recursive: true });
    const file = `${id}.${extFor(contentType)}`;
    writeFileSync(dir + file, bytes);
    saved.set(id, file);
    return new Response(bytes, { status: res.status, headers: { "content-type": contentType } });
  }) as typeof fetch;
}

/** A fetch that serves the saved snapshots instead of the network, so results can be reproduced. */
export function snapshotFetch(root: string): typeof fetch {
  const manifest = loadManifest(root);
  const dir = root + "validation/a2-benchmark/snapshots/";
  return (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    const entry = manifest.restaurants.find((r) => r.menu_url === url);
    if (!entry) return new Response("not in manifest", { status: 404 });
    for (const [type, ext] of [...Object.entries(EXT), ["text/html", "html"]]) {
      if (existsSync(`${dir}${entry.id}.${ext}`)) return new Response(readFileSync(`${dir}${entry.id}.${ext}`), { headers: { "content-type": type } });
    }
    return new Response("no snapshot", { status: 404 });
  }) as typeof fetch;
}

const nullBlobs: Blobs = { put: async () => null, get: async () => null };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms / 1000} s`)), ms))]);
}

export async function runBenchmark(opts: { root: string; llm: Llm; fetch: typeof fetch; promptTag: string; timeoutMs?: number; importer?: Importer }): Promise<BenchmarkResults> {
  const { root, llm, promptTag, timeoutMs = 120_000 } = opts;
  const manifest = loadManifest(root);
  const db = localDb();
  const idFor = new Map(manifest.restaurants.map((r) => [r.menu_url, r.id]));
  const saved = new Map<string, string>();
  const fetcher = recordingFetch(root, opts.fetch, idFor, saved);
  const startedAt = new Date().toISOString();
  const restaurants: RestaurantResult[] = [];

  for (const r of manifest.restaurants) {
    await createRestaurant(db, { id: r.id, name: r.name, address: "" });
    const t0 = performance.now();
    const base = { id: r.id, tier: r.tier, sourceType: r.source_type };
    try {
      const res = await withTimeout(importMenu({ db, blobs: nullBlobs, llm, fetch: fetcher }, { restaurantId: r.id, url: r.menu_url }), timeoutMs);
      const { results: dishes } = await db
        .prepare("SELECT name, section, price, description, tags FROM dishes WHERE menu_id = ?")
        .bind(res.menuId)
        .all<{ name: string; section: string; price: number | null; description: string | null; tags: string }>();
      const cost = (res.usage.input_tokens * PRICE_PER_MTOK.input + res.usage.output_tokens * PRICE_PER_MTOK.output) / 1e6;
      restaurants.push({
        ...base,
        status: res.status,
        failure: res.status === "active" ? null : `validation failed after ${res.attempts} attempts: ${res.failures.at(-1)?.join("; ")}`,
        seconds: (performance.now() - t0) / 1000,
        retries: res.attempts - 1,
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        costUsd: cost,
        snapshot: saved.get(r.id) ?? null,
        dishes: dishes.map((d) => ({ ...d, tags: JSON.parse(d.tags) })),
      });
    } catch (e) {
      restaurants.push({
        ...base,
        status: "failed",
        failure: (e as Error).message,
        seconds: (performance.now() - t0) / 1000,
        retries: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        snapshot: saved.get(r.id) ?? null,
        dishes: [],
      });
    }
  }

  const results: BenchmarkResults = { promptTag, model: MODEL, llmPath: llmPath(llm), importer: opts.importer ?? "v1", startedAt, restaurants };
  const dir = root + "validation/a2-benchmark/results/";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}${startedAt.replace(/[:.]/g, "-")}.json`, JSON.stringify(results, null, 2));
  return results;
}
