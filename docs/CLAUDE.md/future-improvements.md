# Future Improvements (Ideas)

## Testing
- [ ] Add Vitest for frontend unit tests (composables, router guards)
- [ ] Add integration tests for scraper pipeline phases
- [ ] Add API endpoint tests for scraper Express routes

## Scraping & Data Quality
- [ ] Persistent job queue (survive scraper restarts)
- [ ] Retry failed enrichments with exponential backoff
- [ ] State bar lookup as additional contact source
- [ ] Email verification/validation before storing
- [ ] Proxy rotation for website scraping to avoid IP blocks
- [ ] Configurable search queries beyond "immigration lawyer/attorney"

## Frontend
- [ ] Pagination for firms table (currently loads all at once)
- [ ] Bulk actions on selected firms (re-enrich, delete)
- [ ] Dark mode theme
- [ ] Dashboard analytics charts (firms over time, campaign distribution)
- [ ] Firm notes/tags for user annotations

## Infrastructure
- [ ] ESLint + Prettier configuration
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Production deployment configuration
- [ ] Horizontal scaling for scraper service
- [ ] Redis-backed rate limiter and job queue for multi-instance support

## Search & Discovery
- [ ] Configurable search center (not just Austin, TX)
- [ ] Multiple search locations per campaign
- [ ] Custom radius ranges per campaign
- [ ] Additional practice area support beyond immigration law
