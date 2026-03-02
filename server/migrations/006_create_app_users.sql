CREATE TABLE IF NOT EXISTS app_users (
  email       TEXT PRIMARY KEY,
  role        TEXT NOT NULL CHECK (role IN ('super_admin', 'editor', 'viewer')) DEFAULT 'viewer',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure our main super admin always exists
INSERT INTO app_users (email, role)
VALUES ('jonald.penpillo@brigada.com.ph', 'super_admin')
ON CONFLICT (email) DO UPDATE SET role = 'super_admin';
