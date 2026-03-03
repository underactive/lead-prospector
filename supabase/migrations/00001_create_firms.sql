CREATE TABLE firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_place_id TEXT,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'TX',
  zip TEXT,
  phone TEXT,
  website TEXT,
  google_maps_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_miles DOUBLE PRECISION,
  linkedin_url TEXT,
  yelp_url TEXT,
  rating REAL,
  review_count INT DEFAULT 0,
  campaign TEXT NOT NULL CHECK (campaign IN ('local', 'mid', 'remote')),
  scrape_status TEXT DEFAULT 'discovered'
    CHECK (scrape_status IN ('discovered', 'enriching', 'enriched', 'failed')),
  scrape_error TEXT,
  job_id UUID,
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_place_id)
);

CREATE INDEX idx_firms_user ON firms(user_id);
CREATE INDEX idx_firms_campaign ON firms(campaign);
CREATE INDEX idx_firms_distance ON firms(distance_miles);
CREATE INDEX idx_firms_status ON firms(scrape_status);
