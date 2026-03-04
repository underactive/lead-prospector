# Plan: Job-Based Filter for Dashboard

## Objective

When a user runs multiple searches (e.g., "plumber" in Austin TX, then "plumber" in El Paso TX), all results pool into the same dashboard view. Add a job selector dropdown to the dashboard that filters businesses by the job that created them, using the existing `businesses.job_id` FK.

## Changes

### 1. `packages/frontend/src/composables/useBusinesses.ts`
Add `jobId?: string` to filters. Add `.eq('job_id', filters.jobId)` when set.

### 2. `packages/frontend/src/components/JobSelector.vue` (new)
PrimeVue `Select` dropdown showing completed/failed/cancelled jobs. Format: `"queries — location (N found) · date"`. v-model emits job ID. showClear resets to "All Searches".

### 3. `packages/frontend/src/views/DashboardView.vue`
- Add `selectedJobId` ref
- `refreshBusinesses()` passes `{ jobId }` to `fetchBusinesses`
- Watch `selectedJobId` to refresh + recenter map
- Auto-select job on completion and new search
- Add `<JobSelector>` between `<h2>Leads</h2>` and `<ExportButton>`
- Pass `jobId` to `<ExportButton>`

### 4. `packages/frontend/src/components/ExportButton.vue`
Add `jobId?: string | null` prop. Pass to `exportCsv()`.

### 5. `packages/frontend/src/composables/useExport.ts`
Add `jobId?: string` to filters. Append `job_id` URL param when set.

### 6. `supabase/functions/export-csv/index.ts`
Read `job_id` query param. Add `.eq('job_id', jobId)` when present.

## Dependencies
- Changes 4-5 depend on each other (ExportButton passes to useExport)
- Change 3 depends on 1, 2, 4
- Change 6 is independent

## Risks / Open Questions
- None. This is a pure frontend filter + edge function param addition. No schema changes needed.
