import { supabaseAdmin } from './server/db.js';

async function check() {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('company_email_add, first_name, last_name')
    .ilike('first_name', '%jonald%');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Matching Employees:', JSON.stringify(data, null, 2));
  }
}

check();
