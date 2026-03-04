# Lead Prospector

A full-stack lead generation tool for finding and qualifying local businesses. Enter any business type (e.g., "immigration lawyer", "offroad fabrication", "dental clinic") and a location to discover, enrich, and export leads. Supports two campaign types:

- **Local Leads** — businesses within ~10 miles for in-person visits
- **Remote Leads** — businesses 25+ miles away for remote outreach

Built with Vue 3, PrimeVue 4, Leaflet.js, Supabase (Auth, PostgreSQL, Realtime), and a Node.js scraper service.

## Prerequisites

- Node.js 18+
- npm 9+
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (`brew install supabase/tap/supabase`)
- Docker (required by Supabase local dev)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start Supabase

```bash
supabase start
```

This boots PostgreSQL, Auth, Realtime, Studio, and Edge Functions locally via Docker. On first run it pulls the required images — this takes a few minutes.

Once running, the CLI prints your local credentials:

```
API URL: http://127.0.0.1:54321
anon key: eyJ...
service_role key: eyJ...
Studio URL: http://127.0.0.1:54323
```

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in the keys from `supabase start` output:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` |
| `VITE_SUPABASE_ANON_KEY` | The `anon key` from output |
| `SUPABASE_SERVICE_ROLE_KEY` | The `service_role key` from output |

### 4. Run the app

```bash
npm run dev
```

This starts both the scraper service (`:3737`) and the frontend (`:5173`).

Open [http://localhost:5173](http://localhost:5173) in your browser.

## OAuth Setup

The app uses Supabase Auth with three OAuth providers. For local development, you need to create OAuth apps with each provider and set the corresponding env vars.

**Callback URL for all providers:**
```
http://127.0.0.1:54321/auth/v1/callback
```

### GitHub

1. Go to [GitHub Developer Settings > OAuth Apps](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set **Homepage URL** to `http://localhost:5173`
4. Set **Authorization callback URL** to `http://127.0.0.1:54321/auth/v1/callback`
5. Copy the **Client ID** and generate a **Client Secret**
6. Add to `.env`:
   ```
   SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=<client_id>
   SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=<client_secret>
   ```

### Google

1. Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. Create a new **OAuth 2.0 Client ID** (Web application)
3. Add `http://localhost:5173` to **Authorized JavaScript origins**
4. Add `http://127.0.0.1:54321/auth/v1/callback` to **Authorized redirect URIs**
5. Copy the **Client ID** and **Client Secret**
6. Add to `.env`:
   ```
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<client_id>
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<client_secret>
   ```

### Discord

1. Go to [Discord Developer Portal > Applications](https://discord.com/developers/applications)
2. Create a new application, go to **OAuth2**
3. Add `http://127.0.0.1:54321/auth/v1/callback` to **Redirects**
4. Copy the **Client ID** and **Client Secret** (under OAuth2)
5. Add to `.env`:
   ```
   SUPABASE_AUTH_EXTERNAL_DISCORD_CLIENT_ID=<client_id>
   SUPABASE_AUTH_EXTERNAL_DISCORD_SECRET=<client_secret>
   ```

After setting OAuth env vars, restart Supabase for the changes to take effect:

```bash
supabase stop && supabase start
```

## API Keys (Optional)

### Google Places API

Enables "API mode" for business discovery (faster, more reliable than scraping).

1. Go to [Google Cloud Console > APIs & Services](https://console.cloud.google.com/apis/library)
2. Enable the **Places API (New)**
3. Create an API key under **Credentials**
4. Add to `.env`:
   ```
   GOOGLE_PLACES_API_KEY=<your_key>
   ```

Without this key, the scraper falls back to scrape mode.

### Yelp Fusion API

Supplements business data with ratings and reviews.

1. Go to [Yelp Fusion](https://fusion.yelp.com/)
2. Create an app and copy the API key
3. Add to `.env`:
   ```
   YELP_API_KEY=<your_key>
   ```

## Database Schema

Four tables power the application. All user-facing tables enforce row-level security (RLS) — every query is scoped to `auth.uid() = user_id`.

### Tables

**businesses** — Discovered business leads

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → `auth.users` (CASCADE) |
| `job_id` | UUID | FK → `scrape_jobs` (SET NULL) |
| `google_place_id` | TEXT | Unique per user (dedup key) |
| `name` | TEXT | Required |
| `address`, `city`, `state`, `zip` | TEXT | Location fields (`state` defaults to `'TX'`) |
| `phone`, `website`, `google_maps_url` | TEXT | Contact/link fields |
| `latitude`, `longitude` | DOUBLE PRECISION | Coordinates from discovery |
| `distance_miles` | DOUBLE PRECISION | Haversine distance from search center |
| `linkedin_url`, `yelp_url` | TEXT | Enrichment results |
| `rating` | REAL | Google/Yelp rating |
| `review_count` | INT | Default `0` |
| `campaign` | TEXT | `'local'`, `'mid'`, or `'remote'` |
| `scrape_status` | TEXT | `'discovered'` → `'enriching'` → `'enriched'` or `'failed'` |
| `scrape_error` | TEXT | Error detail if enrichment failed |
| `enriched_at` | TIMESTAMPTZ | When enrichment completed |

**contacts** — People extracted from business websites

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → `auth.users` (CASCADE) |
| `business_id` | UUID | FK → `businesses` (CASCADE) |
| `name` | TEXT | Required |
| `title`, `email`, `phone` | TEXT | Contact details |
| `linkedin_url` | TEXT | LinkedIn profile URL |
| `source` | TEXT | `'website'`, `'google_search'`, or `'directory'` |
| `confidence` | TEXT | `'high'` (has email), `'medium'`, or `'low'` |
| `seniority_score` | INT | Default `0` |

**scrape_jobs** — Job tracking and progress

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → `auth.users` (CASCADE) |
| `status` | TEXT | `'pending'`, `'running'`, `'completed'`, `'failed'`, `'cancelled'` |
| `campaign` | TEXT | `'local'` or `'remote'` |
| `mode` | TEXT | `'api'` or `'scrape'` |
| `search_location` | TEXT | Human-readable location (default: `'Austin, TX'`) |
| `search_lat`, `search_lng` | DOUBLE PRECISION | Search center coordinates |
| `search_queries` | TEXT[] | Array of search terms |
| `min_radius_miles` | REAL | Default `0` |
| `max_radius_miles` | REAL | Required (NOT NULL) |
| `businesses_discovered` | INT | Phase 1 counter |
| `businesses_enriched` | INT | Phase 2 counter |
| `businesses_failed` | INT | Phase 2 error counter |
| `total_contacts` | INT | Phase 3 counter |
| `log` | TEXT | Timestamped pipeline log lines |
| `error` | TEXT | Top-level job error |
| `started_at`, `completed_at` | TIMESTAMPTZ | Job timing |

**api_cache** — Cached API responses (service_role only, no user_id)

| Column | Type | Notes |
|--------|------|-------|
| `cache_key` | TEXT | Primary key |
| `source` | TEXT | API source identifier |
| `response_json` | TEXT | Cached response body |
| `expires_at` | TIMESTAMPTZ | TTL expiry |

### Relationships

```
auth.users ──┬── businesses ──── contacts
             │        │
             │        └── scrape_jobs (via job_id)
             │
             ├── contacts
             └── scrape_jobs
```

- Deleting a user cascades to all their businesses, contacts, and jobs
- Deleting a business cascades to its contacts
- Deleting a job sets `businesses.job_id` to NULL (doesn't delete businesses)

### Realtime

The `scrape_jobs` table is published to Supabase Realtime. The frontend subscribes to `UPDATE` events filtered by job ID to receive live progress counters.

## Scraper API

The scraper runs as an Express server on port `3737`. During development, Vite proxies `/api` requests to the scraper automatically.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check — returns `{ status: "ok" }` |
| POST | `/api/jobs/start` | Start a scraping job |
| GET | `/api/jobs/:id/status` | Poll job status from the database |
| POST | `/api/jobs/:id/cancel` | Cancel a running or queued job |

### Job Start Payload

The frontend inserts a job record into `scrape_jobs` via Supabase first, then POSTs to the scraper to begin processing:

```json
{
  "jobId": "uuid",
  "userId": "uuid",
  "campaign": "local | remote",
  "mode": "api | scrape",
  "searchLocation": "Austin, TX",
  "searchLat": 30.2672,
  "searchLng": -97.7431,
  "searchQueries": ["plumber", "electrician"]
}
```

### Validation (Zod)

| Field | Rule |
|-------|------|
| `jobId` | Valid UUID |
| `userId` | Valid UUID |
| `campaign` | `"local"` or `"remote"` |
| `mode` | `"api"` or `"scrape"` |
| `searchQueries` | 1–5 strings, each 2–100 characters |
| `searchLocation` | String (defaults to `"Austin, TX"`) |
| `searchLat`, `searchLng` | Numbers (default to Austin coordinates) |

## How the Scraper Works

### Job Queue

Jobs run one at a time in FIFO order. The queue is in-memory — state is lost on restart. When a job is enqueued, it either starts immediately (if idle) or waits behind the current job. Cancellation removes queued jobs instantly; running jobs check for cancellation before processing each business.

### 3-Phase Pipeline

Each job runs three phases sequentially. The pipeline checks for cancellation between phases.

**Phase 1 — Discovery**
Searches for businesses matching the user's queries near the search location. Uses Google Places API (if key configured) or falls back to Google Maps HTML scraping. Results are deduplicated by `google_place_id` and filtered by campaign type using Haversine distance from the search center:

- **Local:** < 10 miles
- **Mid:** 10–25 miles (stored but not assigned to either campaign)
- **Remote:** > 25 miles

Discovered businesses are upserted into the `businesses` table with `scrape_status: "discovered"`.

**Phase 2 — Enrichment** (per business)
For each discovered business:
1. Scrapes the business website (Cheerio) to find staff/team pages, extracting contacts and LinkedIn URLs into memory
2. Searches Yelp for ratings and review counts (if API key configured)
3. Updates the business record with enrichment data and sets `scrape_status: "enriched"` (or `"failed"` on error)

**Phase 3 — Contact Insertion**
Persists all contacts collected during enrichment into the `contacts` table. Contacts with an email get `confidence: "high"`; those without get `confidence: "medium"`.

### Rate Limiting

Token-bucket rate limiters throttle external API calls:

| Source | Limit |
|--------|-------|
| Google Places API | 10 requests/min |
| Website scraping | 3 requests/min |
| Yelp API | 50 requests/min |

Each `acquire()` call blocks until a token is available. Limiters are in-memory and reset on restart.

### Source Modules

| Module | Purpose |
|--------|---------|
| `google-places.ts` | Places API v1 text search with location bias and pagination |
| `google-maps-scraper.ts` | Fallback HTML scraping when no API key (fragile) |
| `website-scraper.ts` | Cheerio-based scraping for staff pages, emails, LinkedIn URLs |
| `yelp.ts` | Yelp Fusion API search for ratings and review counts |

### Progress Reporting

The pipeline updates the `scrape_jobs` row after each significant step (businesses discovered, each business enriched, contacts inserted). These updates flow through Supabase Realtime to the frontend via WebSocket, powering the live progress display.

## Project Structure

```
soe/
├── supabase/           # Migrations, edge functions, config
│   ├── migrations/     # SQL schema migrations
│   ├── functions/      # Deno edge functions (export-csv, enrich-single)
│   └── config.toml     # Local Supabase configuration
├── packages/
│   ├── scraper/        # Node.js scraping service
│   │   └── src/
│   │       ├── pipeline/   # Job orchestrator, rate limiter
│   │       └── sources/    # Google Places, website scraper, etc.
│   └── frontend/       # Vue 3 + PrimeVue + Leaflet
│       └── src/
│           ├── views/      # Dashboard, BusinessDetail, Jobs, Login
│           ├── components/ # SearchControls, LeadsTable, LeadsMap, etc.
│           └── composables/# useAuth, useBusinesses, useJobs, useRealtime
└── package.json        # npm workspaces root
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start scraper + frontend |
| `npm run dev:scraper` | Start scraper only |
| `npm run dev:frontend` | Start frontend only |
| `npm run build` | Build all packages |
| `supabase start` | Start local Supabase |
| `supabase stop` | Stop local Supabase |
| `supabase migration up --local` | Apply pending migrations |
| `supabase db reset` | Reset DB and re-run all migrations + seeds |
| `supabase studio` | Open Supabase Studio at :54323 |
