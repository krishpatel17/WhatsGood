// A2 benchmark: npm run benchmark -w api [-- --snapshots]
//   ANTHROPIC_API_KEY, or LLM_BRIDGE_URL with `npm run bridge -w api` running (read from api/.dev.vars)
//   PROMPT_TAG         frozen prompts tag (default prompts-alpha-v1)
//   --render           importer v2: render JavaScript pages in a local browser before import
import { execFileSync } from "node:child_process";
import { selectLlm } from "../src/llm/select";
import { renderingFetch } from "../src/menu/render";
import { playwrightRender } from "../src/validation/playwright-render";
import { checkPromptsFrozen, runBenchmark, snapshotFetch } from "../src/validation/runner";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim() + "/";
const tag = process.env.PROMPT_TAG ?? "prompts-alpha-v1";
const git = (args: string[]) => {
  try {
    return { ok: true, out: execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }) };
  } catch {
    return { ok: false, out: "" };
  }
};

checkPromptsFrozen(tag, git);
const fromSnapshots = process.argv.includes("--snapshots");
const render = process.argv.includes("--render") ? playwrightRender() : null;
const baseFetch = fromSnapshots ? snapshotFetch(root) : fetch;
const results = await runBenchmark({
  root,
  llm: selectLlm({ apiKey: process.env.ANTHROPIC_API_KEY, bridgeUrl: process.env.LLM_BRIDGE_URL }),
  fetch: render && !fromSnapshots ? renderingFetch(baseFetch, render) : baseFetch,
  promptTag: tag,
  importer: render ? "v4" : "v1",
});
await render?.close();
for (const r of results.restaurants) {
  console.log(`${r.id.padEnd(6)} ${r.tier.padEnd(7)} ${r.status.padEnd(13)} ${r.dishes.length} dishes  ${r.seconds.toFixed(1)}s  retries ${r.retries}  $${r.costUsd.toFixed(3)}${r.failure ? `  ${r.failure}` : ""}`);
}
