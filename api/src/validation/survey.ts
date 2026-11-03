import { parseCsv } from "./csv";

export const SOURCE_TYPES = ["html", "pdf", "ordering-page", "image-on-site", "third-party-only", "social-only", "none"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SURVEY_SIZE = 30;

export type SurveyRow = { id: string; area: string; name: string; address: string; source_type: SourceType | ""; url: string; notes: string };

const READABLE: SourceType[] = ["html", "pdf", "ordering-page", "image-on-site"];

export function isReadable(t: string): boolean {
  return READABLE.includes(t as SourceType);
}

export function parseSurvey(text: string): SurveyRow[] {
  return parseCsv(text) as SurveyRow[];
}

export function validateSurvey(rows: SurveyRow[]): string[] {
  const errors: string[] = [];
  if (rows.length !== SURVEY_SIZE) errors.push(`expected ${SURVEY_SIZE} restaurants, found ${rows.length}`);
  for (const r of rows) {
    if (!SOURCE_TYPES.includes(r.source_type as SourceType)) errors.push(`${r.id}: unknown source_type "${r.source_type}"`);
    else if (isReadable(r.source_type) && !r.url) errors.push(`${r.id}: readable source ${r.source_type} needs a url`);
  }
  return errors;
}
