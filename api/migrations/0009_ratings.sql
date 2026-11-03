CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  recommendation_id TEXT NOT NULL UNIQUE REFERENCES recommendations(id),
  profile_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  dish_id TEXT REFERENCES dishes(id),
  dish_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL
);
