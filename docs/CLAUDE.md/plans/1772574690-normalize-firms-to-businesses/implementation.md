# Implementation: Normalize Database — Firms to Businesses

## Files Changed

**New files:**
- `supabase/migrations/00011_rename_firms_to_businesses.sql`
- `packages/frontend/src/composables/useBusinesses.ts` (replaces useFirms.ts)
- `packages/frontend/src/views/BusinessDetailView.vue` (replaces FirmDetailView.vue)

**Deleted files:**
- `packages/frontend/src/composables/useFirms.ts`
- `packages/frontend/src/views/FirmDetailView.vue`

**Modified files:**
- `packages/scraper/src/types.ts`
- `packages/scraper/src/pipeline/orchestrator.ts`
- `packages/scraper/src/sources/google-places.ts`
- `packages/scraper/src/sources/google-maps-scraper.ts`
- `packages/scraper/src/sources/website-scraper.ts`
- `packages/scraper/src/sources/yelp.ts`
- `packages/scraper/src/index.ts`
- `packages/frontend/src/lib/database.types.ts`
- `packages/frontend/src/composables/useContacts.ts`
- `packages/frontend/src/router/index.ts`
- `packages/frontend/src/views/DashboardView.vue`
- `packages/frontend/src/views/JobsView.vue`
- `packages/frontend/src/components/LeadsTable.vue`
- `packages/frontend/src/components/LeadsMap.vue`
- `packages/frontend/src/components/ContactsList.vue`
- `packages/frontend/src/components/JobProgress.vue`
- `packages/frontend/src/components/SearchControls.vue`
- `supabase/functions/_shared/types.ts`
- `supabase/functions/enrich-single/index.ts`
- `supabase/functions/export-csv/index.ts`
- `CLAUDE.md`
- `docs/CLAUDE.md/testing-checklist.md`
- `docs/CLAUDE.md/version-history.md`

## Summary

Implemented all 11 batches as planned with no deviations:

1. **Database migration** — atomic `ALTER TABLE RENAME` for `firms` → `businesses`, column renames on `scrape_jobs` (`firms_*` → `businesses_*`) and `contacts` (`firm_id` → `business_id`), index renames, FK constraint recreation, RLS policy recreation, CHECK constraint update (`state_bar` → `directory`), removed default search queries from `scrape_jobs`.

2. **Scraper types & pipeline** — renamed `Firm`/`DiscoveredFirm` → `Business`/`DiscoveredBusiness` throughout. Removed law-firm-specific contact filtering (title patterns, seniority scoring). Widened Schema.org type filter to accept any type with `name`. Removed Yelp `categories: "immigration_law"`. Removed default search queries from Zod schema.

3. **Frontend** — renamed `useFirms` → `useBusinesses`, `FirmDetailView` → `BusinessDetailView`. Updated all type references, DB queries, route paths (`/firms/:id` → `/businesses/:id`), column field names, UI labels. Removed `isTargetRole()` green highlighting from ContactsList. Emptied default search query text, updated placeholder to generic examples.

4. **Edge functions** — updated shared types (`Firm` → `Business`, `state_bar` → `directory`). Removed law-firm contact filtering from `enrich-single`. Updated all DB queries from `firms` to `businesses`.

5. **Documentation** — updated CLAUDE.md (project description, architecture, file inventory, manual verification), testing checklist (firms→businesses, added new test items for general-purpose behavior), version history (added v2.0.0).

**Additional files modified during audit fixes:**
- `README.md`
- `package.json` (root)
- `packages/frontend/package.json`
- `packages/scraper/package.json`

**Deleted stale build artifacts:**
- `packages/frontend/src/composables/useFirms.{d.ts,d.ts.map,js,js.map}`
- `packages/frontend/src/views/FirmDetailView.vue.{d.ts,d.ts.map,js,js.map}`

## Verification

- `npm run build` passes cleanly (vue-tsc + Vite)
- `grep -ri "firm" packages/ supabase/functions/` — no source file references remain (only build artifacts from other unrelated files)
- Build output confirms renamed modules: `useBusinesses-DB2T_wIF.js`, `BusinessDetailView-Cb-xFtqq.js`

## Follow-ups

- Run `supabase db reset` to verify migration applies cleanly
- Pre-existing: Fix scraper `Contact.confidence` type mismatch (numeric vs string enum) — blocks all contact inserts from scraper pipeline (audit H1)
- Pre-existing: Fix scraper `Contact.source` writing URL instead of enum value (audit H2)
- Pre-existing: Add UNIQUE constraint on `contacts(business_id, name)` for upsert to work (audit H3)
- Pre-existing: Add `cancelled` to frontend `JobStatus` type (audit M6)
- Pre-existing: Pass radius settings from frontend to scraper pipeline (audit M5)

## Audit Fixes

Fixes applied for findings introduced by this refactoring:

1. **[M1] Migration CHECK constraint robustness** — Added `UPDATE contacts SET source = 'directory' WHERE source = 'state_bar'` before dropping the constraint, ensuring existing data is migrated. Also added a second `DROP CONSTRAINT IF EXISTS contacts_check` to handle alternative auto-generated constraint names.

2. **[M2] README updated** — Changed `FirmDetail` → `BusinessDetail` and `useFirms` → `useBusinesses` in the project structure tree.

3. **[M3] Version bump to 2.0.0** — Updated `"version"` in all 3 `package.json` files (root, frontend, scraper) to match CLAUDE.md and version-history.md.

4. **[M4] Stale build artifacts deleted** — Removed 8 orphaned `.d.ts`/`.js`/`.map` files from the deleted `useFirms.ts` and `FirmDetailView.vue`.

5. **[L9] User-Agent strings updated** — Changed `LeadProspector/1.0` → `LeadProspector/2.0` in `SearchControls.vue` and `enrich-single/index.ts`.

### Deferred items

The following pre-existing issues (H1, H2, H3, M5, M6, M7, M8) were not addressed because they existed before this refactoring and are outside the scope of the firms→businesses rename. They are documented in the audit report and listed in Follow-ups above.

### Verification checklist

- [x] `npm run build` passes after all fixes
- [ ] `supabase db reset` applies migration cleanly (including `state_bar` → `directory` data migration)
- [ ] Verify no `contacts_source_check` constraint conflict after migration
