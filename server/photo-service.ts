/**
 * Photo service — fetches HD photos for Italian property listings
 *
 * ⚠️ KNOWN LIMITATION: Apify currently sends only 1 photo per property
 * (lead_photo duplicated into photos[]).
 * photos_count reflects the real count on Idealista (often 30-80).
 *
 * This service:
 * 1. Tries to get HD version of Idealista photos (strip resize directive)
 * 2. Downloads & verifies photos are accessible
 * 3. Returns ordered photo list: max 4 for Twitter, max 5 for Instagram
 *
 * TODO: Update Apify actor to return all photo URLs → then enable full classification
 */

/**
 * Convert Idealista blurred/resized URL to full-size URL.
 * Pattern: https://img4.idealista.it/blur/WxH_mq/VERSION/id.pro.it.image.master/...
 * HD:      https://img4.idealista.it/blur/1920_1440_mq/VERSION/id.pro.it.image.master/...
 */
export function toHdUrl(url: string): string {
  if (!url.includes("idealista.it")) return url;
  // Replace any WxH_mq with a high-res version
  return url.replace(/\/blur\/\d+_\d+_mq\//, "/blur/1920_1440_mq/");
}

/** Check if a URL is accessible (HEAD request, timeout 5s) */
async function isAccessible(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export interface PhotoSet {
  /** Photos to use for Twitter (max 4) */
  twitter: string[];
  /** Photos to use for Instagram carousel (max 5) */
  instagram: string[];
  /** All available photos */
  all: string[];
  /** True if we successfully got HD versions */
  isHd: boolean;
}

/**
 * Build the best possible photo set from what Apify provided.
 * Tries HD versions first, falls back to originals.
 */
export async function buildPhotoSet(
  leadPhoto: string | null | undefined,
  photos: string[] | null | undefined,
  photosCount: number = 0
): Promise<PhotoSet> {
  // Collect all unique source URLs
  const sourceUrls = Array.from(new Set([
    ...(leadPhoto ? [leadPhoto] : []),
    ...(photos || []),
  ])).filter(Boolean);

  if (sourceUrls.length === 0) {
    return { twitter: [], instagram: [], all: [], isHd: false };
  }

  // Try HD versions
  const hdUrls = sourceUrls.map(toHdUrl);
  const hdResults = await Promise.all(hdUrls.map(isAccessible));

  let resolvedUrls: string[] = [];
  let isHd = false;

  if (hdResults.some(Boolean)) {
    // Use HD where available, fallback to original
    resolvedUrls = hdUrls.map((hd, i) => (hdResults[i] ? hd : sourceUrls[i]));
    isHd = hdResults.every(Boolean);
  } else {
    resolvedUrls = sourceUrls;
  }

  // Note: if photosCount >> resolvedUrls.length, more photos exist on the listing
  // but Apify didn't retrieve them. Log this for awareness.
  if (photosCount > resolvedUrls.length + 2) {
    console.log(`[photos] Property has ${photosCount} photos on listing but only ${resolvedUrls.length} retrieved by Apify. Update Apify actor to get all photos.`);
  }

  return {
    all: resolvedUrls,
    twitter: resolvedUrls.slice(0, 4),
    instagram: resolvedUrls.slice(0, 5),
    isHd,
  };
}
