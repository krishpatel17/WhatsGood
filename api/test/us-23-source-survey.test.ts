import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isReadable, parseSurvey, SOURCE_TYPES, validateSurvey, type SurveyRow } from "../src/validation/survey";
import { parseCsv } from "../src/validation/csv";
import { listCommitPredatesFill } from "../src/validation/history";

const SURVEY = import.meta.dirname + "/../../validation/a1-survey/survey.csv";
const row = (i: number, over: Partial<SurveyRow> = {}): SurveyRow => ({
  id: `R${i}`,
  area: "The Corner",
  name: `Restaurant ${i}`,
  address: `${i} Main St`,
  source_type: "html",
  url: `https://r${i}.example/menu`,
  notes: "",
  ...over,
});
const thirty = () => Array.from({ length: 30 }, (_, i) => row(i + 1));

describe("US-23 Menu source availability survey (A1)", () => {
  it("[ai] csv parser handles quotes, commas and blank cells", () => {
    expect(parseCsv('a,b,c\n1,"x, y",\n2,"say ""hi""",z\n')).toEqual([
      { a: "1", b: "x, y", c: "" },
      { a: "2", b: 'say "hi"', c: "z" },
    ]);
  });

  it("[ai] T1 unit: the survey CSV validates: 30 rows, known source types, URL present for readable types", () => {
    expect(validateSurvey(thirty())).toEqual([]);
    expect(validateSurvey(thirty().slice(1))).toContain("expected 30 restaurants, found 29");
    const rows = thirty();
    rows[3] = row(4, { source_type: "fax" as never });
    rows[5] = row(6, { source_type: "pdf", url: "" });
    rows[7] = row(8, { source_type: "social-only", url: "" });
    expect(validateSurvey(rows)).toEqual(['R4: unknown source_type "fax"', "R6: readable source pdf needs a url"]);
  });

  it("[ai] T1 unit: the committed survey is complete and valid", () => {
    const rows = parseSurvey(readFileSync(SURVEY, "utf8"));
    expect(validateSurvey(rows)).toEqual([]);
  });

  it("[ai] T2 unit: readable flag is derived correctly from each source type", () => {
    expect(SOURCE_TYPES).toEqual(["html", "pdf", "ordering-page", "image-on-site", "third-party-only", "social-only", "none"]);
    expect(SOURCE_TYPES.filter(isReadable)).toEqual(["html", "pdf", "ordering-page", "image-on-site"]);
  });

  it("[ai] T3 unit: the restaurant list's commit predates the source-type columns being filled (checked in CI)", () => {
    const order = listCommitPredatesFill("validation/a1-survey/survey.csv");
    expect(order.listCommit, "a commit with the 30 names and empty source columns").not.toBeNull();
    expect(order.fillCommit, "a later commit that fills the source columns").not.toBeNull();
    expect(order.listIndex).toBeLessThan(order.fillIndex!);
  });
});
