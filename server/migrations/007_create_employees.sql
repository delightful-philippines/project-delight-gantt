-- Migration 007: employees table
-- Masterlist table for employee data

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

-- Automatically keep updated_at fresh
DO $$ BEGIN
  CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
