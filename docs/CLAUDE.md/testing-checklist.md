# Testing Checklist

## Authentication
- [ ] GitHub OAuth login → session created, redirects to dashboard
- [ ] Google OAuth login → session created, redirects to dashboard
- [ ] Discord OAuth login → session created, redirects to dashboard
- [ ] Sign out → session cleared, redirected to login
- [ ] Unauthenticated access to `/` → redirected to `/login`
- [ ] Authenticated access to `/login` → redirected to dashboard

## Job Management
- [ ] Create local campaign job → job row created with status "pending"
- [ ] Create remote campaign job → job row created with correct radius
- [ ] Start job → scraper picks up job, status changes to "running"
- [ ] Cancel running job → status changes to "cancelled", pipeline stops between phases
- [ ] Realtime progress → businesses_discovered, businesses_enriched, total_contacts update live in UI

## Discovery (Phase 1)
- [ ] API mode (with Google Places key) → businesses discovered via Places API
- [ ] Scrape mode (without key) → falls back to Google Maps scraping
- [ ] Distance calculation → businesses categorized as local (<10mi), mid (10-25mi), remote (>25mi)
- [ ] Deduplication → same business not inserted twice (unique on user_id + google_place_id)
- [ ] User-provided search queries used (no hardcoded defaults)
- [ ] Schema.org type filter accepts any business type with name and address

## Enrichment (Phase 2)
- [ ] Website scraping → staff/team/about page found and parsed
- [ ] LinkedIn URL extraction → business LinkedIn URL populated
- [ ] Yelp enrichment (with key) → rating and review_count populated (no category filter)
- [ ] Failed enrichment → business marked as "failed" with scrape_error details

## Contact Extraction (Phase 3)
- [ ] All persons extracted from staff pages (no role-based filtering)
- [ ] All contacts get seniority_score of 0
- [ ] Confidence set: "high" with email, "medium" without
- [ ] Contact source types: website, google_search, directory

## Dashboard
- [ ] Stats cards show "Total Businesses" (not "Firms")
- [ ] LeadsTable displays businesses with sortable columns
- [ ] LeadsMap shows businesses on Leaflet map with correct positions
- [ ] SearchControls start with empty search query input
- [ ] SearchControls placeholder shows generic examples (e.g. "plumber, electrician, dentist")
- [ ] Clicking a business row navigates to BusinessDetailView at `/businesses/:id`

## Business Detail
- [ ] Business info displayed (name, address, phone, website, LinkedIn)
- [ ] ContactsList shows extracted contacts for the business
- [ ] No law-firm-specific role highlighting on contacts

## Export
- [ ] CSV export downloads file with "Business" column header (not "Firm")
- [ ] Export uses `businesses` table and `business_id` for contacts
- [ ] Export respects current filters

## RLS Isolation
- [ ] User A cannot see User B's businesses
- [ ] User A cannot see User B's contacts
- [ ] User A cannot see User B's jobs
- [ ] api_cache table not accessible via anon key

## Database Migration (v2.0.0)
- [ ] `supabase db reset` applies all migrations cleanly including rename
- [ ] `businesses` table exists (not `firms`)
- [ ] `scrape_jobs` has `businesses_discovered`, `businesses_enriched`, `businesses_failed` columns
- [ ] `contacts` has `business_id` column (not `firm_id`)
- [ ] RLS policies on `businesses` table enforce user isolation
- [ ] Contact source CHECK constraint includes `directory` (not `state_bar`)
