-- Migration 001: schema_migrations bootstrap table
-- This must run FIRST — it tracks which migrations have been applied.

CREATE TABLE IF NOT EXISTS schema_migrations (
  id          SERIAL PRIMARY KEY,
  filename    TEXT        NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
