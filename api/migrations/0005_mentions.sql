CREATE TABLE IF NOT EXISTS mentions (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  review_id TEXT NOT NULL REFERENCES reviews(id),
  dish_id TEXT REFERENCES dishes(id),
  mention TEXT NOT NULL,
  sentiment REAL NOT NULL,
  quote TEXT NOT NULL,
  score REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS mentions_restaurant ON mentions(restaurant_id);
CREATE INDEX IF NOT EXISTS mentions_dish ON mentions(dish_id);
