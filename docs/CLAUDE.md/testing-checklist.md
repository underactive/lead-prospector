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
- [ ] Realtime progress → firms_discovered, firms_enriched, total_contacts update live in UI

## Discovery (Phase 1)
- [ ] API mode (with Google Places key) → firms discovered via Places API
- [ ] Scrape mode (without key) → falls back to Google Maps scraping
- [ ] Distance calculation → firms categorized as local (<10mi), mid (10-25mi), remote (>25mi)
- [ ] Deduplication → same firm not inserted twice (unique on user_id + google_place_id)

## Enrichment (Phase 2)
- [ ] Website scraping → staff page found and parsed
- [ ] LinkedIn URL extraction → firm LinkedIn URL populated
- [ ] Yelp enrichment (with key) → rating and review_count populated
- [ ] Failed enrichment → firm marked as "failed" with scrape_error details

## Contact Extraction (Phase 3)
- [ ] Paralegal/office manager contacts extracted from staff pages
- [ ] Attorneys excluded from contact list
- [ ] Seniority scoring applied (Senior Paralegal=3, Paralegal=2, Admin=1)
- [ ] Confidence set: "high" with email, "medium" without

## Dashboard
- [ ] Stats cards show correct counts
- [ ] LeadsTable displays firms with sortable columns
- [ ] LeadsMap shows firms on Leaflet map with correct positions
- [ ] SearchControls filter by campaign, distance, status
- [ ] Clicking a firm row navigates to FirmDetailView

## Firm Detail
- [ ] Firm info displayed (name, address, phone, website, LinkedIn)
- [ ] ContactsList shows extracted contacts for the firm
- [ ] Contacts sorted by seniority score

## Export
- [ ] CSV export downloads file with firm + best contact per firm
- [ ] Export respects current filters

## RLS Isolation
- [ ] User A cannot see User B's firms
- [ ] User A cannot see User B's contacts
- [ ] User A cannot see User B's jobs
- [ ] api_cache table not accessible via anon key
