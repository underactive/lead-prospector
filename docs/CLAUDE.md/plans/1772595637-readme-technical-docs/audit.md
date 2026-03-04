# Audit Report: Update README with Database Structure, Job API, and Scraper Internals

## Files Changed

- `README.md` — All findings below are in the new sections (lines 146–331)

---

## 1. QA Audit

### [FIXED] Missing `min_radius_miles`/`max_radius_miles` in scrape_jobs schema (Medium)
The `scrape_jobs` table documentation omitted `min_radius_miles` (REAL, default 0) and `max_radius_miles` (REAL, NOT NULL). The latter is required on insert, making this a meaningful omission for anyone using the README as a schema reference.

### [FIXED] Cancellation description inaccurate (Low)
README stated cancellation happens "between pipeline phases" but the orchestrator checks `isCancelled()` per-business within Phase 2 and Phase 3, not just at phase boundaries.

### [FIXED] Phase 2/3 contact extraction ambiguity (Low)
Phase 2 extracts contacts into memory; Phase 3 persists them. The original wording made this unclear.

### Missing `created_at`/`updated_at` across all tables (Low)
Standard timestamp columns omitted from all four table schemas. Intentionally left out to reduce noise — these are implicit metadata fields.

---

## 2. Security Audit

No issues found. Documentation contains no secrets, credentials, or sensitive implementation details inappropriate for a public README.

---

## 3. Interface Contract Audit

### API endpoints, Zod schema, rate limiters, source modules — all match source code.

### Pre-existing code issues discovered (not README bugs):
- `Contact.confidence` typed as `number | null` in TypeScript but `TEXT` in DB (High — code issue)
- `ScrapeJob` TypeScript interface missing 5 DB fields: `search_location`, `search_lat`, `search_lng`, `businesses_failed`, `log` (Medium — code issue)
- `Contact` TypeScript interface has phantom `updated_at` field not in DB (Low — code issue)

### [FIXED] Missing `min_radius_miles`/`max_radius_miles` in README (Low)
Same as QA finding #1. Added to scrape_jobs table.

### `/api/health` response simplification (Info)
README says `{ status: "ok" }` but actual response includes `service` and `timestamp`. Acceptable simplification.

---

## 4. State Management Audit

Not applicable — documentation-only change.

---

## 5. Resource & Concurrency Audit

Not applicable — documentation-only change.

---

## 6. Testing Coverage Audit

Not applicable — documentation-only change.

---

## 7. DX & Maintainability Audit

### Pre-existing `soe/` typo in Project Structure (High — pre-existing)
The Project Structure section labels the root directory as `soe/` which is incorrect. This was present before this change and is out of scope.

### [FIXED] Missing `min_radius_miles`/`max_radius_miles` (Medium)
Same as QA finding #1.

### CLAUDE.md content overlap (Medium — accepted)
The new README sections overlap with CLAUDE.md Architecture/Key Subsystems sections. This is intentional — README is user-facing documentation, CLAUDE.md is agent context. Both serve different audiences.

### Missing `created_at`/`updated_at` (Low — accepted)
Same rationale as QA audit — intentionally omitted as standard metadata fields.
