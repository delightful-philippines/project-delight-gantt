import { supabaseAdmin } from './server/db.js';

async function check() {
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('email, role')
    .ilike('email', '%jonald%');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Matching Users:', JSON.stringify(data, null, 2));
  }
}

check();
