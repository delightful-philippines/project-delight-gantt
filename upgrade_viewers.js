import { supabaseAdmin } from './server/db.js';

async function upgrade() {
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .update({ role: 'editor' })
    .eq('role', 'viewer')
    .select();
  
  if (error) {
    console.error('Error upgrading users:', error);
  } else {
    console.log('Upgraded users:', JSON.stringify(data, null, 2));
  }
}

upgrade();
