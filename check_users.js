import { supabaseAdmin } from './server/db.js';

async function check() {
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('email, role');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Users in DB:', JSON.stringify(data, null, 2));
  }
}

check();
