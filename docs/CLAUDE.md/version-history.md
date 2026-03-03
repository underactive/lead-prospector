# Version History

| Ver | Changes |
|-----|---------|
| v1.0.0 | Initial commit: full-stack application with Vue 3 frontend, Node.js scraper service, Supabase backend, 3-phase pipeline (discovery, enrichment, contact extraction), OAuth auth, realtime job progress, CSV export |
| v2.0.0 | Normalize database: renamed `firms` table to `businesses` throughout entire stack, removed all law-firm-specific logic (contact title filtering, seniority scoring, Yelp category filter, Schema.org type restrictions, hardcoded search queries). Tool is now general-purpose for any business type. Search queries are user-provided (required). |
