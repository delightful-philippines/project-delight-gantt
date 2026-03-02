-- ============================================================
-- Project Delight Gantt — Full Database Setup
-- ============================================================
-- Run this ONCE in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → paste & Run
-- After this, the auto-migration runner takes over for future changes.
-- ============================================================


-- ── 1. Helper: exec_sql (enables the Node.js migration runner) ──
CREATE OR REPLACE FUNCTION exec_sql(query TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE query;
END;
$$;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;


-- ── 2. Migration tracker ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  id          SERIAL PRIMARY KEY,
  filename    TEXT        NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mark 001 as applied (we're doing it manually here)
INSERT INTO schema_migrations (filename) VALUES ('001_schema_migrations.sql')
ON CONFLICT (filename) DO NOTHING;


-- ── 3. updated_at trigger function ───────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ── 4. projects ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           TEXT        PRIMARY KEY,
  name         TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  start_date   DATE        NOT NULL,
  end_date     DATE        NOT NULL,
  lead         TEXT        NOT NULL DEFAULT 'Unassigned',
  progress     INTEGER     NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  business_unit TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('002_create_projects.sql')
ON CONFLICT (filename) DO NOTHING;


-- ── 5. tasks ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT        PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id  ON tasks(parent_id);

DO $$ BEGIN
  CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('003_create_tasks.sql')
ON CONFLICT (filename) DO NOTHING;


-- ── 6. task_dependencies ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_task_id       ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on_id ON task_dependencies(depends_on_id);

INSERT INTO schema_migrations (filename) VALUES ('004_create_task_dependencies.sql')
ON CONFLICT (filename) DO NOTHING;


-- ── 7. baselines ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS baselines (
  id           SERIAL      PRIMARY KEY,
  project_id   TEXT        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label        TEXT        NOT NULL,
  snapshot_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tasks_json   JSONB       NOT NULL DEFAULT '{}',
  project_json JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_baselines_project_id ON baselines(project_id);

INSERT INTO schema_migrations (filename) VALUES ('005_create_baselines.sql')
ON CONFLICT (filename) DO NOTHING;


-- ── 8. app_users ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_users (
  email       TEXT PRIMARY KEY,
  role        TEXT NOT NULL CHECK (role IN ('super_admin', 'editor', 'viewer')) DEFAULT 'viewer',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TRIGGER trg_app_users_updated_at
    BEFORE UPDATE ON app_users
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO app_users (email, role)
VALUES ('jonald.penpillo@brigada.com.ph', 'super_admin')
ON CONFLICT (email) DO UPDATE SET role = 'super_admin';

INSERT INTO schema_migrations (filename) VALUES ('006_create_app_users.sql')
ON CONFLICT (filename) DO NOTHING;

-- ── 9. employees ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  employee_id          INTEGER     PRIMARY KEY,
  first_name           TEXT        NOT NULL,
  last_name            TEXT        NOT NULL,
  middle_name          TEXT,
  nick_name            TEXT,
  company_email_add    TEXT,
  personal_email_add   TEXT,
  mobile_no            TEXT,
  department           TEXT,
  business_unit        TEXT,
  employment_status    TEXT,
  position             TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('007_create_employees.sql')
ON CONFLICT (filename) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('008_add_business_unit_to_projects.sql')
ON CONFLICT (filename) DO NOTHING;

-- ── Done ─────────────────────────────────────────────────────
SELECT 'Database setup complete ✅' AS result;
SELECT filename, applied_at FROM schema_migrations ORDER BY id;

