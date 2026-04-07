import { Router } from 'express';
import { supabaseAdmin } from '../db.js';
import { requireUser, identifyRole, requireProjectAccess, requireProjectOwnership } from '../middleware/auth.js';

const router = Router();

// ── GET /api/projects ────────────────────────────────────────
// Returns projects:
// - Super Admins see all projects
// - Regular users see projects that match their own business unit OR projects they lead
router.get('/', requireUser, identifyRole, async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('projects')
      .select('*');

    // All authenticated users see all projects

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── GET /api/projects/:id ────────────────────────────────────
router.get('/:id', requireUser, identifyRole, requireProjectAccess, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

// ── POST /api/projects ───────────────────────────────────────
router.post('/', requireUser, identifyRole, async (req, res) => {
  const { id, name, description, start_date, end_date, lead, progress } = req.body;

  if (!id || !name || !start_date) {
    return res.status(400).json({ error: 'id, name, and start_date are required.' });
  }

  // Only Super Admins can assign someone else as lead during creation
  // Editors/Viewers are automatically the lead of projects they create
  const assignedLead = (req.userRole === 'super_admin') ? (lead ?? req.userEmail) : req.userEmail;

  try {
    // 1. Get creator's business unit from the employee's masterlist
    let businessUnit = null;
    const { data: employeeData, error: empError } = await supabaseAdmin
      .from('employees')
      .select('business_unit')
      .eq('company_email_add', assignedLead) // Link to the final assignee's business unit
      .single();

    if (!empError && employeeData) {
      businessUnit = employeeData.business_unit;
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .insert({
        id,
        name:        name.trim(),
        description: description ?? '',
        start_date,
        end_date:    end_date ?? start_date,
        lead:        assignedLead,
        progress:    progress ?? 0,
        business_unit: businessUnit  // Automatically assign their business unit
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/projects/:id ────────────────────────────────────
router.put('/:id', requireUser, identifyRole, requireProjectAccess, async (req, res) => {
  const { name, description, start_date, end_date, lead, progress } = req.body;

  // Only super admin can change the lead
  const nextLead = (req.userRole === 'super_admin') ? lead : undefined;

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update({
      ...(name        !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description }),
      ...(start_date  !== undefined && { start_date }),
      ...(end_date    !== undefined && { end_date }),
      ...(nextLead    !== undefined && { lead: nextLead }),
      ...(progress    !== undefined && { progress }),
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── DELETE /api/projects/:id ─────────────────────────────────
// Cascades to tasks, dependencies, baselines via FK.
router.delete('/:id', requireUser, identifyRole, requireProjectOwnership, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('projects')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

export default router;
