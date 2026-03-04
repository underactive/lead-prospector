export type Campaign = 'local' | 'mid' | 'remote';
export type ScrapeStatus = 'discovered' | 'enriching' | 'enriched' | 'failed';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ScrapeMode = 'api' | 'scrape';
export type ContactSource = 'website' | 'google_search' | 'directory';
export type Confidence = 'high' | 'medium' | 'low';

export interface Business {
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
  review_count: number;
  campaign: Campaign;
  scrape_status: ScrapeStatus;
  scrape_error: string | null;
  job_id: string | null;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  business_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  source: ContactSource | null;
  confidence: Confidence;
  seniority_score: number;
  created_at: string;
}

export interface ScrapeJob {
  id: string;
  user_id: string;
  status: JobStatus;
  campaign: 'local' | 'remote';
  mode: ScrapeMode;
  search_location: string;
  search_lat: number;
  search_lng: number;
  search_queries: string[];
  min_radius_miles: number;
  max_radius_miles: number;
  businesses_discovered: number;
  businesses_enriched: number;
  businesses_failed: number;
  total_contacts: number;
  error: string | null;
  log: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}
