-- Add log column for streaming pipeline output to the frontend
ALTER TABLE scrape_jobs ADD COLUMN IF NOT EXISTS log TEXT DEFAULT '';
