# Plan: Update README with Database Structure, Job API, and Scraper Internals

## Objective

Add three new technical documentation sections to README.md covering database schema, scraper API endpoints, and scraper pipeline internals. These sections fill a gap between setup instructions and file structure.

## Changes

### File: `README.md`

Insert three sections between "API Keys (Optional)" (line 145) and "Project Structure" (line 146):

1. **Database Schema** — Tables, columns, relationships, RLS policies
2. **Scraper API** — Endpoints, payload shape, validation rules
3. **How the Scraper Works** — Pipeline phases, queue, rate limiter, source modules, progress reporting

## Dependencies

- None. Single-file change to README.md.

## Risks / Open Questions

- None. Documentation-only change with no code impact.
