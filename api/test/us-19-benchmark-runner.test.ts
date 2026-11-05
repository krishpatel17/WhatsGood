import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("[manual] US19-R01 prompt freeze uses the exact tag and prompt path", () => {
    const git=vi.fn((args: string[])=>({ok:true,out:args[0] === "ls-files" ? "" : "abc"}));
    checkPromptsFrozen("prompts-alpha-v1",git);
    expect(git.mock.calls).toEqual([
      [["rev-parse","--verify","refs/tags/prompts-alpha-v1"]],
      [["ls-files","--others","--","api/src/prompts"]],
      [["diff","--quiet","prompts-alpha-v1","--","api/src/prompts"]],
    ]);
    git.mockReset().mockReturnValue({ok:false,out:""});
    expect(()=>checkPromptsFrozen("missing",git)).toThrow(/tag missing does not exist/);
    expect(git).toHaveBeenCalledTimes(1);
  });
  it("[manual] US19-R02 timeout records failure; late completion cannot rewrite returned or saved results", async () => {
    vi.useFakeTimers();
    try {
      let release!: (v: unknown)=>void; let started!: ()=>void; let completed=false;
      const entered=new Promise<void>(r=>{started=r;});
      const slow=mockLlm([async()=>{started();const value=await new Promise(r=>{release=r;});completed=true;return value;},easyMenu]);
      const running=runBenchmark({root,llm:slow,fetch:fakeFetch(pages),promptTag:"t",timeoutMs:50});
      await entered;
      await vi.advanceTimersByTimeAsync(50);
      const out=await running;
      expect(out.restaurants.map(r=>r.id)).toEqual(["aa","bb"]);
      expect(out.restaurants[0]).toMatchObject({status:"failed",failure:"timed out after 0.05 s",dishes:[]});
      expect(out.restaurants[1].status).toBe("active");
      const file=root+"validation/a2-benchmark/results/"+readdirSync(root+"validation/a2-benchmark/results")[0];
      const saved=readFileSync(file,"utf8");const snapshot=structuredClone(out);
      // Even an uncooperative model receives cancellation and cannot publish its late result.
      expect(slow.calls[0].signal?.aborted).toBe(true);
      expect(completed).toBe(false);release(easyMenu);await vi.advanceTimersByTimeAsync(0);
      expect(completed).toBe(true);expect(out).toEqual(snapshot);expect(readFileSync(file,"utf8")).toBe(saved);
    } finally {vi.clearAllTimers();vi.useRealTimers();}
  });

  it("[ai] a fetch error is recorded as failed with its reason", async () => {
    const out = await runBenchmark({ root, llm: mockLlm([easyMenu]), fetch: fakeFetch({ "https://bb.example/menu": pages["https://bb.example/menu"] }), promptTag: "t", timeoutMs: 5000 });
    expect(out.restaurants[0]).toMatchObject({ status: "failed", failure: expect.stringMatching(/404/) });
  });
});

describe("US-19 Benchmark runner: which importer ran", () => {
  it("[ai] AC1 integration: the results record the importer version (v1 plain download, v2 rendered pages)", async () => {
    const root = fixtureRoot();
    try {
      const pages = { "https://aa.example/menu": { body: html, contentType: "text/html" }, "https://bb.example/menu": { body: html, contentType: "text/html" } };
      const v1 = await runBenchmark({ root, llm: mockLlm([easyMenu, easyMenu]), fetch: fakeFetch(pages), promptTag: "t", timeoutMs: 5000 });
      expect(v1.importer).toBe("v1");
      const v2 = await runBenchmark({ root, llm: mockLlm([easyMenu, easyMenu]), fetch: fakeFetch(pages), promptTag: "t", timeoutMs: 5000, importer: "v2-render" });
      expect(v2.importer).toBe("v2-render");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
