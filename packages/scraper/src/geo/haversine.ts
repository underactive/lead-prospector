import type { Campaign } from "../types.js";

const EARTH_RADIUS_MILES = 3959;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the great-circle distance between two points on Earth
 * using the Haversine formula.
 *
 * @returns Distance in miles
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

/**
 * Categorize a firm into a campaign tier based on distance from the search center.
 *
 * - local: < 10 miles
 * - mid: 10-25 miles
 * - remote: > 25 miles
 */
export function categorizeCampaign(distanceMiles: number): Campaign {
  if (distanceMiles < 10) return "local";
  if (distanceMiles <= 25) return "mid";
  return "remote";
}
