CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  recommendation_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_type ON events(type, created_at);
