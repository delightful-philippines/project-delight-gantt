import { Router } from 'express';
import { supabaseAdmin } from '../db.js';
import { requireUser, identifyRole } from '../middleware/auth.js';

const router = Router();

// ── GET /api/employees/me ─────────────────────────────────────
// Returns the employee record for the currently logged-in user
// matched via company_email_add = X-User-Email header.
router.get('/me', requireUser, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('employee_id, first_name, last_name, company_email_add, position, department, business_unit')
      .eq('company_email_add', req.userEmail)
      .single();

    if (error && error.code === 'PGRST116') {
      // Not found in employee table → return null gracefully
      return res.json(null);
    }
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/employees ────────────────────────────────────────
// Returns employees, optionally filtered by search text.
router.get('/', requireUser, identifyRole, async (req, res) => {
  try {
    // Only super_admin or admin can invite, actually any logged in user could search for assignment.
    // Let's just allow authenticated users.
    
    let query = supabaseAdmin
      .from('employees')
      .select('employee_id, first_name, last_name, company_email_add, position, department');

    if (req.query.search) {
      // search by name or email
      const searchTerm = req.query.search;
      query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,company_email_add.ilike.%${searchTerm}%,nick_name.ilike.%${searchTerm}%`).limit(1000);
    } else {
      query = query.limit(10000);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
