-- Migration 002: projects table
-- Mirrors the Project interface from src/types.ts

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT        PRIMARY KEY,              -- id("project") nanoid
  name         TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  start_date   DATE        NOT NULL,
  end_date     DATE        NOT NULL,
  lead         TEXT        NOT NULL DEFAULT 'Unassigned',
  progress     INTEGER     NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatically keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
