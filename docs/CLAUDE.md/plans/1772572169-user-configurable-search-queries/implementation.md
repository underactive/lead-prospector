# Implementation: User-Configurable Search Queries

## Files Changed

- `supabase/migrations/00010_add_search_queries.sql` (created)
- `packages/scraper/src/types.ts` (modified)
- `packages/frontend/src/lib/database.types.ts` (modified)
- `packages/scraper/src/index.ts` (modified)
- `packages/scraper/src/sources/google-places.ts` (modified)
- `packages/scraper/src/pipeline/orchestrator.ts` (modified)
- `packages/frontend/src/composables/useJobs.ts` (modified)
- `packages/frontend/src/components/SearchControls.vue` (modified)
- `packages/frontend/src/views/DashboardView.vue` (modified)

## Summary

Implemented all 9 changes from the plan with no deviations:

1. Created migration adding `search_queries TEXT[]` column with default.
2. Added `search_queries` to scraper `ScrapeJob` and `searchQueries` to `JobStartPayload`.
3. Added `search_queries` to frontend `ScrapeJob` type.
4. Added Zod validation for `searchQueries` array (min 2 chars, max 100 chars per query, max 5 queries).
5. Replaced hardcoded `SEARCH_QUERIES` constant with `DEFAULT_SEARCH_QUERIES` and added `searchQueries` parameter to `discoverViaPlacesAPI()`.
6. Updated orchestrator: API mode passes queries through; scrape mode loops over all queries with deduplication by lowercase name; fallback also passes queries.
7. Added `searchQueries` to `useJobs` composable params, Supabase insert, and POST body.
8. Added "Search For" InputText in SearchControls with comma parsing, validation (min 2 chars, max 5 queries, max 100 chars each), and error display.
9. Wired `searchQueries` through DashboardView `handleSearch` to `createAndStartJob`.

## Verification

- `npm run build` — TypeScript compiles with no errors across both frontend and scraper packages.
- Migration SQL is syntactically valid (ALTER TABLE with IF NOT EXISTS).

## Follow-ups

- Apply migration with `supabase migration up --local` when Supabase is running.
- Manual testing: verify SearchControls input, job creation with custom queries, pipeline log output.
