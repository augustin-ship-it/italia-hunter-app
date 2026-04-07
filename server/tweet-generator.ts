import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface PropertyForTweet {
  title: string;
  description: string;
  price: number;
  size?: number | null;
  rooms?: number | null;
  bathrooms?: number | null;
  town: string;
  province: string;
  region: string;
  url: string;
  property_type?: string;
  distance_to_sea_km?: number | null;
  nearest_airport?: string | null;
  airport_distance_km?: number | null;
  price_per_m2?: number | null;
  photos_count?: number;
}

export interface GeneratedContent {
  /** Tweet 1 — the hook, with photos. Always present. */
  tweet1: string;
  /** Tweet 2 — price breakdown / arbitrage detail. Present when we have ≥2 photos. */
  tweet2?: string;
  /** Tweet 3 — lifestyle / closing + URL. Present when thread mode. */
  tweet3?: string;
  /** Instagram caption (slightly longer, no hashtags) */
  instagramCaption: string;
  /** Hashtags for Instagram first comment */
  instagramHashtags: string;
  /** Whether this is a thread (3 tweets) or single tweet */
  isThread: boolean;
}

const SYSTEM_PROMPT = `You are the voice behind @TheItalianExit on X (Twitter). You write punchy, smart, slightly contrarian tweets about Italian real estate.

Target audience: HNWI, remote workers, early retirees, global expats looking for arbitrage.

Your persona: insider who knows Italian real estate AND global finance. You've seen London, Paris, Dubai prices. You think Western cities are overpriced. You talk hard numbers, not dreams.

TONE:
- Short punchy sentences. SMS to a smart friend.
- Specific numbers: exact prices, sqm, distance, price-per-sqm
- Contrarian: Italy is the most underrated market in Europe
- No cheerleading. No selling. Just facts that speak.
- Vary the angle: sometimes pure math, sometimes scarcity, sometimes lifestyle

HARD RULES — if you break any of these the tweet is invalid:
- NO em-dashes (—) ever
- NO "nestled", "boasts", "landscape", "navigate", "leverage", "stunning", "breathtaking", "charming"
- NO exclamation marks
- NO hashtags
- NO internal commentary or meta-text (write the tweet, nothing else)
- Phrases average under 20 words
- Max 280 characters per tweet
- Minimal emojis (one house or flag per thread maximum)
- NEVER include any URL or link of any kind (no idealista.it, no http, no https, nothing)

THREAD FORMAT (when asked for a thread):
- Tweet 1: the hook. One killer visual fact. Short. Punchy. Ends with 🧵 symbol. NO URL.
- Tweet 2: the numbers. Price breakdown, comparable city data, pure arbitrage math. NO URL.
- Tweet 3: closing angle (lifestyle / scarcity / business case). NO URL.

Output format for threads: exactly 3 tweet texts separated by the literal string "---TWEET---"
Output format for single tweet: just the tweet text, nothing else
DO NOT write any explanation, label, or reasoning. Just the content.`;

export function formatPrice(price: number): string {
  if (price >= 1_000_000) return `€${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `€${Math.round(price / 1_000)}K`;
  return `€${price}`;
}

export function formatRegion(region: string): string {
  const map: Record<string, string> = {
    toscana: "Tuscany", puglia: "Puglia", sicilia: "Sicily", sardegna: "Sardinia",
    campania: "Campania", umbria: "Umbria", liguria: "Liguria", piemonte: "Piedmont",
    veneto: "Veneto", lombardia: "Lombardy", calabria: "Calabria", abruzzo: "Abruzzo",
    marche: "Le Marche", lazio: "Lazio", "emilia-romagna": "Emilia-Romagna",
    "friuli-venezia giulia": "Friuli", basilicata: "Basilicata", molise: "Molise",
  };
  return map[region.toLowerCase()] || region;
}

function buildPropertyContext(property: PropertyForTweet): string {
  const pricePerSqm = property.price_per_m2
    ? Math.round(property.price_per_m2)
    : property.size
    ? Math.round(property.price / property.size)
    : null;

  return [
    `Type: ${property.property_type || "property"}`,
    `Location: ${property.town}, ${property.province}, ${formatRegion(property.region)}`,
    `Price: ${formatPrice(property.price)}${pricePerSqm ? ` (€${pricePerSqm}/sqm)` : ""}`,
    property.size ? `Size: ${property.size}m²` : null,
    property.rooms ? `Bedrooms: ${property.rooms}` : null,
    property.bathrooms ? `Bathrooms: ${property.bathrooms}` : null,
    property.distance_to_sea_km ? `Sea: ${property.distance_to_sea_km}km from coast` : null,
    property.nearest_airport ? `Airport: ${property.airport_distance_km}km to ${property.nearest_airport}` : null,
    `Description: ${property.description.slice(0, 1000)}`,
  ].filter(Boolean).join("\n");
}

function stripUrls(text: string): string {
  // Remove any URL that Claude sneaks in despite instructions
  return text.replace(/https?:\/\/\S+/g, "").replace(/\s{2,}/g, " ").trim();
}

function enforceCharLimit(tweet: string, limit = 280): string {
  const clean = stripUrls(tweet);
  if (clean.length <= limit) return clean;
  return clean.slice(0, limit - 3) + "...";
}

export async function generateContent(
  property: PropertyForTweet,
  useThread = true
): Promise<GeneratedContent> {
  const context = buildPropertyContext(property);
  const isThread = useThread && (property.photos_count ?? 0) >= 2;

  // ── Twitter content ────────────────────────────────────────────────
  const twitterPrompt = isThread
    ? `Write a 3-tweet thread for this Italian property. Format: 3 blocks separated by "---TWEET---". No labels, no "Tweet 1:" etc.\n\nRules:\n- Tweet 1: hook + one killer fact, end with 🧵\n- Tweet 2: pure numbers/arbitrage math\n- Tweet 3: lifestyle closer\n- Each tweet max 280 chars\n- NEVER include any URL or link\n\n${context}`
    : `Write a single tweet for this Italian property. Max 280 chars. NEVER include any URL or link.\n\n${context}`;

  const twitterMsg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: twitterPrompt }],
  });

  const twitterRaw = (twitterMsg.content[0] as { text: string }).text.trim();

  let tweet1: string;
  let tweet2: string | undefined;
  let tweet3: string | undefined;

  if (isThread) {
    // Accept various separator formats Claude might output
    const parts = twitterRaw
      .split(/---\s*TWEET\s*---|\*\*Tweet\s*\d+\*\*:|Tweet\s*\d+:|^\d+\.\s/m)
      .map(s => s.trim())
      .filter(s => s.length > 20);

    tweet1 = enforceCharLimit(parts[0] || twitterRaw.slice(0, 280));
    tweet2 = parts[1] ? enforceCharLimit(parts[1]) : undefined;
    tweet3 = parts[2] ? enforceCharLimit(parts[2]) : undefined;

    // If no separator found (Claude ignored it), try to split by double newline
    if (!tweet2 && twitterRaw.includes("\n\n")) {
      const byNewline = twitterRaw.split(/\n\n+/).map(s => s.trim()).filter(s => s.length > 20);
      if (byNewline.length >= 2) {
        tweet1 = enforceCharLimit(byNewline[0]);
        tweet2 = byNewline[1] ? enforceCharLimit(byNewline[1]) : undefined;
        tweet3 = byNewline[2] ? enforceCharLimit(byNewline[2]) : undefined;
      }
    }
  } else {
    tweet1 = enforceCharLimit(twitterRaw);
  }

  // ── Instagram content ─────────────────────────────────────────────
  const igMsg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: `You write Instagram captions for @TheItalianExit. Same voice — punchy, factual, no fluff. Instagram allows 5-7 short lines. No hashtags in caption (those go in first comment). No exclamation marks. No em-dashes. NEVER include any URL or link.`,
    messages: [{
      role: "user",
      content: `Write Instagram caption for:\n${context}`,
    }],
  });

  const instagramCaption = (igMsg.content[0] as { text: string }).text.trim();

  // ── Instagram hashtags ────────────────────────────────────────────
  const region = formatRegion(property.region);
  const regionTag = `#${region.replace(/\s+/g, "")}`;
  const typeTag = property.property_type
    ? `#${property.property_type.replace(/[^a-zA-Z]/g, "")}`
    : null;
  const baseTags = ["#ItalianProperty", "#ItaliaRealEstate", "#ItalyLife", "#ItalianDream", "#ExpatsInItaly", "#RemoteWork", "#PropertyAbroad", "#RealEstatePorn", "#ItalyRealEstate", "#LuxuryRealEstate", "#ItalianVilla", "#MoveToItaly"];
  const allTags = [regionTag, ...(typeTag ? [typeTag] : []), ...baseTags].slice(0, 15);
  const instagramHashtags = allTags.join(" ");

  return { tweet1, tweet2, tweet3, instagramCaption, instagramHashtags, isThread };
}
