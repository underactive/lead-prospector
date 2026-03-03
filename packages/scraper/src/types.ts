export type Campaign = "local" | "mid" | "remote";

export type ScrapeMode = "api" | "scrape";

export interface Firm {
  id: string;
  user_id: string;
  google_place_id: string | null;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  google_maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_miles: number | null;
  linkedin_url: string | null;
  yelp_url: string | null;
  rating: number | null;
  review_count: number | null;
  campaign: Campaign | null;
  scrape_status: string | null;
  scrape_error: string | null;
  job_id: string | null;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  firm_id: string;
  user_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  source: string | null;
  confidence: number | null;
  seniority_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface ScrapeJob {
  id: string;
  user_id: string;
  status: string;
  campaign: string | null;
  mode: ScrapeMode | null;
  firms_discovered: number;
  firms_enriched: number;
  total_contacts: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveredFirm {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  rating: number | null;
  review_count: number | null;
  google_maps_url: string | null;
}

export interface ExtractedContact {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  source: string | null;
  confidence: number;
  seniority_score: number;
}

export interface JobStartPayload {
  jobId: string;
  userId: string;
  campaign: "local" | "remote";
  mode: ScrapeMode;
  searchLocation: string;
  searchLat: number;
  searchLng: number;
}
