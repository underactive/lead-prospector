-- Migration: Rename firms → businesses throughout the schema
-- This makes the data model generic (not law-firm-specific)

BEGIN;

-- ─── 1. Rename table ──────────────────────────────────────────────────────────

ALTER TABLE firms RENAME TO businesses;

-- ─── 2. Rename columns on scrape_jobs ─────────────────────────────────────────

ALTER TABLE scrape_jobs RENAME COLUMN firms_discovered TO businesses_discovered;
ALTER TABLE scrape_jobs RENAME COLUMN firms_enriched TO businesses_enriched;
ALTER TABLE scrape_jobs RENAME COLUMN firms_failed TO businesses_failed;

-- ─── 3. Rename column on contacts ─────────────────────────────────────────────

ALTER TABLE contacts RENAME COLUMN firm_id TO business_id;

-- ─── 4. Rename indexes ────────────────────────────────────────────────────────

ALTER INDEX idx_firms_user RENAME TO idx_businesses_user;
ALTER INDEX idx_firms_campaign RENAME TO idx_businesses_campaign;
ALTER INDEX idx_firms_distance RENAME TO idx_businesses_distance;
ALTER INDEX idx_firms_status RENAME TO idx_businesses_status;
ALTER INDEX idx_contacts_firm RENAME TO idx_contacts_business;

-- ─── 5. Rename FK constraint (drop + recreate) ───────────────────────────────

ALTER TABLE businesses DROP CONSTRAINT fk_firms_job;
ALTER TABLE businesses
  ADD CONSTRAINT fk_businesses_job
  FOREIGN KEY (job_id) REFERENCES scrape_jobs(id) ON DELETE SET NULL;

-- ─── 6. Drop and recreate RLS policies ────────────────────────────────────────

DROP POLICY IF EXISTS "own_firms_select" ON businesses;
DROP POLICY IF EXISTS "own_firms_insert" ON businesses;
DROP POLICY IF EXISTS "own_firms_update" ON businesses;
DROP POLICY IF EXISTS "own_firms_delete" ON businesses;

CREATE POLICY "own_businesses_select" ON businesses
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "own_businesses_insert" ON businesses
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "own_businesses_update" ON businesses
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "own_businesses_delete" ON businesses
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ─── 7. Update contacts source CHECK constraint ──────────────────────────────

-- Migrate existing 'state_bar' values before changing the constraint
UPDATE contacts SET source = 'directory' WHERE source = 'state_bar';

-- Drop the CHECK constraint (try both common auto-generated names)
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_source_check;
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_check;

ALTER TABLE contacts
  ADD CONSTRAINT contacts_source_check
  CHECK (source IN ('website', 'google_search', 'directory'));

-- ─── 8. Remove default search queries from scrape_jobs ────────────────────────

ALTER TABLE scrape_jobs
  ALTER COLUMN search_queries DROP DEFAULT;

COMMIT;
