import Database from "better-sqlite3";
import path from "path";

// Resolve project root - works in both ESM (dev) and CJS (production)
const PROJECT_ROOT = path.resolve(
  typeof __dirname !== "undefined"
    ? path.join(__dirname, "..")
    : path.join(process.cwd())
);

// Use DATA_DIR env var if set (Railway persistent volume), otherwise local data/
const DATA_DIR = process.env.DATA_DIR || path.resolve(PROJECT_ROOT, "data");
const DB_PATH = path.resolve(DATA_DIR, "italia-hunter.db");

// Ensure data directory exists
import fs from "fs";
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT NOT NULL UNIQUE,
    price REAL NOT NULL,
    size REAL,
    rooms INTEGER,
    bathrooms INTEGER,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    town TEXT NOT NULL,
    province TEXT NOT NULL,
    region TEXT NOT NULL,
    address TEXT,
    latitude REAL,
    longitude REAL,
    url TEXT NOT NULL,
    lead_photo TEXT,
    photos TEXT, -- JSON array
    photos_count INTEGER NOT NULL DEFAULT 0,
    raw_type TEXT NOT NULL DEFAULT '',
    property_type TEXT NOT NULL DEFAULT '',
    composite_score REAL NOT NULL DEFAULT 0,
    value_score REAL NOT NULL DEFAULT 0,
    sea_score REAL NOT NULL DEFAULT 0,
    airport_score REAL NOT NULL DEFAULT 0,
    location_score REAL NOT NULL DEFAULT 0,
    character_score REAL NOT NULL DEFAULT 0,
    social_potential_score REAL NOT NULL DEFAULT 0,
    price_per_sqm REAL,
    nearest_airport TEXT,
    airport_distance_km REAL,
    distance_to_sea_km REAL,
    status TEXT NOT NULL DEFAULT 'qualified',
    batch_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_properties_external_id ON properties(external_id);
  CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
  CREATE INDEX IF NOT EXISTS idx_properties_region ON properties(region);
  CREATE INDEX IF NOT EXISTS idx_properties_batch_date ON properties(batch_date);
  CREATE INDEX IF NOT EXISTS idx_properties_composite_score ON properties(composite_score);
  CREATE INDEX IF NOT EXISTS idx_properties_social_score ON properties(social_potential_score);

  CREATE TABLE IF NOT EXISTS social_contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL UNIQUE,
    instagram_caption TEXT,
    twitter_post TEXT,
    reel_script TEXT,
    summary TEXT,
    instagram_status TEXT NOT NULL DEFAULT 'pending',
    twitter_status TEXT NOT NULL DEFAULT 'pending',
    reel_status TEXT NOT NULL DEFAULT 'pending',
    generated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_social_property_id ON social_contents(property_id);

  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    raw_count INTEGER NOT NULL DEFAULT 0,
    qualified_count INTEGER NOT NULL DEFAULT 0,
    selected_count INTEGER NOT NULL DEFAULT 0,
    rejected_count INTEGER NOT NULL DEFAULT 0,
    errors TEXT, -- JSON array
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_batches_date ON batches(date);
`);

// Seed from SQL dump if database is empty (first deploy)
const count = (db.prepare("SELECT COUNT(*) as c FROM properties").get() as any).c;
if (count === 0) {
  const seedPath = path.resolve(
    typeof __dirname !== "undefined" ? path.join(__dirname, "..") : process.cwd(),
    "seed",
    "seed.sql"
  );
  if (fs.existsSync(seedPath)) {
    console.log(`[db] Seeding database from ${seedPath}...`);
    // Read seed SQL, skip CREATE TABLE/INDEX statements (already created above)
    const seedSql = fs.readFileSync(seedPath, "utf-8");
    const lines = seedSql.split("\n").filter(
      (l) => l.startsWith("INSERT ")
    );
    if (lines.length > 0) {
      db.exec("BEGIN TRANSACTION;");
      for (const line of lines) {
        try { db.exec(line); } catch (e) { /* skip dupes */ }
      }
      db.exec("COMMIT;");
      const newCount = (db.prepare("SELECT COUNT(*) as c FROM properties").get() as any).c;
      console.log(`[db] Seeded ${newCount} properties`);
    }
  }
}

export default db;
export { DB_PATH };
