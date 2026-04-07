/**
 * Real Estate Porn Score — calculates virality potential for Italian properties
 * Score 0-100 based on keywords, location, price, photos availability
 */

interface ScorerInput {
  title: string;
  description: string;
  price: number;
  size?: number | null;
  photos_count?: number;
  region: string;
  distance_to_sea_km?: number | null;
  property_type?: string;
}

const POOL_KEYWORDS = /\bpiscin[ae]\b|\bpool\b|\bswimming\b/i;
const SEA_KEYWORDS = /vista\s*mare|sea\s*view|ocean\s*view|vista\s*lago|lake\s*view|fronte\s*mare|waterfront/i;
const EXTERIOR_KEYWORDS = /terrazza|terrace|giardino|garden|parco\b|panorami|loggia|cortile|balcon|veranda|pergola|patio/i;
const RENOVATION_DONE_KEYWORDS = /restaur|ristruttur|renovated|restored|restored|charming|prestigi|lusso|luxury|elegant/i;
const CHARACTER_KEYWORDS = /farmhouse|casale|masseria|villa|palazzo|trullo|trabocco|castle|borgo|torre|mulino|antico|storico|historic/i;

const PREMIUM_REGIONS = new Set([
  'toscana', 'tuscany', 'campania', 'sardegna', 'sardinia',
  'puglia', 'apulia', 'sicilia', 'sicily', 'umbria', 'liguria',
  'venezia', 'veneto', 'lombardia', 'lago di como', 'amalfi',
]);

export function computeRealEstatePornScore(p: ScorerInput): number {
  const text = `${p.title} ${p.description}`;
  let score = 0;

  // Pool (biggest viral driver) — +25
  if (POOL_KEYWORDS.test(text)) score += 25;

  // Sea / lake view — +20
  if (
    SEA_KEYWORDS.test(text) ||
    (p.distance_to_sea_km != null && p.distance_to_sea_km < 3)
  ) score += 20;

  // Photos available — +15 if plenty, +8 if few
  const photoCount = p.photos_count ?? 0;
  if (photoCount >= 8) score += 15;
  else if (photoCount >= 4) score += 8;
  else if (photoCount >= 1) score += 3;

  // Price signal for HNWI audience — luxury = aspirational
  if (p.price > 1_000_000) score += 15;
  else if (p.price > 500_000) score += 12;
  else if (p.price > 200_000) score += 6;
  // Very cheap = arbitrage porn
  else if (p.price < 100_000) score += 10;

  // Exterior features — +10
  if (EXTERIOR_KEYWORDS.test(text)) score += 10;

  // Premium region — +10
  const regionLower = p.region.toLowerCase();
  if (PREMIUM_REGIONS.has(regionLower) || [...PREMIUM_REGIONS].some(r => regionLower.includes(r))) {
    score += 10;
  }

  // Large property — +5
  if (p.size && p.size > 300) score += 5;
  else if (p.size && p.size > 150) score += 3;

  // Character / prestige property type — +5
  if (CHARACTER_KEYWORDS.test(text)) score += 5;

  return Math.min(Math.round(score), 100);
}

/** Minimum score to enter the review queue */
export const REVIEW_SCORE_THRESHOLD = 35;
/** Minimum photos to enter the review queue */
export const REVIEW_MIN_PHOTOS = 1;
