# Plan: User-Configurable Search Queries

## Objective

Replace hardcoded search queries ("immigration lawyer", "immigration attorney") with user-configurable input, making the tool general-purpose for any business type.

## Changes

1. **Database migration** (`supabase/migrations/00010_add_search_queries.sql`) — Add `search_queries TEXT[]` column to `scrape_jobs` with default `['immigration lawyer', 'immigration attorney']`.
2. **Scraper types** (`packages/scraper/src/types.ts`) — Add `search_queries: string[]` to `ScrapeJob` and `searchQueries: string[]` to `JobStartPayload`.
3. **Frontend types** (`packages/frontend/src/lib/database.types.ts`) — Add `search_queries: string[]` to `ScrapeJob`.
4. **Scraper API validation** (`packages/scraper/src/index.ts`) — Add `searchQueries` to Zod schema with min/max length and count constraints.
5. **Google Places source** (`packages/scraper/src/sources/google-places.ts`) — Replace hardcoded constant with parameter on `discoverViaPlacesAPI()`.
6. **Pipeline orchestrator** (`packages/scraper/src/pipeline/orchestrator.ts`) — Pass queries through API mode, scrape mode (loop + deduplicate), and fallback.
7. **Frontend composable** (`packages/frontend/src/composables/useJobs.ts`) — Add `searchQueries` to params, Supabase insert, and POST body.
8. **SearchControls UI** (`packages/frontend/src/components/SearchControls.vue`) — Add text input for comma-separated queries with parsing/validation.
9. **DashboardView** (`packages/frontend/src/views/DashboardView.vue`) — Wire `searchQueries` from emit to `createAndStartJob`.

## Dependencies

- Migration must be applied before scraper or frontend can use the new column.
- Type changes (steps 2-3) must precede code changes (steps 4-9).

## Risks / Open Questions

- Existing jobs in the database will get the default value via the column default — no data migration needed.
- Frontend validation mirrors scraper limits for fast feedback, but scraper is the security boundary.
