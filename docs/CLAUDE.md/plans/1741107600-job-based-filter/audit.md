# Audit Report: Job-Based Filter for Dashboard

## Files Changed

- `packages/frontend/src/composables/useBusinesses.ts`
- `packages/frontend/src/components/JobSelector.vue`
- `packages/frontend/src/views/DashboardView.vue`
- `packages/frontend/src/components/ExportButton.vue`
- `packages/frontend/src/composables/useExport.ts`
- `supabase/functions/export-csv/index.ts`
- `supabase/functions/_shared/types.ts` (immediate dependent — stale `CsvRow` interface)
- `packages/frontend/src/components/JobProgress.vue` (immediate dependent)
- `packages/frontend/src/composables/useRealtime.ts` (immediate dependent)

---

## QA Audit

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | [FIXED] Critical | `DashboardView.vue` | Failed/cancelled jobs auto-selected — now only completed jobs auto-select |
| 2 | [FIXED] Major | `JobSelector.vue` | `search_queries.join()` not guarded against null — added `?? []` fallback |
| 3 | [FIXED] Major | `DashboardView.vue` | `lastBusinessCount` stale across jobs — now reset on new job start |
| 4 | [FIXED] Minor | `DashboardView.vue` | Table flashes empty on search start — removed `selectedJobId` assignment on search |
| 5 | Major | `DashboardView.vue` | Race condition: concurrent `fetchBusinesses` without cancellation (pre-existing) |
| 6 | Critical | `export-csv/index.ts` | N+1 contact queries will time out on large exports (pre-existing) |
| 7 | Major | `export-csv/index.ts` | `job_id` not UUID-validated (pre-existing pattern) |
| 8 | Major | `export-csv/index.ts` | No row limit on businesses query (pre-existing) |
| 9 | Minor | `ExportButton.vue` | Export error not dismissible (pre-existing) |
| 10 | Minor | `useExport.ts` | Static filename regardless of selected job |

## Security Audit

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | [FIXED] Minor | `JobSelector.vue` | `search_queries.join()` crashes on null — guarded |
| 2 | Major | `useExport.ts` | `campaign`/`status`/`jobId` not validated against enums before URL append (pre-existing pattern for campaign/status) |
| 3 | Major | `export-csv/index.ts` | `job_id` not UUID-validated; RLS is sole defense (pre-existing RLS-only pattern) |
| 4 | Minor | `useExport.ts` | Object URL not revoked on error paths (pre-existing) |

## Interface Contract Audit

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | [FIXED] Major | `DashboardView.vue` | `selectedJobId` dual-writer — removed search-start writer |
| 2 | Minor | `ExportButton.vue` | `jobId` typed as `string | null` vs `string | undefined` in useExport — coercion works but inconsistent |
| 3 | Minor | `_shared/types.ts` | `CsvRow` interface has `'Business Name'` but CSV header is `'Business'` (pre-existing dead code) |
| 4 | Minor | `export-csv/index.ts` | `job_id` not UUID-validated before query (pre-existing) |

## State Management Audit

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | [FIXED] Major | `DashboardView.vue` | Dual writers to `selectedJobId` — fixed |
| 2 | [FIXED] Major | `DashboardView.vue` | `lastBusinessCount` not reset — fixed |
| 3 | Major | `useRealtime.ts` | `activeJob` not cleared on `unsubscribe` — stale prior-job state (pre-existing) |
| 4 | Major | `useBusinesses.ts` | Optimistic `deleteBusiness` has no rollback path (pre-existing) |
| 5 | Minor | `DashboardView.vue` | `refreshBusinesses` fires before `fetchJobs` resolves — brief stale render |

## Resource & Concurrency Audit

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | [FIXED] Major | `DashboardView.vue` | `lastBusinessCount` not reset on job switch — fixed |
| 2 | Major | `useBusinesses.ts` | No in-flight cancellation — out-of-order responses possible (pre-existing) |
| 3 | Major | `JobProgress.vue` | `props.job.id` watcher subscribes unconditionally including completed jobs (pre-existing) |

## Testing Coverage Audit

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | Critical | All files | No test framework configured — end-to-end filter chain untested |
| 2 | Critical | `export-csv/index.ts` | `escapeCsv` has no tests for CSV injection defense (pre-existing) |
| 3 | Major | `JobSelector.vue` | `formatJobLabel` edge cases untested |
| 4 | Major | `useBusinesses.ts` | Filter combination correctness untested |

## DX & Maintainability Audit

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | Minor | `DashboardView.vue` | Austin default coords hardcoded a third time (violates symbolic-constant rule, pre-existing) |
| 2 | Minor | `DashboardView.vue` | Terminal status list duplicated from `JobSelector` — no shared constant |
| 3 | Minor | `ExportButton.vue` | `campaign` prop typed as `string` instead of `Campaign` (pre-existing) |
| 4 | Minor | `JobSelector.vue` | `finishedStatuses` Set allocated per mount — could be module-level |
| 5 | Info | `export-csv/index.ts` | N+1 contacts query has no comment marking the trade-off |
