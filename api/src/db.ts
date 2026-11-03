// The subset of Cloudflare D1 the app uses. D1Database satisfies it in
// production; tests use an in-memory SQLite double with the same shape.
export interface Stmt {
  bind(...values: unknown[]): Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface Db {
  prepare(sql: string): Stmt;
}

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
