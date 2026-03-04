# Implementation: Update README with Database Structure, Job API, and Scraper Internals

## Files Changed

- `README.md` — Added three new sections (Database Schema, Scraper API, How the Scraper Works) between "API Keys (Optional)" and "Project Structure"

## Summary

Inserted ~185 lines of technical documentation into `README.md` covering:

1. **Database Schema** — All 4 tables (businesses, contacts, scrape_jobs, api_cache) with columns, types, and notes. Relationship diagram. RLS and Realtime notes.
2. **Scraper API** — 4 endpoints table, job start payload JSON example, Zod validation rules table.
3. **How the Scraper Works** — Job queue (FIFO, in-memory), 3-phase pipeline (Discovery → Enrichment → Contact Extraction), rate limiting table, source modules table, progress reporting flow.

All details verified against actual migration SQL files and scraper source code. No deviations from plan.

## Verification

- Read the full updated README to confirm correct insertion point and no corruption of existing sections
- Cross-referenced all column names, types, and constraints against migration files (00001–00011)
- Cross-referenced API endpoints, Zod schema, rate limiter values, and pipeline phases against scraper source
- Confirmed no existing content was modified or duplicated

## Follow-ups

- Pre-existing code issues found by Interface Contract Audit: `Contact.confidence` typed as `number | null` in TypeScript but `TEXT` in DB; `ScrapeJob` interface missing 5 DB fields; `Contact` interface has phantom `updated_at`
- Pre-existing `soe/` typo in Project Structure section

## Audit Fixes

### Fixes applied

1. Added `min_radius_miles` and `max_radius_miles` to `scrape_jobs` table documentation — flagged by QA Audit and DX Audit as missing columns (notably `max_radius_miles` is NOT NULL)
2. Updated cancellation description from "between pipeline phases" to "before processing each business" — flagged by QA Audit as inaccurate
3. Clarified Phase 2/3 boundary: Phase 2 extracts contacts "into memory", Phase 3 renamed to "Contact Insertion" and described as persisting collected contacts — flagged by QA Audit as ambiguous

### Verification checklist

- [ ] Verify `min_radius_miles` and `max_radius_miles` appear in the scrape_jobs table in the Database Schema section
- [ ] Verify cancellation description says "before processing each business" (not "between pipeline phases")
- [ ] Verify Phase 3 heading says "Contact Insertion" and description mentions persisting contacts from enrichment
