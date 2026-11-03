// Turns the hand-copied menu sheets into answer-key files: npm run truth -w api
// Reads validation/a2-benchmark/assignments.csv and truth/sheets/<id>.csv,
// writes truth/<id>.json and truth/spot-check/<id>.csv (the dishes the checker re-checks).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadManifest } from "../src/validation/benchmark-set";
import { parseCsv, toCsv } from "../src/validation/csv";
import { csvToTruth, spotCheckSample, validateAssignments } from "../src/validation/truth-csv";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim() + "/";
const dir = root + "validation/a2-benchmark/";
const manifest = loadManifest(root);
const assignments = parseCsv(readFileSync(dir + "assignments.csv", "utf8")) as { restaurant_id: string; name: string; menu_url: string; copied_by: string; checked_by: string; copied_on: string }[];

for (const e of validateAssignments(assignments, manifest.restaurants.map((r) => r.id))) console.log(`! ${e}`);
mkdirSync(dir + "truth/spot-check", { recursive: true });

for (const a of assignments) {
  const sheet = `${dir}truth/sheets/${a.restaurant_id}.csv`;
  const label = `${a.restaurant_id.padEnd(5)} ${a.name.padEnd(36)}`;
  if (!existsSync(sheet)) {
    console.log(`${label} no sheet`);
    continue;
  }
  if (parseCsv(readFileSync(sheet, "utf8")).length === 0) {
    console.log(`${label} not started (${a.copied_by} copies, ${a.checked_by} checks)`);
    continue;
  }
  if (!a.copied_by.trim() || !a.copied_on.trim()) {
    console.log(`${label} fill in copied_by and copied_on in assignments.csv first`);
    continue;
  }
  const { truth, errors } = csvToTruth(readFileSync(sheet, "utf8"), { restaurant_id: a.restaurant_id, copied_by: a.copied_by.trim(), copied_on: a.copied_on.trim(), source_url: a.menu_url });
  if (!truth) {
    console.log(`${label} ${errors.length === 1 && errors[0] === "no dishes copied yet" ? "not started" : "fix: " + errors.join("; ")}`);
    continue;
  }
  writeFileSync(`${dir}truth/${a.restaurant_id}.json`, JSON.stringify(truth, null, 2) + "\n");
  const spotPath = `${dir}truth/spot-check/${a.restaurant_id}.csv`;
  if (!existsSync(spotPath)) {
    const sample = spotCheckSample(truth.dishes, a.restaurant_id).map((d) => ({ ...d, correct: "", fix: "" }));
    writeFileSync(spotPath, toCsv(sample, ["section", "name", "price", "correct", "fix"]));
  }
  console.log(`${label} ${truth.dishes.length} dishes -> truth/${a.restaurant_id}.json; ${a.checked_by} checks truth/spot-check/${a.restaurant_id}.csv`);
}
