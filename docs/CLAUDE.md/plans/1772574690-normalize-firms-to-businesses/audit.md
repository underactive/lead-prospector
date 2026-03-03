# Audit: Normalize Database — Firms to Businesses

## Files Changed

Files where findings were flagged (including immediate dependents):

- `supabase/migrations/00011_rename_firms_to_businesses.sql`
- `packages/scraper/src/types.ts`
- `packages/scraper/src/sources/website-scraper.ts`
- `packages/scraper/src/pipeline/orchestrator.ts`
- `packages/scraper/src/sources/google-places.ts`
- `packages/scraper/src/sources/google-maps-scraper.ts`
- `packages/scraper/src/sources/yelp.ts`
- `packages/scraper/src/geo/haversine.ts`
- `packages/frontend/src/lib/database.types.ts`
- `packages/frontend/src/views/DashboardView.vue`
- `packages/frontend/src/views/BusinessDetailView.vue`
- `packages/frontend/src/components/LeadsMap.vue`
- `packages/frontend/src/components/ContactsList.vue`
- `packages/frontend/src/components/JobProgress.vue`
- `packages/frontend/src/components/SearchControls.vue`
- `packages/frontend/src/composables/useContacts.ts`
- `supabase/functions/enrich-single/index.ts`
- `supabase/functions/export-csv/index.ts`
- `README.md`

---

## HIGH / CRITICAL — Pre-existing Bugs (Not Introduced by This Refactoring)

### H1. Scraper writes numeric `confidence` instead of string enum
**Files:** `website-scraper.ts:188`, `types.ts:86`, `orchestrator.ts:269`
**Audits:** QA #2, Security #4, Interface Contract #1, Testing Coverage #6

The scraper's `ExtractedContact.confidence` is `number` and website-scraper assigns `0.8`/`0.5`. The DB column has `CHECK (confidence IN ('high', 'medium', 'low'))`. Every contact insert from the scraper pipeline violates the CHECK constraint. The edge function correctly uses string values. **Pre-existing bug — not introduced by this rename.**

### H2. Scraper writes URL string to `contacts.source` instead of enum value
**Files:** `website-scraper.ts:187`, `orchestrator.ts:268`
**Audits:** QA #1, Interface Contract #2

`source: sourceUrl` assigns the full page URL. The DB column has `CHECK (source IN ('website', 'google_search', 'directory'))`. Every contact insert from the scraper pipeline violates the CHECK constraint. **Pre-existing bug — not introduced by this rename.**

### H3. `enrich-single` upsert uses `onConflict: 'business_id,name'` but no unique constraint exists
**Files:** `enrich-single/index.ts:308`
**Audits:** QA #5, Security #7, Interface Contract #12

The `onConflict` clause requires a unique index/constraint on `(business_id, name)`. Without it, PostgreSQL will error. The "Enrich" button on BusinessDetailView will fail to save contacts. **Pre-existing bug — not introduced by this rename (was `firm_id,name` before).**

---

## MEDIUM — Introduced by This Refactoring

### [FIXED] M1. Migration CHECK constraint drop relies on auto-generated name
**File:** `00011_rename_firms_to_businesses.sql:60`
**Audits:** Security #2, QA #9, Testing Coverage #4

The migration drops `contacts_source_check` by name, relying on PostgreSQL auto-naming. If the auto-generated name differs, the drop silently no-ops via `IF EXISTS`, and the new constraint creation fails because the old one still exists. Also, existing `source = 'state_bar'` rows would violate the new constraint.

### [FIXED] M2. README still references old naming
**File:** `README.md:161-163`
**Audits:** DX #2

The README references `FirmDetail` and `useFirms` in the directory tree.

### [FIXED] M3. `package.json` version not bumped to 2.0.0
**Files:** `package.json`, `packages/frontend/package.json`, `packages/scraper/package.json`
**Audits:** DX #3

All three files still show `"version": "1.0.0"` while CLAUDE.md and version-history.md declare v2.0.0.

### [FIXED] M4. Stale build artifacts from deleted source files
**Files:** `useFirms.d.ts`, `useFirms.js`, `FirmDetailView.vue.d.ts`, `FirmDetailView.vue.js` (and `.map` files)
**Audits:** DX #1, Interface Contract #11, Testing Coverage #7

Orphaned `.d.ts`/`.js`/`.map` build artifacts from the deleted `useFirms.ts` and `FirmDetailView.vue` files reference the old `Firm` type. Could confuse IDE auto-imports.

---

## MEDIUM — Pre-existing (Not Introduced by This Refactoring)

### M5. Radius settings stored in DB but not communicated to scraper
**Files:** `useJobs.ts:61-73`, `orchestrator.ts:102-107`
**Audits:** Interface Contract #9

The user sets min/max radius in SearchControls, stored in `scrape_jobs`, but never sent to the scraper's `/api/jobs/start` endpoint. The scraper uses hardcoded thresholds (<10mi local, >25mi remote).

### M6. `cancelled` status missing from frontend `JobStatus` type
**Files:** `database.types.ts:3`, `orchestrator.ts:333,360,389`
**Audits:** Interface Contract #10

The scraper writes `status: "cancelled"` but the frontend `JobStatus` type only includes `'pending' | 'running' | 'completed' | 'failed'`.

### M7. Nullable `campaign` in scraper type vs `NOT NULL` DB constraint
**Files:** `types.ts:24`, migration `00001`
**Audits:** Interface Contract #7

If a business has no coordinates, `campaign` will be null, causing an insert failure on the NOT NULL constraint.

### M8. Silent error swallowing on background refreshes in DashboardView
**File:** `DashboardView.vue:34-43`
**Audits:** State Management #5

`handleJobUpdated` calls `fetchBusinesses()` and `fetchJobs()` without error handling. The `error` ref from `useBusinesses()` is never displayed. Failed refreshes are invisible to the user.

---

## LOW / INFORMATIONAL

### L1. FK constraint on contacts not renamed (cosmetic)
**File:** `00011_rename_firms_to_businesses.sql`
**Audits:** Security #1, DX #10

The auto-generated FK constraint name `contacts_firm_id_fkey` was not renamed to `contacts_business_id_fkey`. Functionally correct but naming is inconsistent.

### L2. `businessId` not validated as UUID in `enrich-single`
**File:** `enrich-single/index.ts:200`
**Audits:** Security #3

No Zod or regex UUID check at the boundary. Database layer provides defense-in-depth.

### L3. O(n^2) log flushing pattern in orchestrator
**File:** `orchestrator.ts:301`
**Audits:** Security #6, Resource & Concurrency #6

`logLines` array grows unbounded; each `flushJob` serializes the entire array. O(n^2) total I/O. Acceptable for typical job sizes.

### L4. Missing fetch timeouts in scraper sources
**Files:** `google-places.ts`, `google-maps-scraper.ts`, `yelp.ts`
**Audits:** Resource & Concurrency #3, #4, #5

No `AbortController` timeouts on external HTTP fetches. Could hang indefinitely on network issues.

### L5. `clearTimeout` not reached on early-return paths in `enrich-single`
**File:** `enrich-single/index.ts`
**Audits:** Resource & Concurrency #1

Timer cleanup is only reached at the end of the function; early returns (401, 405, etc.) skip it. The timer fires harmlessly but is a resource leak.

### L6. Scraper `ScrapeJob` type missing several DB fields
**Files:** `types.ts:49-64`
**Audits:** Interface Contract #4, #5, QA #3

Missing `businesses_failed`, `search_location`, `search_lat`, `search_lng`, `min_radius_miles`, `max_radius_miles`, `log`. No runtime impact since scraper writes but rarely reads these.

### L7. Scraper `Contact` type includes phantom `updated_at` field
**File:** `types.ts:46`
**Audits:** Interface Contract #3, QA #4

The `contacts` table has no `updated_at` column. No runtime impact.

### L8. Type nullability mismatches (review_count, scrape_status)
**Files:** `types.ts:23,25`
**Audits:** Interface Contract #6, #8

Scraper types are more permissive (nullable) than DB constraints require. Functionally safe due to DB defaults/constraints.

### [FIXED] L9. User-Agent strings reference version 1.0
**Files:** `SearchControls.vue:47`, `enrich-single/index.ts:144`
**Audits:** DX #4

Hardcoded `LeadProspector/1.0` should match declared version.

### L10. Dead function `markerColor` in LeadsMap.vue
**File:** `LeadsMap.vue:31-40`
**Audits:** DX #5

Defined but never called in the template.

### L11. Vestigial `seniority_score` field — always 0 but still displayed/sorted
**Files:** `website-scraper.ts:189`, `enrich-single/index.ts:306`, `ContactsList.vue:50`, `useContacts.ts:18`, `export-csv/index.ts:84-89`
**Audits:** DX #6

Seniority scoring was removed but the field persists at 0. The UI "Score" column and sort are now meaningless.

### L12. Duplicated `statusSeverity` utility across 4 components
**Files:** `BusinessDetailView.vue:69`, `LeadsTable.vue:15`, `JobsView.vue:15`, `JobProgress.vue:38`
**Audits:** DX #7

Same mapping logic duplicated. Pre-existing.

### L13. `runPipeline` (~127 lines) and `extractContactsFromPage` (~91 lines) exceed readability threshold
**Files:** `orchestrator.ts:295-422`, `website-scraper.ts:106-197`
**Audits:** DX #8, #9

Pre-existing. Functions are long but coherent.

### L14. Dual source of truth for job state in JobProgress.vue
**File:** `JobProgress.vue:8-18`
**Audits:** State Management #1

Props `job` vs `activeJob` from Realtime. Reasonable fallback pattern.

### L15. No test framework exists
**Audits:** Testing Coverage #1

The entire project has zero automated tests. All verification is manual.

### L16. No overall pipeline timeout
**File:** `orchestrator.ts`
**Audits:** Resource & Concurrency #7

A very large job could run indefinitely.

### L17. N+1 query pattern in export-csv
**File:** `export-csv/index.ts`
**Audits:** Resource & Concurrency #8

Queries contacts per business instead of a single joined query.

---

## Summary

| Category | Introduced | Pre-existing | Total |
|----------|-----------|-------------|-------|
| High/Critical | 0 | 3 | 3 |
| Medium | 4 | 4 | 8 |
| Low/Info | 1 | 16 | 17 |
| **Total** | **5** | **23** | **28** |

The firms-to-businesses rename itself was executed correctly across all layers. All 5 findings introduced by this refactoring are medium or low severity (migration robustness, stale artifacts, version sync, README). The 3 high/critical findings are pre-existing bugs related to contact insertion (confidence type mismatch, source value mismatch, missing unique constraint for upsert).
