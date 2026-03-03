# Audit: User-Configurable Search Queries

## Files Changed

Files where audit findings were flagged (changed files and immediate dependents):

- `supabase/migrations/00010_add_search_queries.sql`
- `packages/scraper/src/types.ts`
- `packages/scraper/src/index.ts`
- `packages/scraper/src/sources/google-places.ts`
- `packages/scraper/src/pipeline/orchestrator.ts`
- `packages/scraper/src/pipeline/job-queue.ts` (dependent)
- `packages/scraper/src/pipeline/rate-limiter.ts` (dependent)
- `packages/scraper/src/sources/google-maps-scraper.ts` (dependent)
- `packages/scraper/src/sources/website-scraper.ts` (dependent)
- `packages/scraper/src/sources/yelp.ts` (dependent)
- `packages/frontend/src/lib/database.types.ts`
- `packages/frontend/src/composables/useJobs.ts`
- `packages/frontend/src/composables/useRealtime.ts` (dependent)
- `packages/frontend/src/components/SearchControls.vue`
- `packages/frontend/src/components/JobProgress.vue` (dependent)
- `packages/frontend/src/views/DashboardView.vue`

---

## 1. QA Audit

### HIGH

- **QA-1: Unbounded Places API pagination** — `google-places.ts` `do...while(pageToken)` loop has no max page limit. Could loop indefinitely.
- **QA-2: Fragile scrape mode deduplication** — `orchestrator.ts` deduplicates by `firm.name.toLowerCase()` in scrape mode. Different name variants of the same firm slip through.
- **QA-3: Silent search failures in DashboardView** — `handleSearch` catches errors but only logs to console; no user-visible error feedback.

### MEDIUM

- **QA-4:** `parseSearchQueries` silently drops invalid queries without user feedback.
- **QA-5:** No loading state during job creation (between "New Search" click and scraper response).
- **QA-6:** Scrape mode fallback also uses Places API, but no log indication of which queries are being used in fallback.
- **QA-7:** Default search queries still immigration-specific in migration and Zod defaults.
- **QA-8:** `handleJobUpdated` uses sum heuristic that can miss changes when firms transition between statuses.

### LOW

- **QA-9:** `geocodeCache` reset on component remount.
- **QA-10:** Comma in a search query cannot be escaped.
- **QA-11:** No debounce on "New Search" button — rapid clicks can create duplicate jobs.
- **QA-12:** `radiusRange` watcher emits reactive array reference directly.
- **QA-13:** `searchQueriesText` default is immigration-specific, not generic.
- **QA-14:** Frontend validation constants duplicated with scraper (not shared).

---

## 2. Security Audit

### CRITICAL

- **SEC-1: No auth on scraper API endpoints** — Express server has no authentication middleware. Any network caller can start/cancel/status jobs.
- **SEC-2: User ID spoofing** — `userId` in POST body is trusted without verification. Can create data under other users' accounts.

### HIGH

- **SEC-3:** `logLines` array grows unbounded per job — potential memory exhaustion on large jobs.
- **SEC-4:** No content validation on search queries beyond length — queries could contain SQL fragments or HTML (mitigated by parameterized queries and Vue escaping).
- **SEC-5:** No lat/lng range validation — extreme values could cause unexpected API behavior.

### MEDIUM

- **SEC-6:** Cancel endpoint does not verify job ownership.
- **SEC-7:** Status endpoint returns full job record including log to any caller.
- **SEC-8:** No rate limiting on scraper API endpoints themselves.
- **SEC-9:** Geocoding uses HTTP fetch to Nominatim without timeout.

### LOW

- **SEC-10:** Default queries in migration are domain-specific (minor info leak).
- **SEC-11:** No CORS configuration on scraper Express server.
- **SEC-12:** `searchQueriesText` not sanitized for display (mitigated by Vue auto-escaping).
- **SEC-13:** Service role key used for all scraper DB operations (necessary but broad).

---

## 3. Interface Contract Audit

### HIGH

- **IC-1: Scraper `ScrapeJob.status` is `string`** — DB constrains to `('pending','running','completed','failed','cancelled')`. Frontend type also missing `'cancelled'`.
- **IC-2: Scraper `ScrapeJob.campaign` is `string | null`** — DB is `NOT NULL`.
- **IC-3: Scraper `ScrapeJob.mode` is `ScrapeMode | null`** — DB is `NOT NULL`.
- **IC-4: Scraper `ScrapeJob` missing 7 DB fields** — `search_location`, `search_lat`, `search_lng`, `min_radius_miles`, `max_radius_miles`, `firms_failed`, `log`.
- **IC-5: Scraper does not verify job exists in DB before enqueuing** — phantom job IDs create orphaned data.

### MEDIUM

- **IC-6: `contact.confidence` type mismatch** — scraper uses `number`, frontend expects `'high' | 'medium' | 'low'`.
- **IC-7: `Firm` nullability divergences** — `review_count`, `campaign` differ between scraper/frontend types.
- **IC-8: Cancel endpoint lacks ownership check**.
- **IC-9: Realtime payload cast without validation** — `payload.new as ScrapeJob`.
- **IC-10: No rollback if scraper POST fails** — orphaned `pending` jobs in DB.

### LOW

- **IC-11:** Unbounded geocode cache.
- **IC-12:** `fetchJobs` unsafe `as ScrapeJob[]` cast.
- **IC-13:** Google Places API no retry on transient errors.

---

## 4. State Management Audit

### HIGH

- **SM-1: Dual source of truth for active job** — `DashboardView.jobs` stays stale during scrape while `useRealtime` feeds `JobProgress` directly. Code relying on `runningJob` computed would see outdated data.

### MEDIUM

- **SM-2:** Non-singleton composables (`useJobs`, `useFirms`) create independent state per call site.
- **SM-3:** `lastFirmCount` uses lossy sum heuristic — `discovered + enriched` can remain constant across real changes.
- **SM-4:** `activeJobId` is set but never read — dead state.
- **SM-5:** Complex 4-file orchestration chain for job progress refresh.

### LOW

- **SM-6:** `radiusRange` watcher emits same array reference — implicit parent-child coupling.
- **SM-7:** `createAndStartJob` and `cancelJob` do not update local `jobs` ref.
- **SM-8:** Race condition: rapid Realtime updates can trigger concurrent `fetchFirms()` with out-of-order responses.
- **SM-9:** Component-scoped unbounded geocode cache lost on unmount.

---

## 5. Resource & Concurrency Audit

### HIGH

- **RC-1: Unbounded pagination loop in `google-places.ts`** — no max page limit or cancellation check. `allFirms` and `seenPlaceIds` grow without bound.

### MEDIUM

- **RC-2: No `fetch` timeout in `google-places.ts`** — hanging connection blocks pipeline indefinitely.
- **RC-3: No `fetch` timeout in `google-maps-scraper.ts`** — same risk.
- **RC-4: No `fetch` timeout in `yelp.ts`** — same risk.
- **RC-5:** JobQueue `processNext()` fire-and-forget can cause unhandled promise rejections.
- **RC-6:** No cancellation check during discovery phase — user cancel not observed until discovery completes.
- **RC-7:** `RateLimiter.acquire()` wait calculation can undershoot due to setTimeout jitter.

### LOW

- **RC-8:** `logLines` array grows unbounded; quadratic I/O on each flush.
- **RC-9:** `cancelledIds` set never fully cleaned for certain cancel paths.
- **RC-10:** Cheerio homepage DOM retained longer than necessary.
- **RC-11:** Cancel endpoint and pipeline can race on terminal status writes.
- **RC-12:** Rate limiter tokens can go negative under future concurrent callers.
- **RC-13:** Failed terminal status flush leaves job in `'running'` state permanently.

---

## 6. Testing Coverage Audit

### CRITICAL

- **TC-1: No test framework exists** — zero automated tests for any changed code.
- **TC-2: End-to-end search query propagation chain untested** — 6-layer handoff from UI input to API discovery with no integration test.

### HIGH (Priority test scenarios)

- **TC-3:** Zod schema validation for `searchQueries` — trust boundary between frontend and backend.
- **TC-4:** `parseSearchQueries` pure function — transforms raw user input into structured data.
- **TC-5:** Cross-query deduplication in `discoverViaPlacesAPI` — `seenPlaceIds` Set logic.
- **TC-6:** Cross-query deduplication in scrape mode — name-based dedup.
- **TC-7:** Database `TEXT[]` roundtrip — PostgreSQL array serialization through Supabase JS client.

### MEDIUM

- **TC-8:** `handleSearch` error handling in DashboardView — errors only logged, not shown.
- **TC-9:** Orchestrator cancellation between queries — not checked within Phase 1.
- **TC-10:** Geocode caching correctness.
- **TC-11:** `lastFirmCount` staleness detection heuristic.

### Flakiness risks

- **TC-F1:** `geocodeLocation` tests require fetch mocking (external Nominatim API).
- **TC-F2:** Rate limiter interaction in Places API tests.
- **TC-F3:** 2-second sleep in Places API pagination makes tests slow.
- **TC-F4:** `lastFirmCount` mutable state leaks between test cases.

---

## 7. DX & Maintainability Audit

### HIGH

- **DX-11: `ScrapeJob` type divergence** — scraper version missing 7 fields, uses loose types vs. frontend's strict types.

### MEDIUM

- **DX-1:** Unused `Card` import in `DashboardView.vue`.
- **DX-2:** Unused `useRouter` import and `router` variable in `DashboardView.vue`.
- **DX-3:** `activeJobId` ref written but never read in `DashboardView.vue`.
- **DX-6:** Magic numbers `16000`/`50000` for search radii in `orchestrator.ts`.
- **DX-7:** Magic number `2000` for page token delay in `google-places.ts`.
- **DX-8:** Magic number `40000` as default radius in `google-places.ts`.
- **DX-12:** Default search queries duplicated in 3 places (migration, Zod schema, google-places.ts).
- **DX-14:** JSDoc missing `@param searchQueries` in `google-places.ts`.
- **DX-15:** No SQL comment in migration explaining column purpose.

### LOW

- **DX-5:** Stale `.js` and `.d.ts` build artifacts in source tree.
- **DX-9:** `runPipeline` is ~127 lines (well-structured but long).
- **DX-10:** Austin, TX coordinates hardcoded in multiple frontend files.
- **DX-13:** camelCase/snake_case mapping duplicated manually in `useJobs.ts`.
- **DX-16:** `parseSearchQueries` lacks doc comment.

---

## Summary

| Audit | Critical | High | Medium | Low |
|-------|----------|------|--------|-----|
| QA | 0 | 3 | 5 | 6 |
| Security | 2 | 3 | 4 | 4 |
| Interface Contract | 0 | 5 | 5 | 3 |
| State Management | 0 | 1 | 4 | 4 |
| Resource & Concurrency | 0 | 1 | 6 | 6 |
| Testing Coverage | 2 | 5 | 4 | 0 |
| DX & Maintainability | 0 | 1 | 9 | 5 |
| **Total** | **4** | **19** | **37** | **28** |

Many HIGH/CRITICAL findings (scraper auth, type divergence, missing tests) are pre-existing issues not introduced by this change — the search queries feature inherited them. The change-specific findings are primarily: unbounded pagination (QA-1/RC-1), default query duplication (DX-12), and the missing test coverage for the new `searchQueries` flow (TC-2 through TC-7).
