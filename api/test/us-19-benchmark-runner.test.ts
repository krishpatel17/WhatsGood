import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { checkPromptsFrozen, runBenchmark, snapshotFetch } from "../src/validation/runner";
import { mockLlm } from "./helpers/llm";
import { fakeFetch } from "./helpers/blobs";
import { easyMenu } from "./fixtures/menus";

const html = readFileSync(import.meta.dirname + "/fixtures/menu-easy.html", "utf8");

function fixtureRoot() {
  const root = mkdtempSync(tmpdir() + "/bench-") + "/";
  mkdirSync(root + "validation/a2-benchmark/truth", { recursive: true });
  const entry = (id: string, tier: string) => ({ id, survey_id: id.toUpperCase(), name: `Restaurant ${id}`, tier, source_type: "html", menu_url: `https://${id}.example/menu`, review_source: "google-maps", maps_url: "https://maps.example" });
  writeFileSync(root + "validation/a2-benchmark/manifest.json", JSON.stringify({ created: "2026-11-03", rule: "test", restaurants: [entry("aa", "easy"), entry("bb", "hard")] }));
  return root;
}

describe("US-19 Benchmark runner", () => {
  let root: string;
  beforeEach(() => {
    root = fixtureRoot();
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const pages = { "https://aa.example/menu": { body: html, contentType: "text/html" }, "https://bb.example/menu": { body: html, contentType: "text/html" } };

  it("[ai] T1 integration: runner over 2 fixture restaurants (mocked LLM) writes a results file with every field", async () => {
    const llm = mockLlm([easyMenu, { dishes: easyMenu.dishes.slice(0, 1) }, easyMenu]);
    const out = await runBenchmark({ root, llm, fetch: fakeFetch(pages), promptTag: "prompts-test", timeoutMs: 5000 });
    const files = readdirSync(root + "validation/a2-benchmark/results");
    expect(files).toHaveLength(1);
    const saved = JSON.parse(readFileSync(root + "validation/a2-benchmark/results/" + files[0], "utf8"));
    expect(saved).toEqual(out);
    expect(saved.promptTag).toBe("prompts-test");
    expect(saved.model).toBe("claude-opus-5-5");
    expect(saved.llmPath).toBe("anthropic-api");
    expect(saved.restaurants).toHaveLength(2);
    for (const r of saved.restaurants) {
      expect(Object.keys(r).sort()).toEqual(["costUsd", "dishes", "failure", "id", "inputTokens", "outputTokens", "retries", "seconds", "snapshot", "sourceType", "status", "tier"]);
    }
    expect(saved.restaurants[0]).toMatchObject({ id: "aa", status: "active", retries: 0, failure: null });
    expect(saved.restaurants[0].dishes).toHaveLength(5);
    expect(saved.restaurants[1]).toMatchObject({ id: "bb", status: "active", retries: 1 });
    expect(saved.restaurants[0].costUsd).toBeCloseTo((1000 * 4 + 200 * 20) / 1e6, 6);
  });

  it("[ai] AC3 integration: snapshots are saved and a re-run can use them without the network", async () => {
    await runBenchmark({ root, llm: mockLlm([easyMenu, easyMenu]), fetch: fakeFetch(pages), promptTag: "t", timeoutMs: 5000 });
    expect(existsSync(root + "validation/a2-benchmark/snapshots/aa.html")).toBe(true);
    const offline = snapshotFetch(root);
    const rerun = await runBenchmark({ root, llm: mockLlm([easyMenu, easyMenu]), fetch: offline, promptTag: "t", timeoutMs: 5000 });
    expect(rerun.restaurants.every((r) => r.status === "active")).toBe(true);
  });

  it("[ai] T2 unit: the run aborts if the working tree's prompts differ from the frozen tag", () => {
    const git = (args: string[]) => (args[0] === "rev-parse" ? { ok: true, out: "abc" } : { ok: false, out: "" });
    expect(() => checkPromptsFrozen("prompts-alpha-v1", git)).toThrow(/differ from tag prompts-alpha-v1/);
    const missing = () => ({ ok: false, out: "" });
    expect(() => checkPromptsFrozen("prompts-alpha-v1", missing)).toThrow(/tag prompts-alpha-v1 does not exist/);
    const clean = () => ({ ok: true, out: "" });
    expect(() => checkPromptsFrozen("prompts-alpha-v1", clean)).not.toThrow();
  });

  it("[ai] T3 unit: a restaurant that times out is recorded as failed, not skipped", async () => {
    const slow = mockLlm([() => new Promise((r) => setTimeout(() => r(easyMenu), 500)), easyMenu]);
    const out = await runBenchmark({ root, llm: slow, fetch: fakeFetch(pages), promptTag: "t", timeoutMs: 50 });
    expect(out.restaurants.map((r) => r.id)).toEqual(["aa", "bb"]);
    expect(out.restaurants[0]).toMatchObject({ status: "failed", failure: "timed out after 0.05 s", dishes: [] });
    expect(out.restaurants[1].status).toBe("active");
  });

  it("[ai] a fetch error is recorded as failed with its reason", async () => {
    const out = await runBenchmark({ root, llm: mockLlm([easyMenu]), fetch: fakeFetch({ "https://bb.example/menu": pages["https://bb.example/menu"] }), promptTag: "t", timeoutMs: 5000 });
    expect(out.restaurants[0]).toMatchObject({ status: "failed", failure: expect.stringMatching(/404/) });
  });
});
