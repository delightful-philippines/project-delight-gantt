/**
 * server/clean.js
 * ─────────────────────────────────────────────────────────────
 * Utility script to wipe all project data from the database.
 * Leaves the schema and migration history intact.
 * ─────────────────────────────────────────────────────────────
 */
import { supabaseAdmin } from './db.js';

async function cleanData() {
  console.log('\n🧹 Cleaning all data from Supabase…');

  // Because of the ON DELETE CASCADE rules on the tasks, task_dependencies, 
  // and baselines tables, wiping all projects automatically wipes everything else.
  // We use .neq('id', 'dummy') to match all rows in Supabase REST API.
  const { error } = await supabaseAdmin
    .from('projects')
    .delete()
    .neq('id', 'dummy_id_to_match_all');

  if (error) {
    console.error('❌ Failed to clean data:', error.message);
    process.exit(1);
  }

  console.log('✅ All project, task, and baseline data has been wiped.');
  console.log('✨ The database is now completely clean (schema left intact).\n');
}

cleanData();
