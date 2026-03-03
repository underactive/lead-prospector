CREATE TABLE scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  campaign TEXT NOT NULL CHECK (campaign IN ('local', 'remote')),
  mode TEXT NOT NULL DEFAULT 'scrape' CHECK (mode IN ('api', 'scrape')),
  search_location TEXT NOT NULL DEFAULT 'Austin, TX',
  search_lat DOUBLE PRECISION NOT NULL DEFAULT 30.2672,
  search_lng DOUBLE PRECISION NOT NULL DEFAULT -97.7431,
  min_radius_miles REAL DEFAULT 0,
  max_radius_miles REAL NOT NULL,
  firms_discovered INT DEFAULT 0,
  firms_enriched INT DEFAULT 0,
  firms_failed INT DEFAULT 0,
  total_contacts INT DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE firms ADD CONSTRAINT fk_firms_job
  FOREIGN KEY (job_id) REFERENCES scrape_jobs(id) ON DELETE SET NULL;

CREATE INDEX idx_jobs_user ON scrape_jobs(user_id);
CREATE INDEX idx_jobs_status ON scrape_jobs(status);
