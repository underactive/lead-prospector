ALTER TABLE scrape_jobs
  ADD COLUMN IF NOT EXISTS search_queries TEXT[]
    DEFAULT ARRAY['immigration lawyer', 'immigration attorney'];
