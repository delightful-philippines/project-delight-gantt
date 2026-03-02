-- Migration 005: baselines table
-- Stores project snapshots (Baseline interface from src/types.ts).
-- The full tasksById snapshot is stored as JSONB for efficiency —
-- baselines are read-only snapshots so no relational overhead needed.

CREATE TABLE IF NOT EXISTS baselines (
  id          SERIAL      PRIMARY KEY,
  project_id  TEXT        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),     -- mapped to Baseline.timestamp
  tasks_json  JSONB       NOT NULL DEFAULT '{}',      -- Baseline.tasksById snapshot
  project_json JSONB      NOT NULL DEFAULT '{}'       -- Baseline.project snapshot
);

CREATE INDEX IF NOT EXISTS idx_baselines_project_id ON baselines(project_id);
