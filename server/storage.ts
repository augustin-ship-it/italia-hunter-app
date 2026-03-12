import db from "./db";
import {
  type Property,
  type SocialContent,
  type Batch,
  type ImportProperty,
  type PropertyStatus,
  type ContentApproval,
  type StatsResponse,
  type PropertyWithSocial,
} from "@shared/schema";

// Helper: convert DB row (snake_case) to Property (camelCase)
function rowToProperty(row: any): Property {
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
    status: row.status as PropertyStatus,
    batchDate: row.batch_date,
    createdAt: row.created_at,
  };
}

function rowToSocialContent(row: any): SocialContent {
  return {
    id: row.id,
    propertyId: row.property_id,
    instagramCaption: row.instagram_caption,
    twitterPost: row.twitter_post,
    reelScript: row.reel_script,
    summary: row.summary,
    carouselPhotos: row.carousel_photos ? JSON.parse(row.carousel_photos) : null,
    instagramStatus: row.instagram_status as ContentApproval,
    twitterStatus: row.twitter_status as ContentApproval,
    reelStatus: row.reel_status as ContentApproval,
    generatedAt: row.generated_at,
  };
}

function rowToBatch(row: any): Batch {
  return {
    id: row.id,
    date: row.date,
    rawCount: row.raw_count,
    qualifiedCount: row.qualified_count,
    selectedCount: row.selected_count,
    rejectedCount: row.rejected_count,
    errors: row.errors ? JSON.parse(row.errors) : null,
    status: row.status as any,
    createdAt: row.created_at,
  };
}

// Sort field mapping: camelCase API field -> snake_case DB column
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

export interface IStorage {
  getProperties(filters: {
    region?: string;
    status?: string;
    minScore?: number;
    maxScore?: number;
    minPrice?: number;
    maxPrice?: number;
    minSocialScore?: number;
    maxSocialScore?: number;
    batchDate?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ properties: Property[]; total: number }>;
  getProperty(id: number): Promise<PropertyWithSocial | undefined>;
  updatePropertyStatus(id: number, status: PropertyStatus): Promise<Property | undefined>;
  importProperties(items: ImportProperty[]): Promise<{ imported: number; skipped: number; updated: number }>;
  upsertSocialContent(propertyId: number, data: { instagramCaption: string | null; twitterPost: string | null; reelScript: string | null; summary: string | null; carouselPhotos?: string[] | null }): Promise<SocialContent>;
  getSocialContent(propertyId: number): Promise<SocialContent | undefined>;
  updateContentStatus(propertyId: number, platform: string, status: ContentApproval): Promise<SocialContent | undefined>;
  updateContentText(propertyId: number, platform: string, text: string): Promise<SocialContent | undefined>;
  getContentQueue(): Promise<PropertyWithSocial[]>;
  getBatches(): Promise<Batch[]>;
  createBatch(batch: Omit<Batch, "id" | "createdAt">): Promise<Batch>;
  getBatchProperties(date: string): Promise<Property[]>;
  getStats(): Promise<StatsResponse>;
  getAllSocialContents(): Promise<(SocialContent & { property?: { leadPhoto: string | null; town: string; province: string } })[]>;
}

export class SqliteStorage implements IStorage {

  async getProperties(filters: {
    region?: string;
    status?: string;
    minScore?: number;
    maxScore?: number;
    minPrice?: number;
    maxPrice?: number;
    minSocialScore?: number;
    maxSocialScore?: number;
    batchDate?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ properties: Property[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.region) {
      conditions.push("LOWER(region) = LOWER(?)");
      params.push(filters.region);
    }
    if (filters.status && filters.status !== "all") {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters.minScore !== undefined) {
      conditions.push("composite_score >= ?");
      params.push(filters.minScore);
    }
    if (filters.maxScore !== undefined) {
      conditions.push("composite_score <= ?");
      params.push(filters.maxScore);
    }
    if (filters.minPrice !== undefined) {
      conditions.push("price >= ?");
      params.push(filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      conditions.push("price <= ?");
      params.push(filters.maxPrice);
    }
    if (filters.minSocialScore !== undefined) {
      conditions.push("social_potential_score >= ?");
      params.push(filters.minSocialScore);
    }
    if (filters.maxSocialScore !== undefined) {
      conditions.push("social_potential_score <= ?");
      params.push(filters.maxSocialScore);
    }
    if (filters.batchDate) {
      conditions.push("batch_date = ?");
      params.push(filters.batchDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM properties ${where}`).get(...params) as any;
    const total = countRow.count;

    // Sort
    const sortParam = filters.sort || "-compositeScore";
    const desc = sortParam.startsWith("-");
    const fieldName = desc ? sortParam.slice(1) : sortParam;
    const dbColumn = sortFieldMap[fieldName] || "composite_score";
    const direction = desc ? "DESC" : "ASC";

    // Query
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const rows = db.prepare(
      `SELECT * FROM properties ${where} ORDER BY ${dbColumn} ${direction} LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as any[];

    return { properties: rows.map(rowToProperty), total };
  }

  async getProperty(id: number): Promise<PropertyWithSocial | undefined> {
    const row = db.prepare("SELECT * FROM properties WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    const property = rowToProperty(row);

    const socialRow = db.prepare("SELECT * FROM social_contents WHERE property_id = ?").get(id) as any;
    const socialContent = socialRow ? rowToSocialContent(socialRow) : null;

    return { ...property, socialContent };
  }

  async updatePropertyStatus(id: number, status: PropertyStatus): Promise<Property | undefined> {
    const row = db.prepare("SELECT * FROM properties WHERE id = ?").get(id) as any;
    if (!row) return undefined;

    // When selecting a property with social_potential >= 70 and it has social content, move to content_ready
    let finalStatus = status;
    if (status === "selected") {
      const social = db.prepare("SELECT id FROM social_contents WHERE property_id = ?").get(id);
      if (social && row.social_potential_score >= 70) {
        finalStatus = "content_ready" as PropertyStatus;
      }
    }

    db.prepare("UPDATE properties SET status = ?, updated_at = datetime('now') WHERE id = ?").run(finalStatus, id);
    const updated = db.prepare("SELECT * FROM properties WHERE id = ?").get(id) as any;
    return rowToProperty(updated);
  }

  async importProperties(items: ImportProperty[]): Promise<{ imported: number; skipped: number; updated: number }> {
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    const today = new Date().toISOString().split("T")[0];

    const insertProp = db.prepare(`
      INSERT INTO properties (
        external_id, price, size, rooms, bathrooms, title, description,
        town, province, region, address, latitude, longitude, url,
        lead_photo, photos, photos_count, raw_type, property_type,
        composite_score, value_score, sea_score, airport_score,
        location_score, character_score, social_potential_score,
        price_per_sqm, nearest_airport, airport_distance_km, distance_to_sea_km,
        status, batch_date, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'qualified', ?, datetime('now'), datetime('now')
      )
    `);

    const updateProp = db.prepare(`
      UPDATE properties SET
        price = ?, size = ?, rooms = ?, bathrooms = ?, title = ?, description = ?,
        town = ?, province = ?, region = ?, address = ?, latitude = ?, longitude = ?,
        url = ?, lead_photo = ?, photos = ?, photos_count = ?, raw_type = ?, property_type = ?,
        composite_score = ?, value_score = ?, sea_score = ?, airport_score = ?,
        location_score = ?, character_score = ?, social_potential_score = ?,
        price_per_sqm = ?, nearest_airport = ?, airport_distance_km = ?, distance_to_sea_km = ?,
        batch_date = ?, updated_at = datetime('now')
      WHERE external_id = ?
    `);

    const findByExternalId = db.prepare("SELECT id, status FROM properties WHERE external_id = ?");

    const insertSocial = db.prepare(`
      INSERT OR REPLACE INTO social_contents (
        property_id, instagram_caption, twitter_post, reel_script, summary,
        instagram_status, twitter_status, reel_status, generated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', 'pending', 'pending', datetime('now'))
    `);

    const transaction = db.transaction(() => {
      for (const item of items) {
        const existing = findByExternalId.get(item.id) as any;
        const photosJson = item.photos ? JSON.stringify(item.photos) : null;

        if (existing) {
          // Update scores, photos, etc. but preserve user-set status
          updateProp.run(
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
            today, item.id
          );

          // Update social content if provided
          if (item.summary || item.instagram_caption || item.twitter_post || item.reel_script) {
            insertSocial.run(
              existing.id,
              item.instagram_caption ?? null, item.twitter_post ?? null,
              item.reel_script ?? null, item.summary ?? null
            );
          }

          updated++;
        } else {
          // Insert new property
          const result = insertProp.run(
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
            today
          );

          const propertyId = result.lastInsertRowid as number;

          // Create social content if any exists
          if (item.summary || item.instagram_caption || item.twitter_post || item.reel_script) {
            insertSocial.run(
              propertyId,
              item.instagram_caption ?? null, item.twitter_post ?? null,
              item.reel_script ?? null, item.summary ?? null
            );
          }

          imported++;
        }
      }
    });

    transaction();

    // Update or create batch for today
    const existingBatch = db.prepare("SELECT * FROM batches WHERE date = ?").get(today) as any;
    if (existingBatch) {
      db.prepare(
        "UPDATE batches SET qualified_count = qualified_count + ?, raw_count = raw_count + ? WHERE id = ?"
      ).run(imported, items.length, existingBatch.id);
    } else {
      db.prepare(
        "INSERT INTO batches (date, raw_count, qualified_count, status) VALUES (?, ?, ?, 'completed')"
      ).run(today, items.length, imported);
    }

    return { imported, skipped, updated };
  }

  async upsertSocialContent(propertyId: number, data: {
    instagramCaption: string | null;
    twitterPost: string | null;
    reelScript: string | null;
    summary: string | null;
    carouselPhotos?: string[] | null;
  }): Promise<SocialContent> {
    const photosJson = data.carouselPhotos ? JSON.stringify(data.carouselPhotos) : null;
    db.prepare(`
      INSERT INTO social_contents (property_id, instagram_caption, twitter_post, reel_script, summary, carousel_photos, instagram_status, twitter_status, reel_status, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending', 'pending', datetime('now'))
      ON CONFLICT(property_id) DO UPDATE SET
        instagram_caption = excluded.instagram_caption,
        twitter_post = excluded.twitter_post,
        reel_script = excluded.reel_script,
        summary = excluded.summary,
        carousel_photos = excluded.carousel_photos,
        generated_at = datetime('now')
    `).run(propertyId, data.instagramCaption, data.twitterPost, data.reelScript, data.summary, photosJson);

    const row = db.prepare("SELECT * FROM social_contents WHERE property_id = ?").get(propertyId) as any;
    return rowToSocialContent(row);
  }

  async getSocialContent(propertyId: number): Promise<SocialContent | undefined> {
    const row = db.prepare("SELECT * FROM social_contents WHERE property_id = ?").get(propertyId) as any;
    return row ? rowToSocialContent(row) : undefined;
  }

  async updateContentStatus(propertyId: number, platform: string, status: ContentApproval): Promise<SocialContent | undefined> {
    const fieldMap: Record<string, string> = {
      instagram: "instagram_status",
      twitter: "twitter_status",
      reel: "reel_status",
    };
    const field = fieldMap[platform];
    if (!field) return undefined;

    db.prepare(`UPDATE social_contents SET ${field} = ? WHERE property_id = ?`).run(status, propertyId);

    const row = db.prepare("SELECT * FROM social_contents WHERE property_id = ?").get(propertyId) as any;
    if (!row) return undefined;

    const social = rowToSocialContent(row);

    // If all platforms are approved or posted, update property to content_ready
    const allApproved = [social.instagramStatus, social.twitterStatus, social.reelStatus].every(
      (s) => s === "approved" || s === "posted"
    );
    if (allApproved) {
      db.prepare(
        "UPDATE properties SET status = 'content_ready', updated_at = datetime('now') WHERE id = ? AND status != 'posted'"
      ).run(propertyId);
    }

    return social;
  }

  async updateContentText(propertyId: number, platform: string, text: string): Promise<SocialContent | undefined> {
    const fieldMap: Record<string, string> = {
      instagram: "instagram_caption",
      twitter: "twitter_post",
      reel: "reel_script",
    };
    const field = fieldMap[platform];
    if (!field) return undefined;

    db.prepare(`UPDATE social_contents SET ${field} = ? WHERE property_id = ?`).run(text, propertyId);

    const row = db.prepare("SELECT * FROM social_contents WHERE property_id = ?").get(propertyId) as any;
    return row ? rowToSocialContent(row) : undefined;
  }

  async getContentQueue(): Promise<PropertyWithSocial[]> {
    const rows = db.prepare(`
      SELECT p.*, s.id as s_id, s.property_id as s_property_id,
        s.instagram_caption, s.twitter_post, s.reel_script, s.summary as s_summary,
        s.carousel_photos as s_carousel_photos,
        s.instagram_status, s.twitter_status, s.reel_status, s.generated_at
      FROM properties p
      INNER JOIN social_contents s ON s.property_id = p.id
      ORDER BY p.social_potential_score DESC
    `).all() as any[];

    return rows.map((row) => {
      const property = rowToProperty(row);
      const socialContent: SocialContent = {
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
      };
      return { ...property, socialContent };
    });
  }

  async getBatches(): Promise<Batch[]> {
    const rows = db.prepare("SELECT * FROM batches ORDER BY date DESC").all() as any[];
    return rows.map(rowToBatch);
  }

  async createBatch(batch: Omit<Batch, "id" | "createdAt">): Promise<Batch> {
    const result = db.prepare(
      "INSERT INTO batches (date, raw_count, qualified_count, selected_count, rejected_count, errors, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      batch.date, batch.rawCount, batch.qualifiedCount, batch.selectedCount,
      batch.rejectedCount, batch.errors ? JSON.stringify(batch.errors) : null, batch.status
    );

    const row = db.prepare("SELECT * FROM batches WHERE id = ?").get(result.lastInsertRowid) as any;
    return rowToBatch(row);
  }

  async getBatchProperties(date: string): Promise<Property[]> {
    const rows = db.prepare("SELECT * FROM properties WHERE batch_date = ?").all(date) as any[];
    return rows.map(rowToProperty);
  }

  async getAllSocialContents(): Promise<(SocialContent & { property?: { leadPhoto: string | null; town: string; province: string } })[]> {
    const rows = db.prepare(`
      SELECT s.*, p.lead_photo, p.town, p.province
      FROM social_contents s
      LEFT JOIN properties p ON p.id = s.property_id
      ORDER BY s.generated_at DESC
    `).all() as any[];

    return rows.map((row) => ({
      ...rowToSocialContent(row),
      property: {
        leadPhoto: row.lead_photo,
        town: row.town,
        province: row.province,
      },
    }));
  }

  async getStats(): Promise<StatsResponse> {
    const today = new Date().toISOString().split("T")[0];

    const totalRow = db.prepare("SELECT COUNT(*) as count FROM properties").get() as any;
    const totalProperties = totalRow.count;

    const qualifiedTodayRow = db.prepare(
      "SELECT COUNT(*) as count FROM properties WHERE batch_date = ? AND status = 'qualified'"
    ).get(today) as any;
    const qualifiedToday = qualifiedTodayRow.count;

    const statusCounts = db.prepare(
      "SELECT status, COUNT(*) as count FROM properties GROUP BY status"
    ).all() as any[];

    const statusMap: Record<string, number> = {};
    for (const row of statusCounts) {
      statusMap[row.status] = row.count;
    }

    const selected = statusMap["selected"] || 0;
    const rejected = statusMap["rejected"] || 0;
    const contentReady = statusMap["content_ready"] || 0;
    const posted = statusMap["posted"] || 0;

    const pipeline = {
      qualified: statusMap["qualified"] || 0,
      selected,
      content_ready: contentReady,
      posted,
      rejected,
    };

    // Score distribution
    const ranges = [
      { range: "90-100", min: 90, max: 100 },
      { range: "80-89", min: 80, max: 89 },
      { range: "70-79", min: 70, max: 79 },
      { range: "60-69", min: 60, max: 69 },
      { range: "50-59", min: 50, max: 59 },
      { range: "0-49", min: 0, max: 49 },
    ];
    const scoreDistribution = ranges.map(({ range, min, max }) => {
      const row = db.prepare(
        "SELECT COUNT(*) as count FROM properties WHERE composite_score >= ? AND composite_score <= ?"
      ).get(min, max) as any;
      return { range, count: row.count };
    });

    // Region breakdown
    const regionRows = db.prepare(
      "SELECT region, COUNT(*) as count FROM properties GROUP BY region ORDER BY count DESC"
    ).all() as any[];
    const regionBreakdown = regionRows.map((r) => ({
      region: r.region.charAt(0).toUpperCase() + r.region.slice(1).toLowerCase(),
      count: r.count,
    }));

    // Latest batch
    const latestBatchRow = db.prepare("SELECT * FROM batches ORDER BY date DESC LIMIT 1").get() as any;
    const latestBatch = latestBatchRow ? rowToBatch(latestBatchRow) : null;

    return {
      totalProperties,
      qualifiedToday,
      selected,
      rejected,
      contentReady,
      posted,
      pipeline,
      scoreDistribution,
      regionBreakdown,
      latestBatch,
    };
  }
}

export const storage = new SqliteStorage();
