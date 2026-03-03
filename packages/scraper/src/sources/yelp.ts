import { config } from "../config.js";
import { yelpLimiter } from "../pipeline/rate-limiter.js";

interface YelpBusiness {
  url: string;
  rating: number;
  review_count: number;
  name: string;
}

interface YelpSearchResponse {
  businesses?: YelpBusiness[];
}

/**
 * Search Yelp for a business and return its Yelp profile data.
 *
 * @param businessName  Name of the business to search for
 * @param location  Location string (e.g., "Austin, TX")
 * @returns Yelp URL, rating, and review count (or empty object if no API key)
 */
export async function searchYelp(
  businessName: string,
  location: string
): Promise<{ yelpUrl?: string; rating?: number; reviewCount?: number }> {
  const apiKey = config.YELP_API_KEY;

  if (!apiKey) {
    // Graceful degradation: no API key configured
    return {};
  }

  try {
    await yelpLimiter.acquire();

    const params = new URLSearchParams({
      term: businessName,
      location,
      limit: "3",
    });

    const response = await fetch(
      `https://api.yelp.com/v3/businesses/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      console.warn(
        `[yelp] HTTP ${response.status} searching for "${businessName}"`
      );
      return {};
    }

    const data = (await response.json()) as YelpSearchResponse;

    if (!data.businesses || data.businesses.length === 0) {
      return {};
    }

    // Find the best match by name similarity
    const normalizedBusiness = businessName.toLowerCase().trim();
    const match =
      data.businesses.find((b) =>
        b.name.toLowerCase().includes(normalizedBusiness)
      ) ??
      data.businesses.find((b) =>
        normalizedBusiness.includes(b.name.toLowerCase())
      ) ??
      data.businesses[0];

    console.log(
      `[yelp] Found Yelp listing for "${businessName}": ${match.url}`
    );

    return {
      yelpUrl: match.url,
      rating: match.rating,
      reviewCount: match.review_count,
    };
  } catch (error) {
    console.error(
      `[yelp] Error searching for "${businessName}":`,
      error instanceof Error ? error.message : error
    );
    return {};
  }
}
