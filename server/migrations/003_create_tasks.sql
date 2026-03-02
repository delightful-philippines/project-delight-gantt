-- Migration 003: tasks table
-- Mirrors the Task interface from src/types.ts
-- Dependencies are stored in a separate join table (004).

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT        PRIMARY KEY,              -- id("task") nanoid
  project_id   TEXT        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id    TEXT        REFERENCES tasks(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  start_date   DATE        NOT NULL,
  end_date     DATE        NOT NULL,
  duration     INTEGER     NOT NULL DEFAULT 0,
  bg_color     TEXT        NOT NULL DEFAULT '#0f8b8d',
  text_color   TEXT        NOT NULL DEFAULT '#ffffff',
  is_summary   BOOLEAN     NOT NULL DEFAULT FALSE,
  is_milestone BOOLEAN     NOT NULL DEFAULT FALSE,
  is_critical  BOOLEAN     NOT NULL DEFAULT FALSE,
  level        INTEGER     NOT NULL DEFAULT 0,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  progress     INTEGER     NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  assignee     TEXT        NOT NULL DEFAULT 'Unassigned',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast project-scoped queries
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id  ON tasks(parent_id);

-- Auto-update trigger
DO $$ BEGIN
  CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
