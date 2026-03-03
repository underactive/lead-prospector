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
