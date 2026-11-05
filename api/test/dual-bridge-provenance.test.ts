import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { benchmarkFixture } from "./helpers/benchmark-fixture";
import { mockLlm } from "./helpers/llm";
import { easyMenu } from "./fixtures/menus";
import { apifyItems } from "./fixtures/apify-reviews";
import { runBenchmark } from "../src/validation/runner";
import { runCoverage } from "../src/validation/coverage";
import { assembleInputs } from "../src/validation/assemble";
import { buildReport } from "../src/validation/report";

it("[ai] Codex identity and unknown API cost survive A2 execution, persistence and report assembly", async () => {
  const f = benchmarkFixture();
  try {
    const llm = Object.assign(mockLlm(f.manifest.restaurants.map(() => easyMenu)), { kind: "bridge" as const, provider: "codex" as const, model: "fixture-codex" });
    const html = readFileSync(import.meta.dirname + "/fixtures/menu-easy.html", "utf8");
    const out = await runBenchmark({ root: f.root, llm, fetch: async () => new Response(html, { headers: { "content-type": "text/html" } }), promptTag: "frozen-test" });
    expect(out).toMatchObject({ model: "fixture-codex", llmPath: "codex-login-bridge" });
    expect(out.restaurants.every((r) => r.costUsd === null)).toBe(true);
    const assembled = assembleInputs(f.root);
    expect(assembled.a2).toMatchObject({ model: "fixture-codex", llmPath: "codex-login-bridge" });
    expect(buildReport(assembled)).toContain("Codex login");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

it("[ai] Codex identity survives A3 execution, persistence and assembly without A2 results", async () => {
  const f = benchmarkFixture();
  try {
    const llm = Object.assign(mockLlm(f.manifest.restaurants.filter((r) => r.tier !== "easy").map(() => ({ mentions: [] }))), { kind: "bridge" as const, provider: "codex" as const, model: "fixture-codex" });
    await runCoverage({ root: f.root, llm, fetch: async () => Response.json(apifyItems), apifyToken: "fixture", promptTag: "frozen-test" });
    const input = assembleInputs(f.root);
    expect(input.a3).toMatchObject({ model: "fixture-codex", llmPath: "codex-login-bridge" });
    expect(buildReport(input)).toContain("fixture-codex");
    expect(buildReport(input)).toContain("Codex login");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

it.each([["benchmark", "benchmark.ts"], ["coverage:a3", "coverage-a3.ts"]])("[ai] %s loads Codex provider/model settings through the real package CLI", (command, entry) => {
  const root = mkdtempSync(tmpdir() + "/codex-cli-config-");
  const api = import.meta.dirname + "/../";
  const put = (path: string, body: string) => writeFileSync(root + "/" + path, body);
  try {
    for (const dir of ["api/scripts", "api/src/llm", "api/src/menu", "api/src/validation"]) mkdirSync(root + "/" + dir, { recursive: true });
    put("package.json", '{"type":"module"}');
    put("api/.dev.vars", "PROMPT_TAG=fixture-freeze\nLLM_BRIDGE_PROVIDER=codex\nLLM_BRIDGE_MODEL=fixture-codex\nLLM_BRIDGE_URL=http://127.0.0.1:8791\n");
    put("api/scripts/" + entry, readFileSync(api + "scripts/" + entry, "utf8"));
    put("api/src/llm/select.ts", "export const selectLlm = (opts) => opts;");
    put("api/src/menu/render.ts", "export const renderingFetch = () => { throw Error('unexpected render'); };");
    put("api/src/validation/playwright-render.ts", "export const playwrightRender = () => { throw Error('unexpected render'); };");
    const run = "async (opts) => {console.log('CONFIG '+JSON.stringify(opts.llm));return {restaurants:[]};}";
    put("api/src/validation/runner.ts", `export const checkPromptsFrozen = () => {}; export const snapshotFetch = () => {}; export const runBenchmark = ${run};`);
    put("api/src/validation/coverage.ts", `export const runCoverage = ${run};`);
    execFileSync("git", ["init", "-q"], { cwd: root });
    const args = JSON.parse(readFileSync(api + "package.json", "utf8")).scripts[command].split(/\s+/).slice(1);
    const env = { ...process.env };
    for (const key of ["PROMPT_TAG", "LLM_BRIDGE_PROVIDER", "LLM_BRIDGE_MODEL", "LLM_BRIDGE_URL"]) delete env[key];
    const output = execFileSync(process.execPath, [fileURLToPath(import.meta.resolve("tsx/cli")), ...args], { cwd: root + "/api", env, encoding: "utf8" });
    expect(JSON.parse(output.split("\n").find((line) => line.startsWith("CONFIG "))!.slice(7))).toMatchObject({ bridgeProvider: "codex", bridgeModel: "fixture-codex", bridgeUrl: "http://127.0.0.1:8791" });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
