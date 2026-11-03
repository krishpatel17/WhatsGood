CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  mode TEXT NOT NULL,
  picks TEXT NOT NULL,
  explanation TEXT,
  created_at TEXT NOT NULL,
  dismissed_at TEXT
);
CREATE INDEX IF NOT EXISTS recommendations_profile ON recommendations(profile_id, created_at);
