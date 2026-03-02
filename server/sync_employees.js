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
    console.log(`Fetched ${employees.length} employees.`);
    
    if (!Array.isArray(employees)) {
      throw new Error("Expected an array of employees from the API API.");
    }
    
    // Map API data to our DB schema
    const formattedEmployees = employees.map(emp => ({
      employee_id: emp.employeeID,
      first_name: emp.firstName,
      last_name: emp.lastName,
      middle_name: emp.middleName,
      nick_name: emp.nickName,
      company_email_add: emp.companyEmailAdd,
      personal_email_add: emp.personalEmailAdd,
      mobile_no: emp.mobileNo,
      department: emp.department,
      business_unit: emp.businessUnit,
      employment_status: emp.employmentStatus,
      position: emp.position
    }));

    console.log('Upserting into database in batches...');
    
    // Supabase has a limit on exactly how many rows you can upsert at once. 1000 is safe.
    const batchSize = 1000;
    for (let i = 0; i < formattedEmployees.length; i += batchSize) {
      const batch = formattedEmployees.slice(i, i + batchSize);
      
      const { data, error } = await supabaseAdmin
        .from('employees')
        .upsert(batch, { onConflict: 'employee_id' });
        
      if (error) {
        throw new Error(`Error upserting batch: ${error.message}`);
      }
      console.log(`Successfully upserted batch ${i / batchSize + 1}`);
    }

    console.log('✅ Employee sync complete.');
  } catch (err) {
    console.error('❌ Failed to sync employees:', err);
  }
}

syncEmployees();
