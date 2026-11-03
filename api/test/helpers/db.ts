// Test double for Cloudflare D1: the same prepare/bind/first/all/run surface,
// backed by an in-memory node:sqlite database with every migration applied.
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import type { Db } from "../../src/db";

const migrationsDir = import.meta.dirname + "/../../migrations/";

export function testDb(): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    raw.exec(readFileSync(migrationsDir + f, "utf8"));
  }
  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) {
        params = values.map((v) => (v === undefined ? null : typeof v === "boolean" ? Number(v) : v));
        return stmt;
      },
      async first<T>() {
        return (raw.prepare(sql).get(...(params as never[])) as T) ?? null;
      },
      async all<T>() {
        return { results: raw.prepare(sql).all(...(params as never[])) as T[] };
      },
      async run() {
        const r = raw.prepare(sql).run(...(params as never[]));
        return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
      },
    };
    return stmt;
  };
  return { prepare, raw } as Db & { raw: DatabaseSync };
}
