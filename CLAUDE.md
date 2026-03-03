# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lead Prospector** is a general-purpose lead generation tool for finding local businesses by type and location. It supports two campaign types: local leads (<10mi for in-person visits) and remote leads (>25mi for document shipping). Users provide search queries (e.g., "plumber", "dentist") and a location to discover businesses. Built with Vue 3, PrimeVue 4, Leaflet.js, Supabase (Auth, PostgreSQL, Realtime), and a Node.js scraper service.

**Current Version:** 2.0.0
**Status:** In development

---

## Architecture

### Core Files

npm workspaces monorepo with a hybrid backend: Supabase Edge Functions for short-lived tasks (<30s) and a Node.js service for long-running batch scraping jobs with no execution time limits.

- `packages/frontend/src/main.ts` — Entry point: Vue 3 + Router + PrimeVue bootstrap
- `packages/scraper/src/index.ts` — Entry point: Express server for job management
- `packages/scraper/src/config.ts` — Zod-validated environment configuration
- `packages/scraper/src/types.ts` — Shared TypeScript interfaces (Business, Contact, ScrapeJob, etc.)
- `packages/frontend/src/lib/supabase.ts` — Supabase client singleton (anon key, respects RLS)
- `packages/scraper/src/supabase.ts` — Supabase service-role client (bypasses RLS)
- `packages/frontend/src/lib/database.types.ts` — Generated Supabase types (regenerate with `supabase gen types`)
- `packages/frontend/src/router/index.ts` — Routes + auth guards
- `supabase/config.toml` — Local Supabase service configuration

### Dependencies

**Frontend:**
- Vue 3 (`^3.5.13`), Vue Router (`^4.5.0`)
- PrimeVue (`^4.3.0`), PrimeIcons (`^7.0.0`), @primevue/themes (`^4.3.0`)
- Leaflet (`^1.9.4`), @vue-leaflet/vue-leaflet (`^0.10.1`)
- @supabase/supabase-js (`^2.47.0`)
- Vite (`^6.0.0`), TypeScript (`^5.6.0`), vue-tsc (`^2.2.0`)

**Scraper:**
- Express (`^4.21.0`), cors (`^2.8.5`)
- Cheerio (`^1.0.0`) — HTML parsing for staff page extraction
- Zod (`^3.23.0`) — env var and request body validation
- csv-stringify (`^6.5.0`)
- @supabase/supabase-js (`^2.47.0`)
- tsx (`^4.19.0`) — TypeScript execution without build step

**Edge Functions:** Deno runtime (v2)

### Key Subsystems

#### 1. Scraper Pipeline (3-Phase)
The pipeline in `packages/scraper/src/pipeline/orchestrator.ts` runs three phases sequentially per job:

1. **Discovery** — Google Places API (primary) or Google Maps scraping (fallback if no API key). Search queries are user-provided (required). Haversine distance from search center categorizes businesses: <10mi=local, 10–25mi=mid, >25mi=remote. Deduplicates by `google_place_id`.
2. **Enrichment** — Website scraping (Cheerio) to find staff/team/about pages and extract LinkedIn URLs. Yelp API for ratings (if key available).
3. **Contact Extraction** — Parses staff pages for names/titles/emails. Extracts all persons found without filtering by role. All contacts get `seniority_score: 0`. Confidence: "high" with email, "medium" without.

**Constraints:** Only one job runs at a time (sequential FIFO queue in `job-queue.ts`). Pipeline checks `isCancelled()` between phases. Each phase updates the `scrape_jobs` table with progress counters and timestamped log lines.

#### 2. Rate Limiting
Token-bucket per source in `packages/scraper/src/pipeline/rate-limiter.ts`:
- Google Places: 10 req/min
- Google Custom Search: 5 req/min
- Website scraping: 3 req/min
- Yelp: 50 req/min

`acquire()` blocks until a token is available. In-memory only — resets on service restart.

#### 3. Authentication & Authorization
Supabase Auth with OAuth providers (GitHub, Google, Discord). Callback URL: `http://127.0.0.1:54321/auth/v1/callback`. Session managed in `useAuth.ts` composable via `onAuthStateChange()`.

Row-Level Security (RLS) enabled on all tables. Per-user isolation: `auth.uid() = user_id`. The `api_cache` table is accessible only to `service_role`.

Vue Router guards: `/login` and `/auth/callback` are public; all other routes redirect to `/login` if no session.

#### 4. Realtime Job Progress
Supabase Realtime subscription in `useRealtime.ts`. Subscribes to `UPDATE` events on `scrape_jobs` filtered by job ID. The scraper writes progress (businesses_discovered, businesses_enriched, total_contacts) to the DB, which pushes to the frontend via WebSocket.

#### 5. Frontend State Management
Vue 3 Composition API composables — no Vuex/Pinia:
- `useAuth()` — session, user, signInWithProvider(), signOut()
- `useBusinesses()` — business CRUD + filtering via Supabase client
- `useContacts()` — contact reads for a business
- `useJobs()` — job CRUD + POST to scraper `/api/jobs/start`
- `useRealtime()` — WebSocket subscription for job progress
- `useExport()` — invokes `export-csv` edge function

#### 6. Settings / Configuration Storage
```
Scraper config (Zod schema in config.ts):
  SUPABASE_URL:            string  (default: "http://127.0.0.1:54321")
  SUPABASE_SERVICE_ROLE_KEY: string  (required)
  GOOGLE_PLACES_API_KEY:   string  (optional — enables API mode)
  YELP_API_KEY:            string  (optional — enables Yelp enrichment)
  SCRAPER_PORT:            number  (default: 3737)
  DEFAULT_LAT:             number  (default: 30.2672 — Austin, TX)
  DEFAULT_LNG:             number  (default: -97.7431 — Austin, TX)
```
- Read from `.env` at root via `tsx --env-file`
- Frontend vars prefixed with `VITE_` are embedded at build time by Vite
- Validation runs on scraper startup; exits with error if invalid

#### 7. Data Flow
```
Frontend (Vue) → Supabase Client (RLS) → PostgreSQL
Frontend → POST /api/jobs/start → Scraper Express API
Scraper (service_role) → PostgreSQL → Supabase Realtime → Frontend
Frontend → Edge Function (export-csv) → CSV download
Frontend → Edge Function (enrich-single) → single business enrichment
```

---

## Build Configuration

### Vite Configuration
- **API proxy** — `/api` requests proxied to `http://localhost:3737` (scraper service) during development
- **Path alias** — `@` maps to `packages/frontend/src/`
- **Environment file** — reads `.env` from monorepo root (`envDir: '../../'`)

### TypeScript Configuration
- `tsconfig.base.json` — shared: ES2022 target, ESNext modules, bundler moduleResolution, strict mode
- `packages/frontend/tsconfig.json` — extends base, adds Vue JSX, `@/*` path alias
- `packages/scraper/tsconfig.json` — extends base, outputs to `dist/`

### Environment Variables

| Variable | Purpose | Values |
|----------|---------|--------|
| `VITE_SUPABASE_URL` | Frontend Supabase API URL | `http://127.0.0.1:54321` |
| `VITE_SUPABASE_ANON_KEY` | Frontend anon key (RLS-scoped) | From `supabase start` |
| `SUPABASE_SERVICE_ROLE_KEY` | Scraper admin key (bypasses RLS) | From `supabase start` |
| `GOOGLE_PLACES_API_KEY` | Enables API mode discovery | Optional |
| `YELP_API_KEY` | Enables Yelp enrichment | Optional |
| `SCRAPER_PORT` | Express server port | `3737` (default) |
| `DEFAULT_LAT` | Search center latitude | `30.2672` (Austin) |
| `DEFAULT_LNG` | Search center longitude | `-97.7431` (Austin) |

Environment files / define sources:
- `.env` — all vars for local development (copy from `.env.example`)
- `VITE_` prefixed vars are inlined into frontend build by Vite

---

## Code Style

- **Linter:** None configured (no ESLint)
- **Formatter:** None configured (no Prettier)
- **Indentation:** 2 spaces
- **Line endings:** LF
- **TypeScript:** Strict mode enabled in `tsconfig.base.json`
- **Conventions:** async/await throughout, no callbacks. Vue 3 `<script setup>` with Composition API. Type imports via `import type`.

---

## External Integrations

### Supabase (Auth, Database, Realtime, Edge Functions)
- **What:** Backend-as-a-service providing PostgreSQL, auth, realtime subscriptions, and edge functions
- **Loaded via:** `@supabase/supabase-js` SDK; two client patterns: user-scoped (anon key + JWT) and service-role (admin bypass)
- **Lifecycle:** `supabase start` boots all services via Docker; `supabase stop` shuts down
- **Key env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Gotchas:** OAuth provider env vars must be set before `supabase start` (restart required after changes). Realtime only enabled on `scrape_jobs` table. RLS policies use `(SELECT auth.uid())` pattern — queries without a valid JWT return empty results.

### Google Places API
- **What:** Primary business discovery source (Places API v1 text search)
- **Loaded via:** Direct HTTPS fetch to `https://places.googleapis.com/v1/places:searchText`
- **Key env vars:** `GOOGLE_PLACES_API_KEY` (optional — falls back to scraping without it)
- **Gotchas:** Max 20 results per request with pagination via `nextPageToken`. 2s pause required between pages. Rate limited to 10 req/min.

### Google Custom Search API
- **What:** LinkedIn URL discovery for businesses
- **Key env vars:** Uses `GOOGLE_PLACES_API_KEY` (same key)
- **Gotchas:** Rate limited to 5 req/min. Daily quota limits apply.

### Yelp Fusion API
- **What:** Supplementary business data (ratings, review counts)
- **Key env vars:** `YELP_API_KEY` (optional — enrichment skipped without it)
- **Gotchas:** Rate limited to 50 req/min.

---

## Known Issues / Limitations

1. **No test suite** — No unit or integration tests exist yet
2. **In-memory job queue** — Queue state lost on scraper restart; running jobs are not recovered
3. **In-memory rate limiter** — Token buckets reset on restart; no persistent rate tracking
4. **Single-process scraping** — Only one job runs at a time; no horizontal scaling
5. **Google Maps scraper fragility** — Fallback scraping mode depends on Google's HTML structure which can change without notice
6. **No pagination in frontend** — Dashboard loads all businesses at once via Supabase client

---

## Development Rules

### 1. Validate all external input at the boundary
Every value arriving from an external source (API, user input, scraped HTML) must be validated before being stored or used. The scraper uses Zod for request body validation and Cheerio for sanitized HTML parsing. Never assign an externally-supplied value without bounds checking.

### 2. Guard all array-indexed lookups
Any value used as an index into an array must have a bounds check before access: `(val < COUNT) ? ARRAY[val] : fallback`. This is defense-in-depth against corrupt or unvalidated values.

### 3. Reset connection-scoped state on disconnect
Buffers, flags, and session variables that accumulate state during a connection must be reset on disconnect to prevent cross-session corruption. Applies to Supabase Realtime subscriptions — always call `unsubscribe()` on component unmount.

### 4. Avoid memory-fragmenting patterns in long-running code
The scraper is a long-running Node.js process. Avoid growing unbounded arrays or maps in the pipeline. Rate limiter tokens and job queue are bounded by design. Be cautious with Cheerio — parsed DOMs should not be retained after extraction.

### 5. Use symbolic constants, not magic numbers
Never hardcode index values or numeric constants — use named defines or enums. Distance thresholds (10mi, 25mi), rate limits, and API endpoints are defined as constants in their respective modules.

### 6. Throttle event-driven output
Any function that sends data in response to frequent events must implement rate limiting or throttling. The scraper's token-bucket rate limiter enforces this for all external API calls.

### 7. Use bounded string formatting
Always use bounded string operations. This prevents silent overflow if format arguments change in the future.

### 8. Report errors, don't silently fail
When input exceeds limits or operations fail, provide actionable error feedback to the caller. The scraper logs errors per-business and updates `scrape_status` to `'failed'` with `scrape_error` details. Never silently truncate, drop, or ignore errors.

---

## Plan Pre-Implementation

Before planning, check `docs/CLAUDE.md/plans/` for prior plans that touched the same areas. Scan the **Files changed** lists in both `implementation.md` and `audit.md` files to find relevant plans without reading every file — then read the full `plan.md` only for matches. This keeps context window usage low while preserving access to project history.

When a plan is finalized and about to be implemented, write the full plan to `docs/CLAUDE.md/plans/{epoch}-{plan_name}/plan.md`, where `{epoch}` is the Unix timestamp at the time of writing and `{plan_name}` is a short kebab-case description of the plan (e.g., `1709142000-add-user-auth/plan.md`).

The epoch prefix ensures chronological ordering — newer plans visibly supersede earlier ones at a glance based on directory name ordering.

The plan document should include:
- **Objective** — what is being implemented and why
- **Changes** — files to modify/create, with descriptions of each change
- **Dependencies** — any prerequisites or ordering constraints between changes
- **Risks / open questions** — anything flagged during planning that needs attention

---

## Plan Post-Implementation

After a plan has been fully implemented, write the completed implementation record to `docs/CLAUDE.md/plans/{epoch}-{plan_name}/implementation.md`, using the same directory as the corresponding `plan.md`.

The implementation document **must** include:
- **Files changed** — list of all files created, modified, or deleted. This section is **required** — it serves as a lightweight index for future planning, allowing prior plans to be found by scanning file lists without reading full plan contents.
- **Summary** — what was actually implemented (noting any deviations from the plan)
- **Verification** — steps taken to verify the implementation is correct (tests run, manual checks, build confirmation)
- **Follow-ups** — any remaining work, known limitations, or future improvements identified during implementation

If the implementation added or changed user-facing behavior (new settings, UI modes, protocol commands, or display changes), add corresponding `- [ ]` test items to `docs/CLAUDE.md/testing-checklist.md`. Each item should describe the expected observable behavior, not the implementation detail.

---

## Post-Implementation Audit

After finishing implementation of a plan, run the following subagents **in parallel** to audit all changed files.

> **Scope directive for all subagents:** Only flag issues in the changed code and its immediate dependents. Do not audit the entire codebase.

> **Output directive:** After all subagents complete, write a single consolidated audit report to `docs/CLAUDE.md/plans/{epoch}-{plan_name}/audit.md`, using the same directory as the corresponding `plan.md`. The audit report **must** include a **Files changed** section listing all files where findings were flagged. This section is **required** — it serves as a lightweight index for future planning, covering files affected by audit findings (including immediate dependents not in the original implementation).

### 1. QA Audit (subagent)
Review changes for:
- **Functional correctness**: broken workflows, missing error/loading states, unreachable code paths, logic that doesn't match spec
- **Edge cases**: empty/null/undefined inputs, zero-length collections, off-by-one errors, race conditions, boundary values (min/max/overflow)
- **Infinite loops**: unbounded `while`/recursive calls, callbacks triggering themselves, retry logic without max attempts or backoff
- **Performance**: unnecessary computation in hot paths, O(n²) or worse in loops over growing data, unthrottled event handlers, expensive operations blocking main thread or interrupt context

### 2. Security Audit (subagent)
Review changes for:
- **Injection / input trust**: unsanitized external input used in commands, queries, or output rendering; format string vulnerabilities; untrusted data used in control flow
- **Overflows**: unbounded buffer writes, unguarded index access, integer overflow/underflow in arithmetic, unchecked size parameters
- **Memory leaks**: allocated resources not freed on all exit paths, event/interrupt handlers not deregistered on cleanup, growing caches or buffers without eviction or bounds
- **Hard crashes**: null/undefined dereferences without guards, unhandled exceptions in async or interrupt context, uncaught error propagation across module boundaries

### 3. Interface Contract Audit (subagent)
Review changes for:
- **Data shape mismatches**: caller assumptions that diverge from actual API/protocol schema, missing fields treated as present, incorrect type coercion or endianness
- **Error handling**: no distinction between recoverable and fatal errors, swallowed failures, missing retry/backoff on transient faults, no timeout or watchdog configuration
- **Auth / privilege flows**: credential or token lifecycle issues, missing permission checks, race conditions during handshake or session refresh
- **Data consistency**: optimistic state updates without rollback on failure, stale cache served after mutation, sequence counters or cursors not invalidated after writes

### 4. State Management Audit (subagent)
Review changes for:
- **Mutation discipline**: shared state modified outside designated update paths, state transitions that skip validation, side effects hidden inside getters or read operations
- **Reactivity / observation pitfalls**: mutable updates that bypass change detection or notification mechanisms, deeply nested state triggering unnecessary cascading updates
- **Data flow**: excessive pass-through of context across layers where a shared store or service belongs, sibling modules communicating via parent state mutation, event/signal spaghetti without cleanup
- **Sync issues**: local copies shadowing canonical state, multiple sources of truth for the same entity, concurrent writers without arbitration (locks, atomics, or message ordering)

### 5. Resource & Concurrency Audit (subagent)
Review changes for:
- **Concurrency**: data races on shared memory, missing locks/mutexes/atomics around critical sections, deadlock potential from lock ordering, priority inversion in RTOS or threaded contexts
- **Resource lifecycle**: file handles, sockets, DMA channels, or peripherals not released on error paths; double-free or use-after-free; resource exhaustion under sustained load
- **Timing**: assumptions about execution order without synchronization, spin-waits without yield or timeout, interrupt latency not accounted for in real-time constraints
- **Power & hardware**: peripherals left in active state after use, missing clock gating or sleep transitions, watchdog not fed on long operations, register access without volatile or memory barriers

### 6. Testing Coverage Audit (subagent)
Review changes for:
- **Missing tests**: new public functions/modules without corresponding unit tests, modified branching logic without updated assertions, deleted tests not replaced
- **Test quality**: assertions on implementation details instead of behavior, tests coupled to internal structure, mocked so heavily the test proves nothing
- **Integration gaps**: cross-module flows tested only with mocks and never with integration or contract tests, initialization/shutdown sequences untested, error injection paths uncovered
- **Flakiness risks**: tests dependent on timing or sleep, shared mutable state between test cases, non-deterministic data (random IDs, timestamps), hardware-dependent tests without abstraction layer

### 7. DX & Maintainability Audit (subagent)
Review changes for:
- **Readability**: functions exceeding ~50 lines, boolean parameters without named constants, magic numbers/strings without explanation, nested ternaries or conditionals deeper than one level
- **Dead code**: unused includes/imports, unreachable branches behind stale feature flags, commented-out blocks with no context, exported symbols with zero consumers
- **Naming & structure**: inconsistent naming conventions, business/domain logic buried in UI or driver layers, utility functions duplicated across modules
- **Documentation**: public API changes without updated doc comments, non-obvious workarounds missing a `// WHY:` comment, breaking changes without migration notes

---

## Audit Post-Implementation

After audit findings have been addressed, update the `implementation.md` file in the corresponding `docs/CLAUDE.md/plans/{epoch}-{plan_name}/` directory:

1. **Flag fixed items** — In the audit report (`docs/CLAUDE.md/plans/{epoch}-{plan_name}/audit.md`), mark each finding that was fixed with a `[FIXED]` prefix so it is visually distinct from unresolved items.

2. **Append a fixes summary** — Add an `## Audit Fixes` section at the end of `implementation.md` containing:
   - **Fixes applied** — a numbered list of each fix, referencing the audit finding it addresses (e.g., "Fixed unchecked index access flagged by Security Audit §2")
   - **Verification checklist** — a `- [ ]` checkbox list of specific tests or manual checks to confirm each fix is correct (e.g., "Verify bounds check on `configIndex` with out-of-range input returns fallback")

3. **Leave unresolved items as-is** — Any audit findings intentionally deferred or accepted as-is should remain unmarked in the audit report. Add a brief note in the fixes summary explaining why they were not addressed.

4. **Update testing checklist** — If any audit fixes changed user-facing behavior, add corresponding `- [ ]` test items to `docs/CLAUDE.md/testing-checklist.md`. Each item should describe the expected observable behavior, not the implementation detail.

---

## Common Modifications

### Version bumps
Version string appears in 3 files:
1. `package.json` — root `"version"` field
2. `packages/frontend/package.json` — `"version"` field
3. `packages/scraper/package.json` — `"version"` field

**Keep all version references in sync.** Always bump all files together during any version bump.

### Add a new scraper source
1. Create `packages/scraper/src/sources/<source-name>.ts` — export a discovery or enrichment function
2. Create a rate limiter instance in `rate-limiter.ts` with appropriate token bucket params
3. Wire into the relevant pipeline phase in `orchestrator.ts` (Phase 1 for discovery, Phase 2 for enrichment)
4. Add any required API key to `config.ts` Zod schema as optional string
5. Add the env var to `.env.example`
6. Update this file's External Integrations and Environment Variables sections

### Add a new database table
1. Create `supabase/migrations/000XX_<name>.sql` with `CREATE TABLE` (include `user_id` FK to `auth.users`)
2. Add RLS policy in a subsequent migration: `CREATE POLICY ... USING ((SELECT auth.uid()) = user_id)`
3. Run `supabase migration up --local` to apply
4. Regenerate types: `supabase gen types typescript --local > packages/frontend/src/lib/database.types.ts`
5. Add TypeScript interface to `packages/scraper/src/types.ts` if scraper needs access
6. Update this file's Architecture section

### Add a new frontend view
1. Create `packages/frontend/src/views/<Name>View.vue` using `<script setup lang="ts">`
2. Add route in `packages/frontend/src/router/index.ts` with `meta: { requiresAuth: true }`
3. Create composable in `packages/frontend/src/composables/use<Name>.ts` if view needs its own state
4. Add navigation link in `packages/frontend/src/components/AppLayout.vue`

### Add a new Edge Function
1. Create `supabase/functions/<function-name>/index.ts`
2. Import shared utilities from `supabase/functions/_shared/` (cors, client factories, types)
3. Handle CORS preflight: return early for `OPTIONS` requests with `corsHeaders`
4. Use `createUserClient(req.headers.get('Authorization')!)` for user-scoped queries or `createServiceClient()` for admin operations
5. Deploy locally: Supabase serves edge functions automatically from `supabase/functions/`

---

## File Inventory

| File / Directory | Purpose |
|------------------|---------|
| `package.json` | npm workspaces root (scripts: dev, build) |
| `tsconfig.base.json` | Shared TypeScript config (strict, ES2022, ESNext) |
| `.env.example` | Environment variable template |
| `supabase/` | Database migrations, edge functions, local config |
| `supabase/config.toml` | Local Supabase services (ports, auth providers, realtime) |
| `supabase/migrations/` | 11 sequential SQL migrations (businesses, contacts, scrape_jobs, api_cache, RLS, realtime, search queries, rename) |
| `supabase/seed.sql` | Database seed data |
| `supabase/functions/_shared/` | Shared edge function utilities (CORS, client factories, types) |
| `supabase/functions/export-csv/` | CSV export edge function (auth'd, best contact per business) |
| `supabase/functions/enrich-single/` | Single-business enrichment edge function |
| `packages/frontend/` | Vue 3 + PrimeVue + Leaflet SPA |
| `packages/frontend/src/composables/` | Vue 3 composition API state (useAuth, useBusinesses, useJobs, etc.) |
| `packages/frontend/src/views/` | Page components (Login, Dashboard, BusinessDetail, Jobs) |
| `packages/frontend/src/components/` | Reusable UI (AppLayout, LeadsTable, LeadsMap, SearchControls, etc.) |
| `packages/scraper/` | Node.js Express scraper service |
| `packages/scraper/src/pipeline/` | Job orchestrator, queue, rate limiter |
| `packages/scraper/src/sources/` | Data source modules (Google Places, Maps scraper, website, Yelp) |
| `packages/scraper/src/geo/` | Haversine distance calculation + campaign categorization |
| `docs/PLAN.md` | Original implementation plan |
| `CLAUDE.md` | This file |
| `CLAUDE_TEMPLATE.md` | Template used to generate this file |
| `docs/CLAUDE.md/plans/` | Plan, implementation, and audit records (epoch-prefixed directories) |
| `docs/CLAUDE.md/testing-checklist.md` | QA testing checklist |
| `docs/CLAUDE.md/version-history.md` | Version history table |
| `docs/CLAUDE.md/future-improvements.md` | Ideas backlog |

---

## Build Instructions

### Prerequisites
- Node.js 18+
- npm 9+
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (`brew install supabase/tap/supabase`)
- Docker (required by Supabase local dev)

### Quick Start
```bash
npm install                          # Install all workspace dependencies
cp .env.example .env                 # Create env file, fill in keys from supabase start
supabase start                       # Boot local PostgreSQL, Auth, Realtime, Studio
npm run dev                          # Start scraper (:3737) + frontend (:5173)
```

### All Commands
```bash
npm run dev                          # Start scraper + frontend concurrently
npm run dev:scraper                  # Start scraper only (Express on :3737)
npm run dev:frontend                 # Start frontend only (Vite on :5173)
npm run build                        # Build all packages (TypeScript check + Vite)
npm run build:frontend               # Build frontend only
supabase start                       # Boot all local Supabase services
supabase stop                        # Stop local Supabase
supabase db reset                    # Reset DB, re-run all migrations + seeds
supabase migration up --local        # Apply pending migrations only
```

### Key Ports
- Frontend: `5173` (Vite dev server, proxies `/api` to `:3737`)
- Scraper: `3737` (Express API)
- Supabase API: `54321`, DB: `54322`, Studio: `54323`, Inbucket (email): `54324`

### Troubleshooting Build
- **"Cannot find module '@supabase/supabase-js'"** — Run `npm install` from monorepo root (workspaces hoist dependencies)
- **"Supabase not running"** — Run `supabase start` and ensure Docker is running
- **"Invalid environment variables"** — Check `.env` has all required vars from `supabase start` output; scraper validates with Zod on startup and prints specific missing/invalid vars
- **OAuth login redirects to error** — Ensure OAuth provider env vars are set in `.env` and Supabase was restarted after setting them (`supabase stop && supabase start`)

---

## Testing

No test framework is configured yet. See `docs/CLAUDE.md/testing-checklist.md` for the manual QA testing checklist.

### Manual Verification
1. `supabase start` → all services running
2. `npm run dev` → scraper on :3737, frontend on :5173
3. OAuth login works → session persists
4. Campaign search creates job → scraper discovers businesses
5. Realtime progress updates in UI
6. Table + map show businesses with distance/status
7. Business detail shows contacts
8. CSV export downloads with "Business" column header
9. Multi-user RLS isolation works

---

## Future Improvements

See `docs/CLAUDE.md/future-improvements.md` for the ideas backlog.

---

## Maintaining This File

### When to update CLAUDE.md
- **Adding a new subsystem or module** — add it to Architecture and File Inventory
- **Adding a new setting or config field** — update the Settings section and Common Modifications
- **Discovering a new bug class** — add a Development Rule to prevent recurrence
- **Changing the build process** — update Build Instructions and/or Build Configuration
- **Adding/changing env vars or build defines** — update Build Configuration > Environment Variables
- **Changing linting or style rules** — update Code Style
- **Integrating a new third-party service or SDK** — add to External Integrations
- **Bumping the version** — update the version in Project Overview
- **Adding/removing files** — update File Inventory
- **Finding a new limitation** — add to Known Issues

### Supplementary docs
For sections that grow large (display layouts, testing checklists, changelogs), move them to separate files under `docs/` and link from here. This keeps the main CLAUDE.md scannable while preserving detail.

### Future improvements tracking
When a new feature is added and related enhancements or follow-up ideas are suggested but declined, add them as `- [ ]` items to `docs/CLAUDE.md/future-improvements.md`. This preserves good ideas for later without cluttering the current task.

### Version history maintenance
When making changes that are committed to the repository, add a row to the version history table in `docs/CLAUDE.md/version-history.md`. Each entry should include:

- **Ver** — A semantic version identifier (e.g., `v0.1.0`, `v0.2.0`). Follow semver: MAJOR.MINOR.PATCH. Use the most recent entry in the table to determine the next version number.
- **Changes** — A brief summary of what changed.

Append new rows to the bottom of the table. Do not remove or rewrite existing entries.

### Testing checklist maintenance
When adding or modifying user-facing behavior (new settings, UI modes, protocol commands, or display changes), add corresponding `- [ ]` test items to `docs/CLAUDE.md/testing-checklist.md`. Each item should describe the expected observable behavior, not the implementation detail.

### What belongs here vs. in code comments
- **Here:** Architecture decisions, cross-cutting concerns, "how things fit together," gotchas, recipes
- **In code:** Implementation details, function-level docs, inline explanations of tricky logic

---

## Origin

Created with Claude (Anthropic)
