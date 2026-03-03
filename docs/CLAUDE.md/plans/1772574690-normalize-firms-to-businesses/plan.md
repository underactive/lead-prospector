# Plan: Normalize Database — Firms to Businesses

## Objective

Rename `firms` → `businesses` throughout the entire stack and remove all law-firm-specific logic to make Lead Prospector a general-purpose business lead generation tool. This includes:
- Database table/column/index/policy renames
- Removing contact title filtering (TARGET_TITLE_PATTERNS, EXCLUDE_TITLE_PATTERNS)
- Removing seniority scoring
- Removing Yelp `categories: "immigration_law"` filter
- Widening Schema.org type filter to accept any business type
- Removing hardcoded search queries (making them user-required)
- Replacing `'state_bar'` contact source with `'directory'`

## Changes

### Batch 1: Database migration
- `supabase/migrations/00011_rename_firms_to_businesses.sql` (new) — atomic ALTER TABLE RENAME for table, columns, indexes, FK constraints, RLS policies, CHECK constraints

### Batch 2-5: Scraper types & pipeline
- `packages/scraper/src/types.ts` — Firm→Business, DiscoveredFirm→DiscoveredBusiness
- `packages/scraper/src/pipeline/orchestrator.ts` — all firm→business renames
- `packages/scraper/src/sources/google-places.ts` — DiscoveredFirm→DiscoveredBusiness
- `packages/scraper/src/sources/google-maps-scraper.ts` — widen Schema.org type filter
- `packages/scraper/src/sources/website-scraper.ts` — remove law-firm contact filtering
- `packages/scraper/src/sources/yelp.ts` — remove categories filter
- `packages/scraper/src/index.ts` — remove default search queries

### Batch 3, 6-9: Frontend
- `packages/frontend/src/lib/database.types.ts` — Firm→Business, firm_id→business_id
- `packages/frontend/src/composables/useBusinesses.ts` (rename from useFirms.ts)
- `packages/frontend/src/composables/useContacts.ts` — firm_id→business_id
- `packages/frontend/src/router/index.ts` — /firms/:id → /businesses/:id
- `packages/frontend/src/views/BusinessDetailView.vue` (rename from FirmDetailView.vue)
- `packages/frontend/src/views/DashboardView.vue` — all firm→business renames
- `packages/frontend/src/views/JobsView.vue` — column field renames
- All components: LeadsTable, LeadsMap, ContactsList, JobProgress, SearchControls

### Batch 4, 10: Edge functions
- `supabase/functions/_shared/types.ts` — Firm→Business
- `supabase/functions/enrich-single/index.ts` — remove law-firm contact filtering
- `supabase/functions/export-csv/index.ts` — firms→businesses

### Batch 11: Documentation
- `CLAUDE.md` — update all references
- `docs/CLAUDE.md/testing-checklist.md` — add new test items
- `docs/CLAUDE.md/version-history.md` — add v2.0.0 entry

## Dependencies

- Batch 1 (migration) must be applied before any code changes reference `businesses` table
- Scraper type changes (Batch 2) must precede pipeline changes (Batch 5) for compilation
- Frontend type changes (Batch 3) must precede composable/view/component changes (Batches 6-9)

## Risks / Open Questions

- Migration uses `ALTER TABLE RENAME` which is atomic but requires `supabase db reset` for local dev
- Existing data in `firms` table will be preserved by the rename
- No backwards compatibility — this is a breaking change requiring all components to update together
