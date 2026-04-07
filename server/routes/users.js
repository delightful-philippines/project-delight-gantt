import { Router } from 'express';
import { supabaseAdmin } from '../db.js';
import { requireUser, requireSuperAdmin } from '../middleware/auth.js';
import { sendInvitationEmail } from '../lib/email.js';

const router = Router();

// (Removed local requireUser and requireSuperAdmin definitions)

// ── GET /api/users/me ───────────────────────────────────────────
// Get current user's role, and if they don't exist, register them as 'viewer'
router.get('/me', requireUser, async (req, res) => {
  const email = (req.userEmail || '').toLowerCase().trim();
  const isHardcodedAdmin = email.includes('jonald.penpillo') || email.includes('jonaldpenpillo') || [
    'jonald.penpillo@brigada.com.ph',
    'jonald.penpillo@brigada.ph'
  ].includes(email);

  console.log('[DEBUG-AUTH] email:', `"${email}"`);
  console.log('[DEBUG-AUTH] isHardcodedAdmin:', isHardcodedAdmin);

  try {
    // 1. Fetch user by email
    let { data: user, error } = await supabaseAdmin
      .from('app_users')
      .select('*')
      .eq('email', email)
      .single();

    // 2. If user doesn't exist yet, insert them
    if (error && error.code === 'PGRST116') {
      const role = isHardcodedAdmin ? 'super_admin' : 'editor';
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('app_users')
        .insert({ email: email, role })
        .select('*')
        .single();
        
      if (insertError) return res.status(500).json({ error: insertError.message });
      user = newUser;
    } else if (!error && user) {
       // If user exists but is hardcoded admin and role is wrong, auto-fix it
       if (isHardcodedAdmin && user.role !== 'super_admin') {
          const { data: fixedUser } = await supabaseAdmin
            .from('app_users')
            .update({ role: 'super_admin' })
            .eq('email', email)
            .select('*')
            .single();
          if (fixedUser) user = fixedUser;
       }
    } else if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!user) {
      return res.status(404).json({ error: 'User record not found.' });
    }

    // 3. Fetch employee details separately
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('employee_id, first_name, last_name, company_email_add, personal_email_add, position, department, business_unit')
      .or(`company_email_add.eq."${email}",personal_email_add.eq."${email}"`)
      .maybeSingle();

    return res.json({
      ...user,
      first_name: employee?.first_name || null,
      last_name: employee?.last_name || null,
      employee_id: employee?.employee_id || null,
      company_email_add: employee?.company_email_add || null,
      personal_email_add: employee?.personal_email_add || null,
      position: employee?.position || null,
      department: employee?.department || null,
      business_unit: employee?.business_unit || null,
    });
  } catch (err) {
    console.error('[me] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/users ───────────────────────────────────────────────
// Get all users (Super Admin only), enriched with employee names if available
router.get('/', requireUser, requireSuperAdmin, async (_req, res) => {
  try {
    // 1. Fetch all app users
    const { data: users, error } = await supabaseAdmin
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    if (!users) return res.json([]);
    
    // 2. Fetch all employees to join in memory (more efficient than many small queries)
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('employee_id, first_name, last_name, company_email_add, personal_email_add, position, department, business_unit');

    const employeeMap = new Map();
    employees?.forEach(e => {
      const company = e.company_email_add?.toLowerCase().trim();
      const personal = e.personal_email_add?.toLowerCase().trim();
      if (company) employeeMap.set(company, e);
      if (personal) employeeMap.set(personal, e);
    });

    // 3. Map names to users
    const enrichedData = users.map(user => {
      const emp = employeeMap.get(user.email?.toLowerCase().trim());
      return {
        ...user,
        first_name: emp?.first_name || null,
        last_name: emp?.last_name || null,
        employee_id: emp?.employee_id || null,
        company_email_add: emp?.company_email_add || null,
        personal_email_add: emp?.personal_email_add || null,
        position: emp?.position || null,
        department: emp?.department || null,
        business_unit: emp?.business_unit || null,
      };
    });

    res.json(enrichedData);
  } catch (err) {
    console.error('[users-list] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/users ──────────────────────────────────────────────
// Insert or Update a user's role (Super Admin only)
router.post('/', requireUser, requireSuperAdmin, async (req, res) => {
  const { email, role, can_view_all_projects } = req.body;
  if (!email || !role) return res.status(400).json({ error: 'Email and role required.' });
  if (!['super_admin', 'editor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be super_admin, editor, or viewer.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Prevent modifying the main super admin account
  const isHardcoded = ['jonald.penpillo@brigada.com.ph', 'jonald.penpillo@brigada.ph'].includes(normalizedEmail);
  if (isHardcoded && role !== 'super_admin') {
     return res.status(400).json({ error: 'Cannot demote the primary super admin.' });
  }

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .upsert({ 
      email: normalizedEmail, 
      role,
      ...(can_view_all_projects !== undefined && { can_view_all_projects })
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── POST /api/users/invite ───────────────────────────────────────
// Invite a user by email (Super Admin only)
router.post('/invite', requireUser, requireSuperAdmin, async (req, res) => {
  const { email, role } = req.body;
  
  if (!email || !role) {
    return res.status(400).json({ error: 'Email and role are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // 1. Upsert the user into the database
    const { data: user, error: dbError } = await supabaseAdmin
      .from('app_users')
      .upsert({ email: normalizedEmail, role })
      .select()
      .single();

    if (dbError) throw dbError;

    // 2. Send the invitation email
    // We can use the inviter's email as their name if we don't have a display name
    const inviterName = req.userEmail; 
    
    await sendInvitationEmail(normalizedEmail, inviterName, role);

    res.json({ message: `Invitation sent to ${normalizedEmail}`, user });
  } catch (error) {
    console.error('[Invitation Error]:', error);
    res.status(500).json({ 
      error: 'Failed to complete invitation.',
      details: error.message 
    });
  }
});

// ── DELETE /api/users/:email ─────────────────────────────────────
// Delete a user (Super Admin only)
router.delete('/:email', requireUser, requireSuperAdmin, async (req, res) => {
  const targetEmail = req.params.email.toLowerCase().trim();

  const isHardcoded = ['jonald.penpillo@brigada.com.ph', 'jonald.penpillo@brigada.ph'].includes(targetEmail);
  if (isHardcoded) {
    return res.status(400).json({ error: 'Cannot delete the primary super admin account.' });
  }
  
  if (targetEmail === req.userEmail) {
    return res.status(400).json({ error: 'Cannot delete your own account.' });
  }

  const { error } = await supabaseAdmin
    .from('app_users')
    .delete()
    .eq('email', targetEmail);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

export default router;
