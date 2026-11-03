CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  area TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  reviews_fetched_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS menus (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  source_url TEXT,
  source_type TEXT NOT NULL,
  snapshot_key TEXT,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS menus_restaurant ON menus(restaurant_id);

CREATE TABLE IF NOT EXISTS dishes (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id),
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  section TEXT NOT NULL,
  price REAL,
  description TEXT,
  tags TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS dishes_menu ON dishes(menu_id);
