# Implementation: Job-Based Filter for Dashboard

## Files Changed

- `packages/frontend/src/composables/useBusinesses.ts` — Added `jobId` filter
- `packages/frontend/src/components/JobSelector.vue` — **New** — Job selector dropdown
- `packages/frontend/src/views/DashboardView.vue` — Wired job selector, auto-selection, map recentering
- `packages/frontend/src/components/ExportButton.vue` — Added `jobId` prop
- `packages/frontend/src/composables/useExport.ts` — Added `jobId` to URL params
- `supabase/functions/export-csv/index.ts` — Added `job_id` query param filter

## Summary

Implemented per plan with the following deviations:
- `selectedJobId` is NOT set on search start (only on job completion) to avoid flashing the table to zero results while a job is running
- Only `completed` jobs auto-select (not `failed`/`cancelled`) to prevent hijacking the view with empty results
- `lastBusinessCount` is reset to 0 when a new job starts to prevent stale dedupe state
- `search_queries.join()` is guarded with `?? []` fallback for legacy rows

## Verification

1. `npm run build:frontend` — passes with no TypeScript errors
2. Build output includes all expected chunks

## Follow-ups

Pre-existing issues surfaced by audit (not introduced by this change):
- N+1 contact queries in `export-csv` edge function — should batch-query contacts
- No in-flight cancellation for `fetchBusinesses` — concurrent fetches can resolve out of order
- `export-csv` does not validate `job_id` as UUID format (returns 500 instead of 400 on malformed input)
- No row limit on businesses query in `export-csv`
- Static CSV filename regardless of selected job
- No test framework configured

## Audit Fixes

### Fixes applied
1. Fixed auto-selection of failed/cancelled jobs — only `completed` jobs now auto-select `selectedJobId` (flagged by QA Audit §6)
2. Added null guard on `search_queries.join()` in `formatJobLabel` — uses `?? []` fallback (flagged by QA Audit §3, Interface Contract Audit §4, Security Audit §5)
3. Reset `lastBusinessCount = 0` in `handleSearch` when a new job starts (flagged by QA Audit §7, State Management Audit §2, Resource Audit §1)
4. Removed `selectedJobId` assignment on search start to avoid dual-writer issue and empty table flash (flagged by State Management Audit §1, Interface Contract Audit §1, QA Audit §9)

### Verification checklist
- [ ] Completed job auto-selects in dropdown; failed/cancelled jobs do not
- [ ] Starting a new search does not flash the table to zero results
- [ ] Job with null or empty `search_queries` renders fallback label in dropdown
- [ ] Multiple sequential jobs do not miss business count updates due to stale `lastBusinessCount`
