import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Environment variables (injected by Vite at build time via import.meta.env)
// Only VITE_ prefixed variables are safe here — they are PUBLIC and bundled
// into the browser JavaScript. Never add server-only keys with VITE_ prefix.
// ---------------------------------------------------------------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Supabase] Missing environment variables.\n' +
      'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// ---------------------------------------------------------------------------
// Public client — safe to use on the client-side (uses anon key)
// ---------------------------------------------------------------------------
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ⚠️  dbConfig and SUPABASE_SERVICE_ROLE_KEY are SERVER-ONLY.
// They live in server/db.js and are read via process.env (Node).
// They must NEVER be imported or referenced here.

export default supabase;
