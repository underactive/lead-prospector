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
  campaign: 'local' | 'mid' | 'remote';
  scrape_status: 'discovered' | 'enriching' | 'enriched' | 'failed';
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
  source: 'website' | 'google_search' | 'directory' | null;
  confidence: 'high' | 'medium' | 'low';
  seniority_score: number;
  created_at: string;
}

export interface CsvRow {
  'Business Name': string;
  Address: string;
  City: string;
  State: string;
  ZIP: string;
  Phone: string;
  Website: string;
  LinkedIn: string;
  'Contact Name': string;
  Title: string;
  Email: string;
  Distance: string;
  Campaign: string;
  Rating: string;
}
