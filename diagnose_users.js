import { supabaseAdmin } from './server/db.js';

async function diagnose() {
  const { data: users } = await supabaseAdmin.from('app_users').select('*');
  for (const user of users) {
    console.log('Email:', user.email);
    console.log('Characters:', [...user.email].map(c => c.charCodeAt(0)));
  }
}
diagnose();
