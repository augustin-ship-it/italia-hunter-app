import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "fs";
import path from "path";
import crypto from "crypto";

type Database = any;
let _initSqlJs: any = null;

async function loadSqlJs() {
  if (_initSqlJs) return _initSqlJs;
  // Dynamic import of sql.js (works in both ESM and CJS)
  const sqljs = await import("sql.js");
  _initSqlJs = sqljs.default || sqljs;
  return _initSqlJs;
}

// ────────────────────────────────────────────
// Authentication
// ────────────────────────────────────────────
const APP_PASSWORD = process.env.APP_PASSWORD || "ItaliaHunter2026!";
const TOKEN_SECRET = process.env.TOKEN_SECRET || "italia-hunter-secret-key-2026";

function createToken(): string {
  const payload = {
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyToken(token: string): boolean {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return false;
    const expectedSig = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest("base64url");
    if (sig !== expectedSig) return false;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────
// Singleton SQLite DB (survives warm invocations)
// ────────────────────────────────────────────
let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (db) return db;

  const initSqlJs = await loadSqlJs();
  // Locate the WASM file for sql.js
  const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  let SQL;
  if (fs.existsSync(wasmPath)) {
    const wasmBinary = fs.readFileSync(wasmPath);
    SQL = await initSqlJs({ wasmBinary });
  } else {
    // Fallback: try without WASM (will use asm.js if available)
    SQL = await initSqlJs();
  }

  // Try loading from /tmp first (persists across warm invocations)
  const tmpPath = "/tmp/italia-hunter.db";
  if (fs.existsSync(tmpPath)) {
    const buffer = fs.readFileSync(tmpPath);
    db = new SQL.Database(buffer);
    return db;
  }

  // Create fresh DB and seed it
  db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");

  // Create tables
  db.run(`
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
      photos TEXT,
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
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_properties_external_id ON properties(external_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_properties_region ON properties(region)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_properties_composite_score ON properties(composite_score)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_properties_social_score ON properties(social_potential_score)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS social_contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL UNIQUE,
      instagram_caption TEXT,
      twitter_post TEXT,
      reel_script TEXT,
      summary TEXT,
      carousel_photos TEXT,
      instagram_status TEXT NOT NULL DEFAULT 'pending',
      twitter_status TEXT NOT NULL DEFAULT 'pending',
      reel_status TEXT NOT NULL DEFAULT 'pending',
      generated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      raw_count INTEGER NOT NULL DEFAULT 0,
      qualified_count INTEGER NOT NULL DEFAULT 0,
      selected_count INTEGER NOT NULL DEFAULT 0,
      rejected_count INTEGER NOT NULL DEFAULT 0,
      errors TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Seed from seed.sql
  const seedPath = path.join(process.cwd(), "seed", "seed.sql");
  if (fs.existsSync(seedPath)) {
    const seedSql = fs.readFileSync(seedPath, "utf-8");
    const lines = seedSql.split("\n").filter((l) => l.startsWith("INSERT "));
    for (const line of lines) {
      try { db.run(line); } catch { /* skip dupes */ }
    }
    console.log(`[db] Seeded from ${seedPath}`);
  }

  // Save to /tmp for warm invocations
  const data = db.export();
  fs.writeFileSync(tmpPath, Buffer.from(data));

  return db;
}

// Save DB to /tmp after mutations
function persistDb() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync("/tmp/italia-hunter.db", Buffer.from(data));
  } catch { /* best effort */ }
}

// ────────────────────────────────────────────
// Row conversion helpers
// ────────────────────────────────────────────
function rowsToObjects(result: any): any[] {
  if (!result || !result[0]) return [];
  const { columns, values } = result[0];
  return values.map((row: any[]) => {
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function rowToProperty(row: any) {
  return {
    id: row.id,
    externalId: row.external_id,
    price: row.price,
    size: row.size,
    rooms: row.rooms,
    bathrooms: row.bathrooms,
    title: row.title,
    description: row.description,
    town: row.town,
    province: row.province,
    region: row.region,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    url: row.url,
    leadPhoto: row.lead_photo,
    photos: row.photos ? JSON.parse(row.photos) : null,
    photosCount: row.photos_count,
    rawType: row.raw_type,
    propertyType: row.property_type,
    compositeScore: row.composite_score,
    valueScore: row.value_score,
    seaScore: row.sea_score,
    airportScore: row.airport_score,
    locationScore: row.location_score,
    characterScore: row.character_score,
    socialPotentialScore: row.social_potential_score,
    pricePerSqm: row.price_per_sqm,
    nearestAirport: row.nearest_airport,
    airportDistanceKm: row.airport_distance_km,
    distanceToSeaKm: row.distance_to_sea_km,
    status: row.status,
    batchDate: row.batch_date,
    createdAt: row.created_at,
  };
}

function rowToSocialContent(row: any) {
  return {
    id: row.id,
    propertyId: row.property_id,
    instagramCaption: row.instagram_caption,
    twitterPost: row.twitter_post,
    reelScript: row.reel_script,
    summary: row.summary,
    carouselPhotos: row.carousel_photos ? JSON.parse(row.carousel_photos) : null,
    instagramStatus: row.instagram_status,
    twitterStatus: row.twitter_status,
    reelStatus: row.reel_status,
    generatedAt: row.generated_at,
  };
}

function rowToBatch(row: any) {
  return {
    id: row.id,
    date: row.date,
    rawCount: row.raw_count,
    qualifiedCount: row.qualified_count,
    selectedCount: row.selected_count,
    rejectedCount: row.rejected_count,
    errors: row.errors ? JSON.parse(row.errors) : null,
    status: row.status,
    createdAt: row.created_at,
  };
}

// Sort field mapping
const sortFieldMap: Record<string, string> = {
  compositeScore: "composite_score",
  socialPotentialScore: "social_potential_score",
  price: "price",
  valueScore: "value_score",
  characterScore: "character_score",
  locationScore: "location_score",
  seaScore: "sea_score",
  airportScore: "airport_score",
  createdAt: "created_at",
};

// ────────────────────────────────────────────
// Route handlers
// ────────────────────────────────────────────

async function handleGetProperties(db: Database, query: any) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (query.region) {
    conditions.push("LOWER(region) = LOWER(?)");
    params.push(query.region);
  }
  if (query.status && query.status !== "all") {
    conditions.push("status = ?");
    params.push(query.status);
  }
  if (query.minScore) {
    conditions.push("composite_score >= ?");
    params.push(Number(query.minScore));
  }
  if (query.maxScore) {
    conditions.push("composite_score <= ?");
    params.push(Number(query.maxScore));
  }
  if (query.minPrice) {
    conditions.push("price >= ?");
    params.push(Number(query.minPrice));
  }
  if (query.maxPrice) {
    conditions.push("price <= ?");
    params.push(Number(query.maxPrice));
  }
  if (query.minSocialScore) {
    conditions.push("social_potential_score >= ?");
    params.push(Number(query.minSocialScore));
  }
  if (query.maxSocialScore) {
    conditions.push("social_potential_score <= ?");
    params.push(Number(query.maxSocialScore));
  }
  if (query.batchDate) {
    conditions.push("batch_date = ?");
    params.push(query.batchDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = db.exec(`SELECT COUNT(*) as count FROM properties ${where}`, params);
  const total = countResult[0]?.values[0]?.[0] || 0;

  const sortParam = (query.sort as string) || "-compositeScore";
  const desc = sortParam.startsWith("-");
  const fieldName = desc ? sortParam.slice(1) : sortParam;
  const dbColumn = sortFieldMap[fieldName] || "composite_score";
  const direction = desc ? "DESC" : "ASC";

  const limit = query.limit ? Number(query.limit) : 50;
  const offset = query.offset ? Number(query.offset) : 0;

  const rows = rowsToObjects(
    db.exec(
      `SELECT * FROM properties ${where} ORDER BY ${dbColumn} ${direction} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
  );

  return { properties: rows.map(rowToProperty), total };
}

async function handleGetProperty(db: Database, id: number) {
  const rows = rowsToObjects(db.exec("SELECT * FROM properties WHERE id = ?", [id]));
  if (rows.length === 0) return null;

  const property = rowToProperty(rows[0]);
  const socialRows = rowsToObjects(db.exec("SELECT * FROM social_contents WHERE property_id = ?", [id]));
  const socialContent = socialRows.length > 0 ? rowToSocialContent(socialRows[0]) : null;

  return { ...property, socialContent };
}

async function handleGetStats(db: Database) {
  const today = new Date().toISOString().split("T")[0];

  const totalResult = db.exec("SELECT COUNT(*) as count FROM properties");
  const totalProperties = totalResult[0]?.values[0]?.[0] || 0;

  const qualifiedTodayResult = db.exec(
    "SELECT COUNT(*) as count FROM properties WHERE batch_date = ? AND status = 'qualified'",
    [today]
  );
  const qualifiedToday = qualifiedTodayResult[0]?.values[0]?.[0] || 0;

  const statusRows = rowsToObjects(
    db.exec("SELECT status, COUNT(*) as count FROM properties GROUP BY status")
  );
  const statusMap: Record<string, number> = {};
  for (const row of statusRows) {
    statusMap[row.status] = row.count;
  }

  const pipeline = {
    qualified: statusMap["qualified"] || 0,
    selected: statusMap["selected"] || 0,
    content_ready: statusMap["content_ready"] || 0,
    posted: statusMap["posted"] || 0,
    rejected: statusMap["rejected"] || 0,
  };

  const ranges = [
    { range: "90-100", min: 90, max: 100 },
    { range: "80-89", min: 80, max: 89 },
    { range: "70-79", min: 70, max: 79 },
    { range: "60-69", min: 60, max: 69 },
    { range: "50-59", min: 50, max: 59 },
    { range: "0-49", min: 0, max: 49 },
  ];
  const scoreDistribution = ranges.map(({ range, min, max }) => {
    const result = db.exec(
      "SELECT COUNT(*) as count FROM properties WHERE composite_score >= ? AND composite_score <= ?",
      [min, max]
    );
    return { range, count: result[0]?.values[0]?.[0] || 0 };
  });

  const regionRows = rowsToObjects(
    db.exec("SELECT region, COUNT(*) as count FROM properties GROUP BY region ORDER BY count DESC")
  );
  const regionBreakdown = regionRows.map((r: any) => ({
    region: r.region.charAt(0).toUpperCase() + r.region.slice(1).toLowerCase(),
    count: r.count,
  }));

  const batchRows = rowsToObjects(
    db.exec("SELECT * FROM batches ORDER BY date DESC LIMIT 1")
  );
  const latestBatch = batchRows.length > 0 ? rowToBatch(batchRows[0]) : null;

  return {
    totalProperties,
    qualifiedToday,
    selected: statusMap["selected"] || 0,
    rejected: statusMap["rejected"] || 0,
    contentReady: statusMap["content_ready"] || 0,
    posted: statusMap["posted"] || 0,
    pipeline,
    scoreDistribution,
    regionBreakdown,
    latestBatch,
  };
}

async function handleImportProperties(db: Database, items: any[]) {
  const today = new Date().toISOString().split("T")[0];
  let imported = 0, skipped = 0, updated = 0;

  for (const item of items) {
    const existing = rowsToObjects(
      db.exec("SELECT id, status FROM properties WHERE external_id = ?", [item.id])
    );
    const photosJson = item.photos ? JSON.stringify(item.photos) : null;

    if (existing.length > 0) {
      db.run(
        `UPDATE properties SET
          price=?, size=?, rooms=?, bathrooms=?, title=?, description=?,
          town=?, province=?, region=?, address=?, latitude=?, longitude=?,
          url=?, lead_photo=?, photos=?, photos_count=?, raw_type=?, property_type=?,
          composite_score=?, value_score=?, sea_score=?, airport_score=?,
          location_score=?, character_score=?, social_potential_score=?,
          price_per_sqm=?, nearest_airport=?, airport_distance_km=?, distance_to_sea_km=?,
          batch_date=?, updated_at=datetime('now')
        WHERE external_id=?`,
        [
          item.price, item.size ?? null, item.rooms ?? null, item.bathrooms ?? null,
          item.title, item.description,
          item.town, item.province, item.region, item.address ?? null,
          item.latitude ?? null, item.longitude ?? null,
          item.url, item.lead_photo ?? null, photosJson, item.photos_count ?? 0,
          item.raw_type, item.property_type,
          item.composite_score, item.value_score, item.sea_score, item.airport_score,
          item.location_score, item.character_score, item.social_potential_score ?? 0,
          item.price_per_m2 ?? null, item.nearest_airport ?? null,
          item.airport_distance_km ?? null, item.distance_to_sea_km ?? null,
          today, item.id,
        ]
      );
      updated++;
    } else {
      db.run(
        `INSERT INTO properties (
          external_id, price, size, rooms, bathrooms, title, description,
          town, province, region, address, latitude, longitude, url,
          lead_photo, photos, photos_count, raw_type, property_type,
          composite_score, value_score, sea_score, airport_score,
          location_score, character_score, social_potential_score,
          price_per_sqm, nearest_airport, airport_distance_km, distance_to_sea_km,
          status, batch_date, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'qualified',?,datetime('now'),datetime('now'))`,
        [
          item.id, item.price, item.size ?? null, item.rooms ?? null, item.bathrooms ?? null,
          item.title, item.description,
          item.town, item.province, item.region, item.address ?? null,
          item.latitude ?? null, item.longitude ?? null,
          item.url, item.lead_photo ?? null, photosJson, item.photos_count ?? 0,
          item.raw_type, item.property_type,
          item.composite_score, item.value_score, item.sea_score, item.airport_score,
          item.location_score, item.character_score, item.social_potential_score ?? 0,
          item.price_per_m2 ?? null, item.nearest_airport ?? null,
          item.airport_distance_km ?? null, item.distance_to_sea_km ?? null,
          today,
        ]
      );
      imported++;
    }
  }

  persistDb();
  return { imported, skipped, updated };
}

// ────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const url = req.url || "";
    const apiPath = url.replace(/^\/api/, "").split("?")[0];
    const method = req.method || "GET";
    const query = req.query || {};

    // ── POST /api/auth/login — public, no token needed
    if (apiPath === "/auth/login" && method === "POST") {
      const { password } = req.body || {};
      if (password === APP_PASSWORD) {
        const token = createToken();
        return res.status(200).json({ token });
      }
      return res.status(401).json({ message: "Invalid password" });
    }

    // ── GET /api/auth/verify — check if token is valid
    if (apiPath === "/auth/verify" && method === "GET") {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.replace("Bearer ", "");
      if (verifyToken(token)) {
        return res.status(200).json({ valid: true });
      }
      return res.status(401).json({ valid: false });
    }

    // ── Auth middleware: all other routes require valid token or API key
    const authHeader = req.headers.authorization || "";
    const apiKey = (req.headers["x-api-key"] as string) || "";
    const token = authHeader.replace("Bearer ", "");
    const PIPELINE_API_KEY = process.env.PIPELINE_API_KEY || "italia-pipeline-key-2026";
    const isApiKeyAuth = apiKey === PIPELINE_API_KEY;
    if (!isApiKeyAuth && !verifyToken(token)) {
      return res.status(401).json({ message: "Unauthorized — please log in" });
    }

    const database = await getDb();

    // ── GET /api/properties
    if (apiPath === "/properties" && method === "GET") {
      const result = await handleGetProperties(database, query);
      return res.status(200).json(result);
    }

    // ── GET /api/properties/:id
    const propertyMatch = apiPath.match(/^\/properties\/(\d+)$/);
    if (propertyMatch && method === "GET") {
      const id = Number(propertyMatch[1]);
      const result = await handleGetProperty(database, id);
      if (!result) return res.status(404).json({ message: "Property not found" });
      return res.status(200).json(result);
    }

    // ── PATCH /api/properties/:id/status
    const statusMatch = apiPath.match(/^\/properties\/(\d+)\/status$/);
    if (statusMatch && method === "PATCH") {
      const id = Number(statusMatch[1]);
      const { status } = req.body;
      db!.run("UPDATE properties SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);
      persistDb();
      const updated = rowsToObjects(db!.exec("SELECT * FROM properties WHERE id = ?", [id]));
      if (updated.length === 0) return res.status(404).json({ message: "Property not found" });
      return res.status(200).json(rowToProperty(updated[0]));
    }

    // ── POST /api/properties/import
    if (apiPath === "/properties/import" && method === "POST") {
      const items = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ message: "Body must be an array" });
      const result = await handleImportProperties(database, items);
      return res.status(200).json(result);
    }

    // ── GET /api/stats
    if (apiPath === "/stats" && method === "GET") {
      const result = await handleGetStats(database);
      return res.status(200).json(result);
    }

    // ── GET /api/batches
    if (apiPath === "/batches" && method === "GET") {
      const rows = rowsToObjects(database.exec("SELECT * FROM batches ORDER BY date DESC"));
      return res.status(200).json(rows.map(rowToBatch));
    }

    // ── GET /api/batches/:date/properties
    const batchPropsMatch = apiPath.match(/^\/batches\/([^/]+)\/properties$/);
    if (batchPropsMatch && method === "GET") {
      const rows = rowsToObjects(
        database.exec("SELECT * FROM properties WHERE batch_date = ?", [batchPropsMatch[1]])
      );
      return res.status(200).json(rows.map(rowToProperty));
    }

    // ── GET /api/properties/:id/social
    const socialMatch = apiPath.match(/^\/properties\/(\d+)\/social$/);
    if (socialMatch && method === "GET") {
      const id = Number(socialMatch[1]);
      const rows = rowsToObjects(database.exec("SELECT * FROM social_contents WHERE property_id = ?", [id]));
      if (rows.length === 0) return res.status(404).json({ message: "Social content not found" });
      return res.status(200).json(rowToSocialContent(rows[0]));
    }

    // ── PATCH /api/properties/:id/social/status
    const socialStatusMatch = apiPath.match(/^\/properties\/(\d+)\/social\/status$/);
    if (socialStatusMatch && method === "PATCH") {
      const id = Number(socialStatusMatch[1]);
      const { platform, status } = req.body;
      const fieldMap: Record<string, string> = {
        instagram: "instagram_status",
        twitter: "twitter_status",
        reel: "reel_status",
      };
      const field = fieldMap[platform];
      if (!field) return res.status(400).json({ message: "Invalid platform" });
      database.run(`UPDATE social_contents SET ${field} = ? WHERE property_id = ?`, [status, id]);
      persistDb();
      const rows = rowsToObjects(database.exec("SELECT * FROM social_contents WHERE property_id = ?", [id]));
      if (rows.length === 0) return res.status(404).json({ message: "Social content not found" });
      return res.status(200).json(rowToSocialContent(rows[0]));
    }

    // ── PATCH /api/properties/:id/social/text
    const socialTextMatch = apiPath.match(/^\/properties\/(\d+)\/social\/text$/);
    if (socialTextMatch && method === "PATCH") {
      const id = Number(socialTextMatch[1]);
      const { platform, text } = req.body;
      const fieldMap: Record<string, string> = {
        instagram: "instagram_caption",
        twitter: "twitter_post",
        reel: "reel_script",
      };
      const field = fieldMap[platform];
      if (!field) return res.status(400).json({ message: "Invalid platform" });
      database.run(`UPDATE social_contents SET ${field} = ? WHERE property_id = ?`, [text, id]);
      persistDb();
      const rows = rowsToObjects(database.exec("SELECT * FROM social_contents WHERE property_id = ?", [id]));
      if (rows.length === 0) return res.status(404).json({ message: "Social content not found" });
      return res.status(200).json(rowToSocialContent(rows[0]));
    }

    // ── GET /api/content-queue
    if (apiPath === "/content-queue" && method === "GET") {
      const rows = rowsToObjects(
        database.exec(`
          SELECT p.*, s.id as s_id, s.property_id as s_property_id,
            s.instagram_caption, s.twitter_post, s.reel_script, s.summary as s_summary,
            s.carousel_photos as s_carousel_photos,
            s.instagram_status, s.twitter_status, s.reel_status, s.generated_at
          FROM properties p
          INNER JOIN social_contents s ON s.property_id = p.id
          ORDER BY p.social_potential_score DESC
        `)
      );
      const result = rows.map((row: any) => ({
        ...rowToProperty(row),
        socialContent: {
          id: row.s_id,
          propertyId: row.s_property_id,
          instagramCaption: row.instagram_caption,
          twitterPost: row.twitter_post,
          reelScript: row.reel_script,
          summary: row.s_summary,
          carouselPhotos: row.s_carousel_photos ? JSON.parse(row.s_carousel_photos) : null,
          instagramStatus: row.instagram_status,
          twitterStatus: row.twitter_status,
          reelStatus: row.reel_status,
          generatedAt: row.generated_at,
        },
      }));
      return res.status(200).json(result);
    }

    // ── POST /api/social/bulk
    if (apiPath === "/social/bulk" && method === "POST") {
      const items = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ message: "Body must be an array" });
      let importCount = 0;
      for (const item of items) {
        if (!item.propertyId) continue;
        const carouselJson = item.carouselPhotos ? JSON.stringify(item.carouselPhotos) : null;
        database.run(
          `INSERT INTO social_contents (property_id, instagram_caption, twitter_post, reel_script, summary, carousel_photos, instagram_status, twitter_status, reel_status, generated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending', 'pending', datetime('now'))
           ON CONFLICT(property_id) DO UPDATE SET
             instagram_caption = excluded.instagram_caption,
             twitter_post = excluded.twitter_post,
             reel_script = excluded.reel_script,
             summary = excluded.summary,
             carousel_photos = excluded.carousel_photos,
             generated_at = datetime('now')`,
          [item.propertyId, item.instagramCaption || null, item.twitterPost || null, item.reelScript || null, item.summary || null, carouselJson]
        );
        importCount++;
      }
      persistDb();
      return res.status(200).json({ imported: importCount });
    }

    // ── GET /api/social/contents
    if (apiPath === "/social/contents" && method === "GET") {
      const rows = rowsToObjects(
        database.exec(`
          SELECT s.*, p.lead_photo, p.town, p.province
          FROM social_contents s
          LEFT JOIN properties p ON p.id = s.property_id
          ORDER BY s.generated_at DESC
        `)
      );
      const contents = rows.map((row: any) => ({
        ...rowToSocialContent(row),
        property: {
          leadPhoto: row.lead_photo,
          town: row.town,
          province: row.province,
        },
      }));
      return res.status(200).json({ contents });
    }

    // ── POST /api/batches
    if (apiPath === "/batches" && method === "POST") {
      const batch = req.body;
      database.run(
        "INSERT INTO batches (date, raw_count, qualified_count, selected_count, rejected_count, errors, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [batch.date, batch.rawCount || 0, batch.qualifiedCount || 0, batch.selectedCount || 0, batch.rejectedCount || 0, batch.errors ? JSON.stringify(batch.errors) : null, batch.status || "completed"]
      );
      persistDb();
      const rows = rowsToObjects(database.exec("SELECT * FROM batches ORDER BY id DESC LIMIT 1"));
      return res.status(201).json(rows.length > 0 ? rowToBatch(rows[0]) : {});
    }

    // ── POST /api/buffer/publish
    if (apiPath === "/buffer/publish" && method === "POST") {
      const { propertyId, platform } = req.body;
      if (!propertyId || !platform) {
        return res.status(400).json({ message: "propertyId and platform are required" });
      }
      if (!["instagram", "twitter"].includes(platform)) {
        return res.status(400).json({ message: "Platform must be instagram or twitter" });
      }

      // Get property and social content
      const propRows = rowsToObjects(database.exec("SELECT * FROM properties WHERE id = ?", [propertyId]));
      if (propRows.length === 0) return res.status(404).json({ message: "Property not found" });
      const socialRows = rowsToObjects(database.exec("SELECT * FROM social_contents WHERE property_id = ?", [propertyId]));
      if (socialRows.length === 0) return res.status(404).json({ message: "Social content not found" });
      const social = rowToSocialContent(socialRows[0]);

      // Check approved
      const statusKey = platform === "instagram" ? "instagramStatus" : "twitterStatus";
      if ((social as any)[statusKey] !== "approved") {
        return res.status(400).json({ message: `Content must be approved. Current: ${(social as any)[statusKey]}` });
      }

      const BUFFER_TOKEN = (process.env.BUFFER_TOKEN || "H5wEKXsJAJctr0cTYMDTUs1UbD0zZWUPnfv19IxhRpq").trim();
      const BUFFER_IG_CHANNEL = (process.env.BUFFER_IG_CHANNEL || "69b336d87be9f8b1714da537").trim();
      const BUFFER_X_CHANNEL = (process.env.BUFFER_X_CHANNEL || "69b337177be9f8b1714da5e4").trim();

      const channelId = platform === "instagram" ? BUFFER_IG_CHANNEL : BUFFER_X_CHANNEL;
      const text = platform === "instagram" ? social.instagramCaption : social.twitterPost;
      if (!text) return res.status(400).json({ message: `No ${platform} content found` });

      // Build assets - validate image URLs
      const photos: string[] = social.carouselPhotos || [];
      let assets: any = undefined;
      const maxPhotos = platform === "twitter" ? 4 : photos.length;
      if (photos.length > 0) {
        const validPhotos: string[] = [];
        for (const url of photos.slice(0, maxPhotos)) {
          try {
            const check = await fetch(url, { method: "HEAD" });
            if (check.ok && Number(check.headers.get("content-length") || "0") > 0) {
              validPhotos.push(url);
            }
          } catch { /* skip */ }
        }
        if (validPhotos.length > 0) {
          assets = { images: validPhotos.map((u: string) => ({ url: u })) };
        }
      }

      // IG metadata
      let metadata: any = undefined;
      if (platform === "instagram") {
        metadata = { instagram: { type: assets?.images?.length > 1 ? "carousel" : "post", shouldShareToFeed: true } };
      }

      const mutation = `mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess { post { id status text } }
          ... on NotFoundError { message }
          ... on UnauthorizedError { message }
          ... on UnexpectedError { message }
          ... on InvalidInputError { message }
          ... on LimitReachedError { message }
          ... on RestProxyError { message code }
        }
      }`;

      const input: any = { channelId, text, schedulingType: "automatic", mode: "shareNow" };
      if (assets) input.assets = assets;
      if (metadata) input.metadata = metadata;

      const bufferRes = await fetch("https://api.buffer.com/graphql", {
        method: "POST",
        headers: { "Authorization": `Bearer ${BUFFER_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: mutation, variables: { input } }),
      });
      const bufferData = await bufferRes.json();

      if (bufferData.errors) {
        return res.status(502).json({ message: "Buffer API error", errors: bufferData.errors });
      }
      const result = bufferData.data?.createPost;
      if (result?.post) {
        // Mark as posted
        const field = platform === "instagram" ? "instagram_status" : "twitter_status";
        database.run(`UPDATE social_contents SET ${field} = 'posted' WHERE property_id = ?`, [propertyId]);
        persistDb();
        return res.status(200).json({ success: true, bufferPostId: result.post.id, status: result.post.status, platform });
      } else {
        return res.status(502).json({ message: result?.message || "Unknown Buffer error" });
      }
    }

    return res.status(404).json({ message: `Route not found: ${method} /api${apiPath}` });
  } catch (error: any) {
    console.error("API Error:", error);
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
}
