ALTER TABLE restaurants ADD COLUMN maps_url TEXT;

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  source_id TEXT NOT NULL,
  source TEXT NOT NULL,
  text TEXT NOT NULL,
  rating INTEGER,
  date TEXT,
  fetched_at TEXT NOT NULL,
  UNIQUE (restaurant_id, source_id)
);
CREATE INDEX IF NOT EXISTS reviews_restaurant ON reviews(restaurant_id);
