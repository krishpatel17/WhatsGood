CREATE TABLE IF NOT EXISTS menu_import_attempts (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL,
  source_url TEXT,
  attempt INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  failed_checks TEXT NOT NULL,
  created_at TEXT NOT NULL
);
