import 'dotenv/config';
import { supabaseAdmin } from './db.js';

const API_URL = process.env.BBSI_API_URL;
const HEADERS = {
  'AccessToken': process.env.BBSI_API_TOKEN,
  'secretKey': process.env.BBSI_API_SECRET_KEY
};

async function syncEmployees() {
  console.log('Fetching employees from BBSI API...');
  
  try {
    const response = await fetch(API_URL, { headers: HEADERS });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const employees = await response.json();
    console.log(`Fetched ${employees.length} employees from API.`);
    
    if (!Array.isArray(employees)) {
      throw new Error("Expected an array of employees from the API.");
    }
    
    // Map API data to our DB schema
    const formattedEmployees = employees
      .filter(emp => emp.employeeID && emp.firstName && emp.lastName) // Ensure we have basic identifying info
      .map(emp => ({
        employee_id: emp.employeeID,
        first_name: emp.firstName.trim(),
        last_name: emp.lastName.trim(),
        middle_name: emp.middleName?.trim() || null,
        nick_name: emp.nickName?.trim() || null,
        company_email_add: emp.companyEmailAdd?.toLowerCase().trim() || null,
        personal_email_add: emp.personalEmailAdd?.toLowerCase().trim() || null,
        mobile_no: emp.mobileNo?.trim() || null,
        department: emp.department?.trim() || null,
        business_unit: emp.businessUnit?.trim() || null,
        employment_status: emp.employmentStatus?.trim() || null,
        position: emp.position?.trim() || null
      }));

    const skipped = employees.length - formattedEmployees.length;
    if (skipped > 0) {
      console.warn(`⚠️  Skipped ${skipped} employees due to missing required fields (ID, First Name, or Last Name).`);
    }

    console.log(`Processing ${formattedEmployees.length} valid employees...`);
    console.log('Upserting into database in batches...');
    
    // Supabase has a limit on exactly how many rows you can upsert at once. 1000 is safe.
    const batchSize = 500;
    let totalUpserted = 0;
    for (let i = 0; i < formattedEmployees.length; i += batchSize) {
      const batch = formattedEmployees.slice(i, i + batchSize);
      
      const { error } = await supabaseAdmin
        .from('employees')
        .upsert(batch, { onConflict: 'employee_id' });
        
      if (error) {
        console.error(`❌ Error upserting batch starting at index ${i}:`, error.message);
        // Continue to next batch instead of failing entirely
        continue;
      }
      totalUpserted += batch.length;
      console.log(`Successfully processed batch ${Math.floor(i / batchSize) + 1} (${totalUpserted}/${formattedEmployees.length})`);
    }

    console.log(`✅ Employee sync complete. Total upserted: ${totalUpserted}`);
  } catch (err) {
    console.error('❌ Failed to sync employees:', err);
  }
}

syncEmployees();
