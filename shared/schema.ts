import { z } from "zod";

// Property status enum — pipeline stages
export const propertyStatusEnum = z.enum(["qualified", "selected", "rejected", "emailed", "content_ready", "posted"]);
export type PropertyStatus = z.infer<typeof propertyStatusEnum>;

// Content approval status per platform
export const contentApprovalEnum = z.enum(["pending", "approved", "rejected", "posted"]);
export type ContentApproval = z.infer<typeof contentApprovalEnum>;

// Batch status enum
export const batchStatusEnum = z.enum(["completed", "running", "failed"]);
export type BatchStatus = z.infer<typeof batchStatusEnum>;

// Property schema
export const propertySchema = z.object({
  id: z.number(),
  externalId: z.string(),
  price: z.number(),
  size: z.number().nullable(),
  rooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  title: z.string(),
  description: z.string(),
  town: z.string(),
  province: z.string(),
  region: z.string(),
  address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  url: z.string(),
  leadPhoto: z.string().nullable(),
  photos: z.array(z.string()).nullable(),
  photosCount: z.number().default(0),
  rawType: z.string(),
  propertyType: z.string(),
  compositeScore: z.number(),
  valueScore: z.number(),
  seaScore: z.number(),
  airportScore: z.number(),
  locationScore: z.number(),
  characterScore: z.number(),
  socialPotentialScore: z.number().default(0),
  pricePerSqm: z.number().nullable(),
  nearestAirport: z.string().nullable(),
  airportDistanceKm: z.number().nullable(),
  distanceToSeaKm: z.number().nullable(),
  status: propertyStatusEnum.default("qualified"),
  batchDate: z.string(),
  createdAt: z.string(),
});

export type Property = z.infer<typeof propertySchema>;

// Social content schema with per-platform approval
export const socialContentSchema = z.object({
  id: z.number(),
  propertyId: z.number(),
  instagramCaption: z.string().nullable(),
  instagramFirstComment: z.string().nullable(),
  twitterPost: z.string().nullable(),
  reelScript: z.string().nullable(),
  summary: z.string().nullable(),
  carouselPhotos: z.array(z.string()).nullable(),
  instagramStatus: contentApprovalEnum.default("pending"),
  twitterStatus: contentApprovalEnum.default("pending"),
  reelStatus: contentApprovalEnum.default("pending"),
  generatedAt: z.string().nullable(),
});

export type SocialContent = z.infer<typeof socialContentSchema>;

// Batch schema
export const batchSchema = z.object({
  id: z.number(),
  date: z.string(),
  rawCount: z.number(),
  qualifiedCount: z.number(),
  selectedCount: z.number().default(0),
  rejectedCount: z.number().default(0),
  errors: z.array(z.string()).nullable(),
  status: batchStatusEnum,
  createdAt: z.string(),
});

export type Batch = z.infer<typeof batchSchema>;

// Import payload schema (snake_case from Python)
export const importPropertySchema = z.object({
  id: z.string(),
  price: z.number(),
  size: z.number().nullable().optional(),
  rooms: z.number().nullable().optional(),
  bathrooms: z.number().nullable().optional(),
  title: z.string(),
  description: z.string().default(""),
  town: z.string(),
  province: z.string(),
  region: z.string(),
  address: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  url: z.string(),
  lead_photo: z.string().nullable().optional(),
  photos: z.array(z.string()).nullable().optional(),
  photos_count: z.number().optional().default(0),
  raw_type: z.string().default(""),
  property_type: z.string().default(""),
  composite_score: z.number().default(0),
  value_score: z.number().default(0),
  sea_score: z.number().default(0),
  airport_score: z.number().default(0),
  location_score: z.number().default(0),
  character_score: z.number().default(0),
  social_potential_score: z.number().default(0),
  price_per_m2: z.number().nullable().optional(),
  nearest_airport: z.string().nullable().optional(),
  airport_distance_km: z.number().nullable().optional(),
  distance_to_sea_km: z.number().nullable().optional(),
  summary: z.string().nullable().optional(),
  instagram_caption: z.string().nullable().optional(),
  twitter_post: z.string().nullable().optional(),
  reel_script: z.string().nullable().optional(),
});

export type ImportProperty = z.infer<typeof importPropertySchema>;

// Pipeline stats response
export interface PipelineStats {
  qualified: number;
  selected: number;
  content_ready: number;
  posted: number;
  rejected: number;
}

// Stats response
export interface StatsResponse {
  totalProperties: number;
  qualifiedToday: number;
  selected: number;
  rejected: number;
  contentReady: number;
  posted: number;
  pipeline: PipelineStats;
  scoreDistribution: { range: string; count: number }[];
  regionBreakdown: { region: string; count: number }[];
  latestBatch: Batch | null;
}

// Property with social content
export interface PropertyWithSocial extends Property {
  socialContent: SocialContent | null;
}
