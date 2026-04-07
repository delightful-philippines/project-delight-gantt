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
      .select('employee_id, first_name, last_name, company_email_add, personal_email_add, position, department, business_unit')
      .or(`company_email_add.eq."${req.userEmail}",personal_email_add.eq."${req.userEmail}"`)
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
      .select('employee_id, first_name, last_name, company_email_add, personal_email_add, position, department, business_unit');

    if (req.query.employee_id) {
      // Direct lookup by numeric employee_id
      query = query.eq('employee_id', parseInt(req.query.employee_id, 10)).limit(1);
    } else if (req.query.search) {
      const searchTerm = req.query.search.trim();
      const searchParts = searchTerm.split(/\s+/).filter(Boolean);

      if (searchParts.length > 0) {
          searchParts.forEach(part => {
             const likePart = `%${part}%`;
             query = query.or(`first_name.ilike.${likePart},last_name.ilike.${likePart},company_email_add.ilike.${likePart},personal_email_add.ilike.${likePart},nick_name.ilike.${likePart}`);
          });
          query = query.limit(100);
      }
    } else {
      query = query.limit(200);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
