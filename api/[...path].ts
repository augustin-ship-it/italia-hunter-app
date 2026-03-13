import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

// ────────────────────────────────────────────
// Supabase REST API config
// ────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ddvdkavznseinkgmfeiy.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdmRrYXZ6bnNlaW5rZ21mZWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzgyMDUsImV4cCI6MjA4ODkxNDIwNX0.jw1AugJ55FQIUOvw59q4MufEIm6qIs6d83s7fN4YNvs";

const supabaseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

async function supabase(
  table: string,
  opts: {
    method?: string;
    query?: string;
    body?: any;
    prefer?: string;
    single?: boolean;
  } = {}
): Promise<any> {
  const method = opts.method || "GET";
  const qs = opts.query || "";
  const url = `${SUPABASE_URL}/rest/v1/${table}${qs ? `?${qs}` : ""}`;
  const headers: Record<string, string> = { ...supabaseHeaders };
  if (opts.prefer) headers["Prefer"] = opts.prefer;
  // For single-row returns
  if (opts.single) headers["Accept"] = "application/vnd.pgrst.object+json";

  const fetchOpts: RequestInit = { method, headers };
  if (opts.body !== undefined) fetchOpts.body = JSON.stringify(opts.body);

  const resp = await fetch(url, fetchOpts);
  if (resp.status === 204) return null;
  if (resp.status === 406 && opts.single) return null; // no rows found
  const data = await resp.json();
  if (resp.status >= 400) {
    const msg = typeof data === "object" && data.message ? data.message : JSON.stringify(data);
    throw new Error(`Supabase ${resp.status}: ${msg}`);
  }
  return data;
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
// Row conversion helpers (snake_case → camelCase)
// ────────────────────────────────────────────
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
    photos: typeof row.photos === "string" ? JSON.parse(row.photos) : row.photos,
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
    instagramFirstComment: row.instagram_first_comment,
    twitterPost: row.twitter_post,
    reelScript: row.reel_script,
    summary: row.summary,
    carouselPhotos: typeof row.carousel_photos === "string" ? JSON.parse(row.carousel_photos) : row.carousel_photos,
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
    errors: typeof row.errors === "string" ? JSON.parse(row.errors) : row.errors,
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

async function handleGetProperties(query: any) {
  const filters: string[] = [];

  if (query.region) filters.push(`region=ilike.${query.region}`);
  if (query.status && query.status !== "all") filters.push(`status=eq.${query.status}`);
  if (query.minScore) filters.push(`composite_score=gte.${Number(query.minScore)}`);
  if (query.maxScore) filters.push(`composite_score=lte.${Number(query.maxScore)}`);
  if (query.minPrice) filters.push(`price=gte.${Number(query.minPrice)}`);
  if (query.maxPrice) filters.push(`price=lte.${Number(query.maxPrice)}`);
  if (query.minSocialScore) filters.push(`social_potential_score=gte.${Number(query.minSocialScore)}`);
  if (query.maxSocialScore) filters.push(`social_potential_score=lte.${Number(query.maxSocialScore)}`);
  if (query.propertyType) filters.push(`property_type=ilike.${query.propertyType}`);
  if (query.batchDate) filters.push(`batch_date=eq.${query.batchDate}`);

  const sortParam = (query.sort as string) || "-compositeScore";
  const desc = sortParam.startsWith("-");
  const fieldName = desc ? sortParam.slice(1) : sortParam;
  const dbColumn = sortFieldMap[fieldName] || "composite_score";
  const order = `${dbColumn}.${desc ? "desc" : "asc"}`;

  const limit = query.limit ? Number(query.limit) : 50;
  const offset = query.offset ? Number(query.offset) : 0;

  // Get count via HEAD + Prefer: count=exact
  const countUrl = `${SUPABASE_URL}/rest/v1/properties?select=id&${filters.join("&")}`;
  const countResp = await fetch(countUrl, {
    method: "HEAD",
    headers: {
      ...supabaseHeaders,
      Prefer: "count=exact",
    },
  });
  const contentRange = countResp.headers.get("content-range") || "";
  const total = contentRange.includes("/") ? Number(contentRange.split("/")[1]) : 0;

  // Get rows
  const qs = [
    "select=*",
    ...filters,
    `order=${order}`,
    `limit=${limit}`,
    `offset=${offset}`,
  ].join("&");

  const rows = await supabase("properties", { query: qs });
  return { properties: (rows || []).map(rowToProperty), total };
}

async function handleGetProperty(id: number) {
  const row = await supabase("properties", {
    query: `select=*&id=eq.${id}`,
    single: true,
  });
  if (!row) return null;

  const property = rowToProperty(row);
  const socialRows = await supabase("social_contents", {
    query: `select=*&property_id=eq.${id}`,
  });
  const socialContent = socialRows && socialRows.length > 0 ? rowToSocialContent(socialRows[0]) : null;

  return { ...property, socialContent };
}

async function handleGetStats() {
  const today = new Date().toISOString().split("T")[0];

  // Total count
  const totalResp = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=id`, {
    method: "HEAD",
    headers: { ...supabaseHeaders, Prefer: "count=exact" },
  });
  const totalRange = totalResp.headers.get("content-range") || "";
  const totalProperties = totalRange.includes("/") ? Number(totalRange.split("/")[1]) : 0;

  // Qualified today
  const qualTodayResp = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=id&batch_date=eq.${today}&status=eq.qualified`, {
    method: "HEAD",
    headers: { ...supabaseHeaders, Prefer: "count=exact" },
  });
  const qualRange = qualTodayResp.headers.get("content-range") || "";
  const qualifiedToday = qualRange.includes("/") ? Number(qualRange.split("/")[1]) : 0;

  // Status counts — fetch all properties' statuses
  const allStatuses = await supabase("properties", { query: "select=status" });
  const statusMap: Record<string, number> = {};
  for (const row of allStatuses || []) {
    statusMap[row.status] = (statusMap[row.status] || 0) + 1;
  }

  const pipeline = {
    qualified: statusMap["qualified"] || 0,
    selected: statusMap["selected"] || 0,
    content_ready: statusMap["content_ready"] || 0,
    posted: statusMap["posted"] || 0,
    rejected: statusMap["rejected"] || 0,
  };

  // Score distribution
  const allScores = await supabase("properties", { query: "select=composite_score" });
  const ranges = [
    { range: "90-100", min: 90, max: 100 },
    { range: "80-89", min: 80, max: 89 },
    { range: "70-79", min: 70, max: 79 },
    { range: "60-69", min: 60, max: 69 },
    { range: "50-59", min: 50, max: 59 },
    { range: "0-49", min: 0, max: 49 },
  ];
  const scoreDistribution = ranges.map(({ range, min, max }) => {
    const count = (allScores || []).filter(
      (r: any) => r.composite_score >= min && r.composite_score <= max
    ).length;
    return { range, count };
  });

  // Region breakdown
  const allRegions = await supabase("properties", { query: "select=region" });
  const regionCounts: Record<string, number> = {};
  for (const r of allRegions || []) {
    const key = r.region || "Unknown";
    regionCounts[key] = (regionCounts[key] || 0) + 1;
  }
  const regionBreakdown = Object.entries(regionCounts)
    .map(([region, count]) => ({
      region: region.charAt(0).toUpperCase() + region.slice(1).toLowerCase(),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Latest batch
  const batchRows = await supabase("batches", {
    query: "select=*&order=date.desc&limit=1",
  });
  const latestBatch = batchRows && batchRows.length > 0 ? rowToBatch(batchRows[0]) : null;

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

async function handleImportProperties(items: any[]) {
  const today = new Date().toISOString().split("T")[0];
  let imported = 0, skipped = 0, updated = 0;

  for (const item of items) {
    const existing = await supabase("properties", {
      query: `select=id,status&external_id=eq.${encodeURIComponent(item.id)}`,
    });
    const photosJson = item.photos ? JSON.stringify(item.photos) : null;
    const now = new Date().toISOString();

    if (existing && existing.length > 0) {
      await supabase("properties", {
        method: "PATCH",
        query: `external_id=eq.${encodeURIComponent(item.id)}`,
        body: {
          price: item.price,
          size: item.size ?? null,
          rooms: item.rooms ?? null,
          bathrooms: item.bathrooms ?? null,
          title: item.title,
          description: item.description,
          town: item.town,
          province: item.province,
          region: item.region,
          address: item.address ?? null,
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          url: item.url,
          lead_photo: item.lead_photo ?? null,
          photos: photosJson,
          photos_count: item.photos_count ?? 0,
          raw_type: item.raw_type,
          property_type: item.property_type,
          composite_score: item.composite_score,
          value_score: item.value_score,
          sea_score: item.sea_score,
          airport_score: item.airport_score,
          location_score: item.location_score,
          character_score: item.character_score,
          social_potential_score: item.social_potential_score ?? 0,
          price_per_sqm: item.price_per_m2 ?? null,
          nearest_airport: item.nearest_airport ?? null,
          airport_distance_km: item.airport_distance_km ?? null,
          distance_to_sea_km: item.distance_to_sea_km ?? null,
          batch_date: today,
          updated_at: now,
        },
        prefer: "return=minimal",
      });
      updated++;
    } else {
      await supabase("properties", {
        method: "POST",
        body: {
          external_id: item.id,
          price: item.price,
          size: item.size ?? null,
          rooms: item.rooms ?? null,
          bathrooms: item.bathrooms ?? null,
          title: item.title,
          description: item.description,
          town: item.town,
          province: item.province,
          region: item.region,
          address: item.address ?? null,
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          url: item.url,
          lead_photo: item.lead_photo ?? null,
          photos: photosJson,
          photos_count: item.photos_count ?? 0,
          raw_type: item.raw_type,
          property_type: item.property_type,
          composite_score: item.composite_score,
          value_score: item.value_score,
          sea_score: item.sea_score,
          airport_score: item.airport_score,
          location_score: item.location_score,
          character_score: item.character_score,
          social_potential_score: item.social_potential_score ?? 0,
          price_per_sqm: item.price_per_m2 ?? null,
          nearest_airport: item.nearest_airport ?? null,
          airport_distance_km: item.airport_distance_km ?? null,
          distance_to_sea_km: item.distance_to_sea_km ?? null,
          status: "qualified",
          batch_date: today,
          created_at: now,
          updated_at: now,
        },
        prefer: "return=minimal",
      });
      imported++;
    }
  }

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

    // ── GET /api/properties
    if (apiPath === "/properties" && method === "GET") {
      const result = await handleGetProperties(query);
      return res.status(200).json(result);
    }

    // ── GET /api/properties/:id
    const propertyMatch = apiPath.match(/^\/properties\/(\d+)$/);
    if (propertyMatch && method === "GET") {
      const id = Number(propertyMatch[1]);
      const result = await handleGetProperty(id);
      if (!result) return res.status(404).json({ message: "Property not found" });
      return res.status(200).json(result);
    }

    // ── PATCH /api/properties/:id/status
    const statusMatch = apiPath.match(/^\/properties\/(\d+)\/status$/);
    if (statusMatch && method === "PATCH") {
      const id = Number(statusMatch[1]);
      const { status } = req.body;
      await supabase("properties", {
        method: "PATCH",
        query: `id=eq.${id}`,
        body: { status, updated_at: new Date().toISOString() },
        prefer: "return=minimal",
      });
      const updated = await supabase("properties", {
        query: `select=*&id=eq.${id}`,
        single: true,
      });
      if (!updated) return res.status(404).json({ message: "Property not found" });
      return res.status(200).json(rowToProperty(updated));
    }

    // ── POST /api/properties/import
    if (apiPath === "/properties/import" && method === "POST") {
      const items = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ message: "Body must be an array" });
      const result = await handleImportProperties(items);
      return res.status(200).json(result);
    }

    // ── GET /api/stats
    if (apiPath === "/stats" && method === "GET") {
      const result = await handleGetStats();
      return res.status(200).json(result);
    }

    // ── GET /api/batches
    if (apiPath === "/batches" && method === "GET") {
      const rows = await supabase("batches", { query: "select=*&order=date.desc" });
      return res.status(200).json((rows || []).map(rowToBatch));
    }

    // ── GET /api/batches/:date/properties
    const batchPropsMatch = apiPath.match(/^\/batches\/([^/]+)\/properties$/);
    if (batchPropsMatch && method === "GET") {
      const rows = await supabase("properties", {
        query: `select=*&batch_date=eq.${encodeURIComponent(batchPropsMatch[1])}`,
      });
      return res.status(200).json((rows || []).map(rowToProperty));
    }

    // ── GET /api/properties/:id/social
    const socialMatch = apiPath.match(/^\/properties\/(\d+)\/social$/);
    if (socialMatch && method === "GET") {
      const id = Number(socialMatch[1]);
      const rows = await supabase("social_contents", {
        query: `select=*&property_id=eq.${id}`,
      });
      if (!rows || rows.length === 0) return res.status(404).json({ message: "Social content not found" });
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

      await supabase("social_contents", {
        method: "PATCH",
        query: `property_id=eq.${id}`,
        body: { [field]: status },
        prefer: "return=minimal",
      });

      // Auto-sync property status based on social content status
      const socialRows = await supabase("social_contents", {
        query: `select=instagram_status,twitter_status&property_id=eq.${id}`,
      });
      if (socialRows && socialRows.length > 0) {
        const s = socialRows[0];
        const igStatus = s.instagram_status;
        const twStatus = s.twitter_status;
        const now = new Date().toISOString();
        if (igStatus === "posted" && twStatus === "posted") {
          await supabase("properties", {
            method: "PATCH",
            query: `id=eq.${id}`,
            body: { status: "posted", updated_at: now },
            prefer: "return=minimal",
          });
        } else if (igStatus === "approved" && twStatus === "approved") {
          await supabase("properties", {
            method: "PATCH",
            query: `id=eq.${id}`,
            body: { status: "content_ready", updated_at: now },
            prefer: "return=minimal",
          });
        } else if (igStatus === "approved" || twStatus === "approved") {
          // At least one approved — mark as selected if still qualified
          await supabase("properties", {
            method: "PATCH",
            query: `id=eq.${id}&status=eq.qualified`,
            body: { status: "selected", updated_at: now },
            prefer: "return=minimal",
          });
        }
      }

      const rows = await supabase("social_contents", {
        query: `select=*&property_id=eq.${id}`,
      });
      if (!rows || rows.length === 0) return res.status(404).json({ message: "Social content not found" });
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

      await supabase("social_contents", {
        method: "PATCH",
        query: `property_id=eq.${id}`,
        body: { [field]: text },
        prefer: "return=minimal",
      });

      const rows = await supabase("social_contents", {
        query: `select=*&property_id=eq.${id}`,
      });
      if (!rows || rows.length === 0) return res.status(404).json({ message: "Social content not found" });
      return res.status(200).json(rowToSocialContent(rows[0]));
    }

    // ── GET /api/content-queue
    if (apiPath === "/content-queue" && method === "GET") {
      // Fetch social contents with their linked properties
      const socialRows = await supabase("social_contents", {
        query: "select=*,properties(*)",
      });
      if (!socialRows || socialRows.length === 0) return res.status(200).json([]);

      // Sort by property's social_potential_score desc
      const sorted = socialRows.sort(
        (a: any, b: any) => (b.properties?.social_potential_score || 0) - (a.properties?.social_potential_score || 0)
      );

      const result = sorted.map((row: any) => {
        const prop = row.properties;
        if (!prop) return null;
        return {
          ...rowToProperty(prop),
          socialContent: rowToSocialContent(row),
        };
      }).filter(Boolean);

      return res.status(200).json(result);
    }

    // ── POST /api/social/bulk
    if (apiPath === "/social/bulk" && method === "POST") {
      const items = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ message: "Body must be an array" });
      let importCount = 0;
      const now = new Date().toISOString();

      for (const item of items) {
        if (!item.propertyId) continue;
        const carouselJson = item.carouselPhotos ? JSON.stringify(item.carouselPhotos) : null;

        // Upsert social content (on_conflict property_id)
        await supabase("social_contents", {
          method: "POST",
          body: {
            property_id: item.propertyId,
            instagram_caption: item.instagramCaption || null,
            instagram_first_comment: item.instagramFirstComment || null,
            twitter_post: item.twitterPost || null,
            reel_script: item.reelScript || null,
            summary: item.summary || null,
            carousel_photos: carouselJson,
            instagram_status: "pending",
            twitter_status: "pending",
            reel_status: "pending",
            generated_at: now,
          },
          prefer: "return=minimal,resolution=merge-duplicates",
        });

        // Auto-set property status to 'selected' when content is generated
        await supabase("properties", {
          method: "PATCH",
          query: `id=eq.${item.propertyId}&status=eq.qualified`,
          body: { status: "selected", updated_at: now },
          prefer: "return=minimal",
        });
        importCount++;
      }

      return res.status(200).json({ imported: importCount });
    }

    // ── GET /api/social/contents
    if (apiPath === "/social/contents" && method === "GET") {
      const rows = await supabase("social_contents", {
        query: "select=*,properties(lead_photo,town,province)&order=generated_at.desc",
      });
      const contents = (rows || []).map((row: any) => ({
        ...rowToSocialContent(row),
        property: row.properties
          ? {
              leadPhoto: row.properties.lead_photo,
              town: row.properties.town,
              province: row.properties.province,
            }
          : null,
      }));
      return res.status(200).json({ contents });
    }

    // ── POST /api/batches
    if (apiPath === "/batches" && method === "POST") {
      const batch = req.body;
      const inserted = await supabase("batches", {
        method: "POST",
        body: {
          date: batch.date,
          raw_count: batch.rawCount || 0,
          qualified_count: batch.qualifiedCount || 0,
          selected_count: batch.selectedCount || 0,
          rejected_count: batch.rejectedCount || 0,
          errors: batch.errors ? JSON.stringify(batch.errors) : null,
          status: batch.status || "completed",
          created_at: new Date().toISOString(),
        },
        prefer: "return=representation",
      });
      const result = Array.isArray(inserted) ? inserted[0] : inserted;
      return res.status(201).json(result ? rowToBatch(result) : {});
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
      const prop = await supabase("properties", {
        query: `select=*&id=eq.${propertyId}`,
        single: true,
      });
      if (!prop) return res.status(404).json({ message: "Property not found" });

      const socialRows = await supabase("social_contents", {
        query: `select=*&property_id=eq.${propertyId}`,
      });
      if (!socialRows || socialRows.length === 0) return res.status(404).json({ message: "Social content not found" });
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

      // Build assets from carousel photos
      const photos: string[] = social.carouselPhotos || [];
      const maxPhotos = platform === "twitter" ? 4 : photos.length;
      const photoUrls = photos.slice(0, maxPhotos);

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

      // Helper to attempt Buffer post
      async function attemptBufferPost(withPhotos: string[]) {
        const input: any = { channelId, text, schedulingType: "automatic", mode: "shareNow" };
        if (withPhotos.length > 0) {
          input.assets = { images: withPhotos.map((u: string) => ({ url: u })) };
        }
        if (platform === "instagram") {
          const igMeta: any = { type: withPhotos.length > 1 ? "carousel" : "post", shouldShareToFeed: true };
          if (social.instagramFirstComment) {
            igMeta.firstComment = social.instagramFirstComment;
          }
          input.metadata = { instagram: igMeta };
        }
        const r = await fetch("https://api.buffer.com/graphql", {
          method: "POST",
          headers: { Authorization: `Bearer ${BUFFER_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: mutation, variables: { input } }),
        });
        return r.json();
      }

      // Try with photos first, fall back to fewer photos or text-only
      let bufferData = await attemptBufferPost(photoUrls);
      if (bufferData.data?.createPost?.message && photoUrls.length > 0) {
        if (photoUrls.length > 1) {
          bufferData = await attemptBufferPost([photoUrls[0]]);
        }
        if (bufferData.data?.createPost?.message && platform === "twitter") {
          bufferData = await attemptBufferPost([]);
        }
      }

      if (bufferData.errors) {
        return res.status(502).json({ message: "Buffer API error", errors: bufferData.errors });
      }
      const result = bufferData.data?.createPost;
      if (result?.post) {
        const field = platform === "instagram" ? "instagram_status" : "twitter_status";
        await supabase("social_contents", {
          method: "PATCH",
          query: `property_id=eq.${propertyId}`,
          body: { [field]: "posted" },
          prefer: "return=minimal",
        });
        // Auto-sync property status
        const afterPost = await supabase("social_contents", {
          query: `select=instagram_status,twitter_status&property_id=eq.${propertyId}`,
        });
        if (afterPost && afterPost.length > 0 && afterPost[0].instagram_status === "posted" && afterPost[0].twitter_status === "posted") {
          await supabase("properties", {
            method: "PATCH",
            query: `id=eq.${propertyId}`,
            body: { status: "posted", updated_at: new Date().toISOString() },
            prefer: "return=minimal",
          });
        }
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
