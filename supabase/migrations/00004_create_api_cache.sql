CREATE TABLE api_cache (
  cache_key TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  response_json TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cache_expires ON api_cache(expires_at);
