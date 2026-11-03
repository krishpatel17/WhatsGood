// Prints a Markdown table of line coverage per workspace from vitest's json-summary output.
import { existsSync, readFileSync } from "node:fs";

const workspaces = ["api", "web"];
console.log("| Workspace | Lines | Statements | Branches | Functions |");
console.log("|---|---|---|---|---|");
for (const ws of workspaces) {
  const file = `${ws}/coverage/coverage-summary.json`;
  if (!existsSync(file)) continue;
  const { total } = JSON.parse(readFileSync(file, "utf8"));
  const pct = (k) => `${total[k].pct}%`;
  console.log(`| ${ws} | ${pct("lines")} | ${pct("statements")} | ${pct("branches")} | ${pct("functions")} |`);
}
