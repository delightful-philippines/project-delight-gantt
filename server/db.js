/**
 * server/db.js
 * ─────────────────────────────────────────────────────────────
 * Admin Supabase client (service_role key).
 * NEVER import this file from the frontend — it bypasses RLS.
 * ─────────────────────────────────────────────────────────────
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('[db] ❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default supabaseAdmin;
