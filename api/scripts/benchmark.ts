// A2 benchmark: npm run benchmark -w api [-- --snapshots]
//   ANTHROPIC_API_KEY  required
//   PROMPT_TAG         frozen prompts tag (default prompts-alpha-v1)
import { execFileSync } from "node:child_process";
import { anthropicLlm } from "../src/llm/anthropic";
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
const results = await runBenchmark({
  root,
  llm: anthropicLlm({ apiKey: process.env.ANTHROPIC_API_KEY }),
  fetch: fromSnapshots ? snapshotFetch(root) : fetch,
  promptTag: tag,
});
for (const r of results.restaurants) {
  console.log(`${r.id.padEnd(6)} ${r.tier.padEnd(7)} ${r.status.padEnd(13)} ${r.dishes.length} dishes  ${r.seconds.toFixed(1)}s  retries ${r.retries}  $${r.costUsd.toFixed(3)}${r.failure ? `  ${r.failure}` : ""}`);
}
