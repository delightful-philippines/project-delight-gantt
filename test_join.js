import { supabaseAdmin } from './server/db.js';

async function testJoin() {
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('*, employees:employees(first_name, last_name)')
    .limit(1);
  
  if (error) {
    console.error('Join error:', error);
  } else {
    console.log('Join result:', JSON.stringify(data, null, 2));
  }
}

testJoin();
