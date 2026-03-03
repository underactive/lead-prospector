import * as cheerio from "cheerio";
import type { DiscoveredBusiness } from "../types.js";

/**
 * Best-effort scraping fallback for discovering businesses
 * when no Google Places API key is available.
 *
 * Fetches Google Maps search results and attempts to parse business listings
 * from the HTML/embedded JSON response. Google Maps is notoriously difficult
 * to scrape, so this extracts whatever data is available from the initial
 * server-rendered response.
 */
export async function discoverViaMapsScraping(
  query: string,
  lat: number,
  lng: number
): Promise<DiscoveredBusiness[]> {
  const businesses: DiscoveredBusiness[] = [];

  const searchQuery = encodeURIComponent(query);
  const url = `https://www.google.com/maps/search/${searchQuery}/@${lat},${lng},12z`;

  console.log(`[maps-scraper] Fetching: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      console.warn(
        `[maps-scraper] HTTP ${response.status} — unable to fetch Google Maps`
      );
      return businesses;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Attempt to extract embedded JSON data from script tags.
    // Google Maps embeds structured data in various script blocks.
    const scripts = $("script")
      .map((_, el) => $(el).html())
      .get();

    for (const script of scripts) {
      if (!script) continue;

      // Look for patterns that contain business listing data.
      // Google embeds data in nested arrays within script tags.
      const businessPatterns = script.match(
        /\["([^"]{2,80})",\s*"([^"]*\d{3}[^"]*)".*?"(\d\.\d)".*?"(\d+)\s*review/g
      );

      if (businessPatterns) {
        for (const match of businessPatterns) {
          const nameMatch = match.match(/\["([^"]{2,80})"/);
          const ratingMatch = match.match(/"(\d\.\d)"/);
          const reviewMatch = match.match(/"(\d+)\s*review/);

          if (nameMatch) {
            businesses.push({
              name: nameMatch[1],
              address: null,
              phone: null,
              website: null,
              lat: null,
              lng: null,
              place_id: null,
              rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
              review_count: reviewMatch ? parseInt(reviewMatch[1], 10) : null,
              google_maps_url: null,
            });
          }
        }
      }
    }

    // Also try to extract from any structured data (ld+json)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonText = $(el).html();
        if (!jsonText) return;

        const data = JSON.parse(jsonText);
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          // Accept any Schema.org type that has a name
          if (item.name) {
            businesses.push({
              name: item.name,
              address: item.address?.streetAddress ?? null,
              phone: item.telephone ?? null,
              website: item.url ?? null,
              lat: item.geo?.latitude ?? null,
              lng: item.geo?.longitude ?? null,
              place_id: null,
              rating: item.aggregateRating?.ratingValue ?? null,
              review_count: item.aggregateRating?.reviewCount ?? null,
              google_maps_url: null,
            });
          }
        }
      } catch {
        // Malformed JSON — skip
      }
    });

    // Deduplicate by name
    const seen = new Set<string>();
    const uniqueBusinesses = businesses.filter((b) => {
      const key = b.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(
      `[maps-scraper] Extracted ${uniqueBusinesses.length} businesses (best-effort scraping)`
    );
    return uniqueBusinesses;
  } catch (error) {
    console.error(
      `[maps-scraper] Scraping failed:`,
      error instanceof Error ? error.message : error
    );
    return businesses;
  }
}
