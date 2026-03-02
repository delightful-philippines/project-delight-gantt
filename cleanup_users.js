import { supabaseAdmin } from './server/db.js';

async function cleanup() {
  const { data: users, error } = await supabaseAdmin.from('app_users').select('*');
  if (error) return console.error(error);

  for (const user of users) {
    const clean = user.email.replace(/\s/g, '');
    if (clean !== user.email) {
      console.log(`Found corrupted email: "${user.email}" -> cleaning to "${clean}"`);
      // Delete corrupted
      await supabaseAdmin.from('app_users').delete().eq('email', user.email);
      // Upsert clean
      await supabaseAdmin.from('app_users').upsert({ ...user, email: clean });
    }
  }
  console.log('Cleanup done.');
}

cleanup();
