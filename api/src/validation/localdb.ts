// Node-only stand-in for Cloudflare D1 (tests and local scripts): the same prepare/bind/first/all/run surface,
// backed by an in-memory node:sqlite database with every migration applied.
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import type { Db, Stmt } from "../db";

const migrationsDir = import.meta.dirname + "/../../migrations/";

export function localDb(): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    raw.exec(readFileSync(migrationsDir + f, "utf8"));
  }
  const execute = new WeakMap<Stmt, () => unknown>();
  const prepare = (sql: string): Stmt => {
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
      async run() { return execute.get(stmt)!(); },
    };
    execute.set(stmt, () => {
      const r = raw.prepare(sql).run(...(params as never[]));
      return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    });
    return stmt;
  };
  // Execute synchronously inside a real SQLite transaction, matching D1 batch atomicity.
  const batch = async (statements: Stmt[]) => {
    raw.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((stmt) => execute.get(stmt)!());
      raw.exec("COMMIT");
      return results;
    } catch (error) {
      raw.exec("ROLLBACK");
      throw error;
    }
  };
  return { prepare, batch, raw };
}
