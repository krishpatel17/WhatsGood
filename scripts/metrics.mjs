// Engineering metrics for the Alpha slides: node scripts/metrics.mjs > docs/metrics.md
// Needs gh (signed in) for issue counts, and runs the test suites to count and time tests.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const sh = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// Stories from PLAN.md
const stories = new Set(readFileSync("PLAN.md", "utf8").match(/\| US-\d{2} \|/g).map((s) => s.slice(2, 7)));

// Issues in the Alpha milestone
// The repo was renamed; ask GitHub for its current name instead of trusting the local remote.
const repo = execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], { encoding: "utf8" }).trim();
const issues = JSON.parse(execFileSync("gh", ["issue", "list", "-R", repo, "--milestone", "Alpha", "--state", "all", "--limit", "200", "--json", "number,state"], { encoding: "utf8" }));
const closed = issues.filter((i) => i.state === "CLOSED").length;

// Unit and integration tests (vitest JSON reporter)
const tests = [];
for (const ws of ["api", "web"]) {
  const out = sh("npx", ["vitest", "run", "--reporter=json", "--outputFile=/tmp/wg-vitest-" + ws + ".json"], ws);
  const json = JSON.parse(readFileSync("/tmp/wg-vitest-" + ws + ".json", "utf8"));
  for (const file of json.testResults) {
    for (const t of file.assertionResults) tests.push({ ws, file: file.name, name: t.fullName, status: t.status });
  }
}
// Browser tests (playwright list; pass status from the last run in CI)
const e2e = sh("npx", ["playwright", "test", "--list", "--reporter=line"], "web").stdout.split("\n").filter((l) => /›/.test(l));
for (const l of e2e) tests.push({ ws: "web-e2e", file: l.split("›")[0], name: l, status: "listed" });

const tag = (t) => (/\[manual\]/.test(t.name) ? "manual" : /\[ai\]/.test(t.name) ? "ai" : "untagged");
const story = (t) => (t.name.match(/US-(\d{2})/) ?? t.file.match(/us-(\d{2})/i))?.[1] ?? "shared";
const byStory = {};
for (const t of tests) byStory[story(t)] = (byStory[story(t)] ?? 0) + 1;
const run = tests.filter((t) => t.status !== "listed");
const passed = run.filter((t) => t.status === "passed").length;
const cov = (ws) => (existsSync(`${ws}/coverage/coverage-summary.json`) ? JSON.parse(readFileSync(`${ws}/coverage/coverage-summary.json`, "utf8")).total.lines.pct : null);
const ai = tests.filter((t) => tag(t) === "ai").length;
const manual = tests.filter((t) => tag(t) === "manual").length;
const storyCount = Object.keys(byStory).filter((k) => k !== "shared").length;

console.log(`# Engineering metrics (generated ${new Date().toISOString().slice(0, 10)})

| Metric | Value |
|---|---|
| User stories | ${stories.size} |
| GitHub issues logged / closed | ${issues.length} / ${closed} |
| Automated tests | ${tests.length} (${tests.filter((t) => t.ws === "api").length} API, ${tests.filter((t) => t.ws === "web").length} web unit, ${e2e.length} browser e2e) |
| Average tests per issue | ${(tests.filter((t) => story(t) !== "shared").length / storyCount).toFixed(1)} (over ${storyCount} issues with tests) |
| Pass rate (unit + integration, this run) | ${passed}/${run.length} = ${((passed / run.length) * 100).toFixed(1)}% |
| Line coverage | API ${cov("api") ?? "run npm run coverage first"}%, web ${cov("web") ?? "n/a"}% |
| AI-generated : manually written tests | ${ai} : ${manual}${tests.length - ai - manual ? ` (${tests.length - ai - manual} untagged)` : ""} |

## Tests per story

| Story | Tests |
|---|---|
${Object.entries(byStory).sort().map(([k, v]) => `| ${k === "shared" ? "shared helpers" : "US-" + k} | ${v} |`).join("\n")}
`);
