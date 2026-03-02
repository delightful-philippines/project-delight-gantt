/**
 * server/migrate.js
 * ─────────────────────────────────────────────────────────────
 * Auto-migration runner.
 * - Reads all *.sql files from server/migrations/ in filename order
 * - Skips any that have already been recorded in schema_migrations
 * - Runs pending ones sequentially via Supabase's rpc/sql endpoint
 * ─────────────────────────────────────────────────────────────
 */
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

/**
 * Execute a raw SQL string against Supabase using the pg REST endpoint.
 * We use supabaseAdmin.rpc('exec_sql', ...) — but Supabase doesn't expose
 * that by default, so we call the PostgREST /rpc path with a helper function,
 * OR we use the raw REST endpoint via fetch + service key.
 */
async function runSQL(sql) {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  
  // First try: use exec_sql RPC (must be created once — see below)
  // If the function doesn't exist yet we fall back to the pg endpoint.
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey':       process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    // If exec_sql doesn't exist yet, create it first then retry
    if (res.status === 404 || res.status === 400) {
      await bootstrapExecSql();
      const retry = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey':        process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ query: sql }),
      });
      if (!retry.ok) {
        const text = await retry.text();
        throw new Error(`SQL error (${retry.status}): ${text}`);
      }
      return;
    }
    const text = await res.text();
    throw new Error(`SQL error (${res.status}): ${text}`);
  }
}

/**
 * Creates the exec_sql helper function in Supabase using the management API.
 * This is a one-time bootstrap step.
 */
async function bootstrapExecSql() {
  console.log('[migrate] 🔧  Bootstrapping exec_sql helper function…');
  
  const createFn = `
    CREATE OR REPLACE FUNCTION exec_sql(query TEXT)
    RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
      EXECUTE query;
    END;
    $$;
    GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;
  `;

  // Use the DB connection URL approach via Supabase's SQL editor API
  const projectRef = process.env.VITE_SUPABASE_URL
    .replace('https://', '')
    .split('.')[0];

  const mgmtRes = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: createFn }),
    }
  );

  if (!mgmtRes.ok) {
    // If management API fails (no personal access token), log warning and skip
    console.warn('[migrate] ⚠️  Could not auto-create exec_sql. Apply migrations manually.');
    console.warn('[migrate]    See: server/migrations/*.sql');
    throw new Error('exec_sql bootstrap failed — see warning above');
  }
  console.log('[migrate] ✅  exec_sql helper created');
}

/**
 * Main migration runner — called on server start.
 */
export async function runMigrations() {
  console.log('\n[migrate] 🔍  Checking for pending migrations…');

  // 1. Read migration files
  let files;
  try {
    const allFiles = await readdir(MIGRATIONS_DIR);
    files = allFiles.filter(f => f.endsWith('.sql')).sort();
  } catch {
    console.warn('[migrate] ⚠️  No migrations directory found, skipping.');
    return;
  }

  if (!files.length) {
    console.log('[migrate] ✅  No migration files found.');
    return;
  }

  // 2. Always run the bootstrap migration (001) directly first
  const bootstrapFile = files.find(f => f.startsWith('001_'));
  if (bootstrapFile) {
    const bootstrapSQL = await readFile(join(MIGRATIONS_DIR, bootstrapFile), 'utf8');
    try {
      await runSQL(bootstrapSQL);
    } catch (err) {
      console.warn(`[migrate] ⚠️  Could not run bootstrap migration: ${err.message}`);
      console.warn('[migrate]    Migrations may need to be applied manually via the Supabase SQL editor.');
      console.log('[migrate]    SQL files are in: server/migrations/\n');
      return;
    }
  }

  // 3. Fetch already-applied migrations
  const { data: applied, error } = await supabaseAdmin
    .from('schema_migrations')
    .select('filename');

  if (error) {
    console.error('[migrate] ❌  Could not read schema_migrations:', error.message);
    return;
  }

  const appliedSet = new Set((applied ?? []).map(r => r.filename));

  // 4. Run pending migrations
  const pending = files.filter(f => !appliedSet.has(f));

  if (!pending.length) {
    console.log('[migrate] ✅  All migrations are up to date.\n');
    return;
  }

  console.log(`[migrate] 📦  Running ${pending.length} pending migration(s)…`);

  for (const filename of pending) {
    const filepath = join(MIGRATIONS_DIR, filename);
    const sql = await readFile(filepath, 'utf8');

    process.stdout.write(`[migrate]   → ${filename} … `);
    try {
      await runSQL(sql);

      // Record as applied
      await supabaseAdmin
        .from('schema_migrations')
        .insert({ filename });

      console.log('✅');
    } catch (err) {
      console.log('❌');
      console.error(`[migrate]   Error in ${filename}:`, err.message);
      console.error('[migrate]   ⛔  Stopping — fix the error and restart the server.');
      process.exit(1);
    }
  }

  console.log('[migrate] 🎉  All migrations applied successfully.\n');
}
