# Lead Prospector — Implementation Plan

## Context

Build a full-stack lead generation tool for finding immigration law firms near Austin, TX. Two campaigns:
1. **Local Leads** (<10mi from downtown Austin) — firms to visit in person for document services
2. **Remote Leads** (>25mi from Austin) — firms that need to ship documents

Collects: firm name, address, website, LinkedIn company page, senior paralegal/office manager name, email (if available). No paid tools (Apollo, Hunter.io). Dual-mode: Google APIs when keys are available, scraping fallback when not.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Auth | Supabase Auth — GitHub, Google, Discord OAuth only |
| Database | Supabase PostgreSQL with RLS |
| Quick backend tasks | Supabase Edge Functions (Deno) — CSV export, single-firm enrich |
| Batch scraping | Node.js service (`packages/scraper`) — discovery jobs, bulk enrichment |
| Realtime | Supabase Realtime — job progress updates |
| Frontend | Vue 3 + TypeScript + PrimeVue 4 + Leaflet.js |
| Build | Vite |
| Package manager | npm workspaces |

**Hybrid architecture rationale**: Edge Functions handle short-lived tasks (export CSV, enrich a single firm). A Node.js service handles batch discovery and enrichment jobs with no execution time limits, proper rate limiting with in-memory state, and sequential pipeline processing.

---

## Directory Structure

```
soe/
├── package.json                        # Root monorepo (name: "lead-prospector")
├── tsconfig.base.json
├── .env.example
├── .gitignore
├── supabase/
│   ├── config.toml                     # Supabase CLI config
│   ├── migrations/
│   │   ├── 00001_create_firms.sql
│   │   ├── 00002_create_contacts.sql
│   │   ├── 00003_create_scrape_jobs.sql
│   │   ├── 00004_create_api_cache.sql
│   │   ├── 00005_enable_rls.sql
│   │   ├── 00006_create_rls_policies.sql
│   │   └── 00007_enable_realtime.sql
│   ├── seed.sql
│   └── functions/
│       ├── _shared/
│       │   ├── supabase-client.ts      # Service role + user client factories
│       │   ├── cors.ts                 # CORS headers
│       │   └── types.ts               # Shared types
│       ├── export-csv/
│       │   └── index.ts               # CSV export (auth'd, uses user client)
│       └── enrich-single/
│           └── index.ts               # Enrich one firm on demand
├── packages/
│   ├── scraper/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts               # Entry: Express server for job triggers
│   │       ├── config.ts              # Zod-validated env config
│   │       ├── types.ts               # Shared types
│   │       ├── supabase.ts            # Service-role Supabase client
│   │       ├── geo/
│   │       │   └── haversine.ts       # Distance calc + categorization
│   │       ├── pipeline/
│   │       │   ├── orchestrator.ts    # 3-phase pipeline coordinator
│   │       │   ├── job-queue.ts       # In-process sequential queue
│   │       │   └── rate-limiter.ts    # Token-bucket per source
│   │       └── sources/
│   │           ├── google-places.ts       # Google Places API (primary)
│   │           ├── google-maps-scraper.ts # Scraping fallback
│   │           ├── google-search.ts       # LinkedIn lookup via Custom Search
│   │           ├── website-scraper.ts     # Cheerio staff page extraction
│   │           └── yelp.ts               # Supplementary
│   └── frontend/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── env.d.ts
│       ├── index.html
│       └── src/
│           ├── main.ts                # Vue + PrimeVue + Router bootstrap
│           ├── App.vue
│           ├── lib/
│           │   ├── supabase.ts        # Supabase client singleton
│           │   └── database.types.ts  # Generated: supabase gen types
│           ├── composables/
│           │   ├── useAuth.ts         # Auth state + OAuth sign-in/out
│           │   ├── useFirms.ts        # Firms CRUD via Supabase client
│           │   ├── useContacts.ts     # Contacts read via Supabase client
│           │   ├── useJobs.ts         # Job CRUD + trigger scraper
│           │   ├── useRealtime.ts     # Supabase Realtime for job progress
│           │   └── useExport.ts       # Invoke export-csv edge function
│           ├── router/
│           │   └── index.ts           # Routes + auth guards
│           ├── views/
│           │   ├── LoginView.vue      # OAuth buttons (GitHub, Google, Discord)
│           │   ├── DashboardView.vue  # Stats + search + map + table
│           │   ├── FirmDetailView.vue # Single firm + contacts
│           │   └── JobsView.vue       # Scraping job management
│           └── components/
│               ├── AppLayout.vue      # Sidebar + topbar shell
│               ├── SearchControls.vue # Location, radius, campaign presets
│               ├── LeadsTable.vue     # PrimeVue DataTable
│               ├── LeadsMap.vue       # Leaflet + OpenStreetMap
│               ├── ContactsList.vue   # Contacts for a firm
│               ├── JobProgress.vue    # Realtime progress bar
│               └── ExportButton.vue   # CSV download trigger
```

---

## Database Schema (Supabase Migrations)

### Migration 1: `firms`

```sql
CREATE TABLE firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_place_id TEXT,
  name TEXT NOT NULL,
  address TEXT, city TEXT, state TEXT DEFAULT 'TX', zip TEXT,
  phone TEXT, website TEXT, google_maps_url TEXT,
  latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
  distance_miles DOUBLE PRECISION,
  linkedin_url TEXT, yelp_url TEXT,
  rating REAL, review_count INT DEFAULT 0,
  campaign TEXT NOT NULL CHECK (campaign IN ('local', 'mid', 'remote')),
  scrape_status TEXT DEFAULT 'discovered'
    CHECK (scrape_status IN ('discovered', 'enriching', 'enriched', 'failed')),
  scrape_error TEXT,
  job_id UUID,
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_place_id)
);
```

### Migration 2: `contacts`

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT, phone TEXT, linkedin_url TEXT,
  source TEXT CHECK (source IN ('website', 'google_search', 'state_bar')),
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  seniority_score INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Migration 3: `scrape_jobs`

```sql
CREATE TABLE scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  campaign TEXT NOT NULL CHECK (campaign IN ('local', 'remote')),
  mode TEXT NOT NULL DEFAULT 'scrape' CHECK (mode IN ('api', 'scrape')),
  search_location TEXT NOT NULL DEFAULT 'Austin, TX',
  search_lat DOUBLE PRECISION NOT NULL DEFAULT 30.2672,
  search_lng DOUBLE PRECISION NOT NULL DEFAULT -97.7431,
  min_radius_miles REAL DEFAULT 0,
  max_radius_miles REAL NOT NULL,
  firms_discovered INT DEFAULT 0, firms_enriched INT DEFAULT 0,
  firms_failed INT DEFAULT 0, total_contacts INT DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Migration 4: `api_cache`

```sql
CREATE TABLE api_cache (
  cache_key TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  response_json TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Migrations 5-7: RLS + Realtime

- Enable RLS on all tables
- Per-user policies using `(SELECT auth.uid()) = user_id` pattern
- `api_cache` accessible only to service_role
- Realtime enabled on `scrape_jobs`

---

## Scraper Service (`packages/scraper`)

### Pipeline (3 phases)

**Phase 1 — Discovery**: Google Places API or Maps scraping fallback. Haversine distance from downtown Austin. Categorize: <10mi=local, 10-25mi=mid, >25mi=remote.

**Phase 2 — Enrichment**: Website scraping for staff pages. Google Custom Search for LinkedIn URLs.

**Phase 3 — Contact Extraction**: Cheerio HTML parsing for staff names/titles/emails. Target: paralegals, office managers. Exclude attorneys. Seniority scoring.

### Rate Limiting (token-bucket)
- Google Places: 10 req/min
- Google Custom Search: 5 req/min
- Website scraping: 3 req/min
- Yelp: 50 req/min

---

## Edge Functions

- **export-csv**: Auth'd CSV export with best contact per firm
- **enrich-single**: On-demand single firm enrichment

---

## Frontend

### Auth: GitHub, Google, Discord OAuth via Supabase Auth

### Dashboard: Stats cards + SearchControls + LeadsMap (Leaflet) + LeadsTable (PrimeVue DataTable) + ExportButton

### Data Flow
- CRUD: Frontend → Supabase client → PostgreSQL (RLS)
- Scrape jobs: Frontend creates job row → calls scraper POST /api/jobs/start
- Progress: Scraper updates Supabase → Realtime pushes to frontend
- Export: Frontend → Edge Function → CSV file

---

## Environment Variables

See `.env.example` in project root.

---

## Verification Checklist

1. `supabase start` → all services running
2. `npm run dev` → scraper on :3737, frontend on :5173
3. OAuth login works → session persists
4. Campaign search creates job → scraper discovers firms
5. Realtime progress updates in UI
6. Table + map show firms with distance/status
7. Firm detail shows contacts
8. CSV export downloads
9. Multi-user RLS isolation works
