import type { Blobs } from "../blobs";
import { type Db, newId, nowIso } from "../db";
import type { Llm, LlmContent, LlmMessage, LlmUsage } from "../llm/types";
import { MENU_IMPORT_SYSTEM } from "../prompts/menu-import";
import { fetchSource, sourceContent, textOf } from "./fetcher";
import { type Menu, MenuSchema } from "./schema";
import { layoutItemCount, validateMenu } from "./validate";

export const MAX_ATTEMPTS = 3;

export type ImportDeps = { db: Db; blobs: Blobs; llm: Llm; fetch: typeof fetch };

export type ImportResult = {
  menuId: string;
  status: "active" | "needs_review";
  attempts: number;
  dishCount: number;
  usage: LlmUsage;
  failures: string[][];
};

/** Validation for one attempt: a list of failed checks (empty means pass). */
export type Validate = (data: unknown) => { menu: Menu | null; errors: string[] };

export const schemaOnly: Validate = (data) => {
  const parsed = MenuSchema.safeParse(data);
  if (parsed.success) return { menu: parsed.data, errors: [] };
  if (data === null) return { menu: null, errors: ["output is not valid JSON"] };
  return { menu: null, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "menu"}: ${i.message}`) };
};

export function retryMessage(attempt: number, errors: string[]): string {
  return [
    `VALIDATION FAILED (attempt ${attempt}/${MAX_ATTEMPTS}):`,
    ...errors.map((e) => `- ${e}`),
    "Regenerate the full menu. Use only dishes and prices printed in the source.",
  ].join("\n");
}

export type OnAttempt = (attempt: number, errors: string[]) => Promise<void>;

/** Run the model with up to MAX_ATTEMPTS tries, feeding validation errors back each time. */
export async function extractWithRetry(llm: Llm, content: LlmContent[], validate: Validate, onAttempt: OnAttempt = async () => {}) {
  const messages: LlmMessage[] = [{ role: "user", content }];
  const usage: LlmUsage = { input_tokens: 0, output_tokens: 0 };
  const failures: string[][] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await llm.json({ task: "menu_import", system: MENU_IMPORT_SYSTEM, messages, schema: MenuSchema, effort: "medium" });
    usage.input_tokens += res.usage.input_tokens;
    usage.output_tokens += res.usage.output_tokens;
    const { menu, errors } = validate(res.data);
    await onAttempt(attempt, errors);
    if (menu && errors.length === 0) return { menu, attempts: attempt, usage, failures };
    failures.push(errors);
    messages.push({ role: "assistant", content: res.raw }, { role: "user", content: retryMessage(attempt, errors) });
  }
  return { menu: null, attempts: MAX_ATTEMPTS, usage, failures };
}

export async function storeMenu(
  db: Db,
  m: { restaurantId: string; sourceUrl: string | null; sourceType: string; snapshotKey: string; status: "active" | "needs_review"; attempts: number; dishes: Menu["dishes"] },
): Promise<string> {
  const menuId = newId();
  await db
    .prepare("INSERT INTO menus (id, restaurant_id, source_url, source_type, snapshot_key, status, attempts, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(menuId, m.restaurantId, m.sourceUrl, m.sourceType, m.snapshotKey, m.status, m.attempts, nowIso())
    .run();
  if (m.status === "active") {
    await db.prepare("UPDATE menus SET status = 'replaced' WHERE restaurant_id = ? AND status = 'active' AND id != ?").bind(m.restaurantId, menuId).run();
  }
  for (const d of m.dishes) {
    await db
      .prepare("INSERT INTO dishes (id, menu_id, restaurant_id, name, section, price, description, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(newId(), menuId, m.restaurantId, d.name, d.section, d.price, d.description, JSON.stringify(d.tags))
      .run();
  }
  return menuId;
}

export function attemptLogger(db: Db, restaurantId: string, sourceUrl: string | null): OnAttempt {
  return async (attempt, errors) => {
    await db
      .prepare("INSERT INTO menu_import_attempts (id, restaurant_id, source_url, attempt, ok, failed_checks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(newId(), restaurantId, sourceUrl, attempt, errors.length === 0 ? 1 : 0, JSON.stringify(errors), nowIso())
      .run();
  };
}

export async function importMenu(deps: ImportDeps, input: { restaurantId: string; url: string }, validate?: Validate): Promise<ImportResult> {
  const src = await fetchSource(deps.fetch, input.url);
  const snapshotKey = `snapshots/${input.restaurantId}/${Date.now()}`;
  await deps.blobs.put(snapshotKey, src.bytes, { httpMetadata: { contentType: src.contentType } });

  const text = textOf(src);
  const check = validate ?? validateMenu(text === null ? null : layoutItemCount(text));
  const run = await extractWithRetry(deps.llm, sourceContent(src), check, attemptLogger(deps.db, input.restaurantId, input.url));
  const status = run.menu ? "active" : "needs_review";
  const dishes = run.menu?.dishes ?? [];
  const menuId = await storeMenu(deps.db, {
    restaurantId: input.restaurantId,
    sourceUrl: input.url,
    sourceType: src.kind,
    snapshotKey,
    status,
    attempts: run.attempts,
    dishes,
  });
  return { menuId, status, attempts: run.attempts, dishCount: dishes.length, usage: run.usage, failures: run.failures };
}
