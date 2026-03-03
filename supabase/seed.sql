-- Seed data is user-scoped (requires auth), so this is intentionally minimal.
-- After signing in, use the scraper to populate firms and contacts.

-- Clean up expired cache entries
DELETE FROM api_cache WHERE expires_at < NOW();
