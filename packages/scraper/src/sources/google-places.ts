import { config } from "../config.js";
import { googlePlacesLimiter } from "../pipeline/rate-limiter.js";
import type { DiscoveredBusiness } from "../types.js";

interface PlacesResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
}

interface PlacesResponse {
  places?: PlacesResult[];
  nextPageToken?: string;
}

/**
 * Discover businesses via the Google Places API (new Nearby Search).
 *
 * @param lat  Latitude of the search center
 * @param lng  Longitude of the search center
 * @param radiusMeters  Search radius in meters (max 50000)
 * @param searchQueries  Text queries to search for
 * @returns Array of discovered businesses
 */
export async function discoverViaPlacesAPI(
  lat: number,
  lng: number,
  radiusMeters: number = 40000,
  searchQueries: string[]
): Promise<DiscoveredBusiness[]> {
  const apiKey = config.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY is not configured. Set it in your environment or use scrape mode instead."
    );
  }

  const allBusinesses: DiscoveredBusiness[] = [];
  const seenPlaceIds = new Set<string>();

  for (const query of searchQueries) {
    let pageToken: string | undefined;

    do {
      await googlePlacesLimiter.acquire();

      const body: Record<string, unknown> = {
        textQuery: query,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radiusMeters,
          },
        },
        maxResultCount: 20,
      };

      if (pageToken) {
        body.pageToken = pageToken;
      }

      const response = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.location,places.rating,places.userRatingCount,places.googleMapsUri,nextPageToken",
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Google Places API error (${response.status}): ${errorText}`
        );
      }

      const data = (await response.json()) as PlacesResponse;

      if (data.places) {
        for (const place of data.places) {
          if (seenPlaceIds.has(place.id)) continue;
          seenPlaceIds.add(place.id);

          allBusinesses.push({
            name: place.displayName?.text ?? "Unknown",
            address: place.formattedAddress ?? null,
            phone: place.nationalPhoneNumber ?? null,
            website: place.websiteUri ?? null,
            lat: place.location?.latitude ?? null,
            lng: place.location?.longitude ?? null,
            place_id: place.id,
            rating: place.rating ?? null,
            review_count: place.userRatingCount ?? null,
            google_maps_url: place.googleMapsUri ?? null,
          });
        }
      }

      pageToken = data.nextPageToken;

      // Brief pause before next page to respect rate limits
      if (pageToken) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } while (pageToken);
  }

  console.log(
    `[google-places] Discovered ${allBusinesses.length} businesses via Places API`
  );
  return allBusinesses;
}
