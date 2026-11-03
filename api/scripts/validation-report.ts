// Writes validation/REPORT.md from the A1-A3 data in the repo: npm run validation:report -w api
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { assembleInputs } from "../src/validation/assemble";
import { buildReport } from "../src/validation/report";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim() + "/";
const md = buildReport(assembleInputs(root));
writeFileSync(root + "validation/REPORT.md", md);
console.log(md);
