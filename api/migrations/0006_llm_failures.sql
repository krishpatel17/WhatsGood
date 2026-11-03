CREATE TABLE IF NOT EXISTS llm_failures (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL,
  task TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  failed_check TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS llm_failures_restaurant ON llm_failures(restaurant_id);
