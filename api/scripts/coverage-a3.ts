// A3 review coverage: npm run coverage:a3 -w api
//   ANTHROPIC_API_KEY, APIFY_TOKEN required; PROMPT_TAG defaults to prompts-alpha-v1
import { execFileSync } from "node:child_process";
import { anthropicLlm } from "../src/llm/anthropic";
import { runCoverage } from "../src/validation/coverage";
import { checkPromptsFrozen } from "../src/validation/runner";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim() + "/";
const tag = process.env.PROMPT_TAG ?? "prompts-alpha-v1";
checkPromptsFrozen(tag, (args) => {
  try {
    return { ok: true, out: execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }) };
  } catch {
    return { ok: false, out: "" };
  }
});
const out = await runCoverage({ root, llm: anthropicLlm({ apiKey: process.env.ANTHROPIC_API_KEY }), fetch, apifyToken: process.env.APIFY_TOKEN, promptTag: tag });
console.table(out.restaurants);
console.log("Next: fill in validation/a3-coverage/to-label.csv by hand and save it as labels.csv");
