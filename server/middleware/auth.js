import { supabaseAdmin } from '../db.js';

/**
 * Extract X-User-Email header and attach to request.
 */
export const requireUser = (req, res, next) => {
  // 1. Check for session (Option B — Secure)
  if (req.session && req.session.user) {
    console.log('[DEBUG-SESSION] User:', JSON.stringify(req.session.user));
    req.userEmail = req.session.user.email;
    return next();
  }

  // 2. Temporary fallback for transiton (ONLY for development)
  const headerEmail = req.headers['x-user-email'];
  if (headerEmail && process.env.NODE_ENV !== 'production') {
    req.userEmail = headerEmail.toLowerCase().trim();
    return next();
  }

  return res.status(401).json({ error: 'Session expired or missing. Please log in again.' });
};

/**
 * Fetch user record and verify super_admin role.
 */
export const requireSuperAdmin = async (req, res, next) => {
  if (!req.userEmail) return res.status(401).json({ error: 'Authentication required.' });

  const email = req.userEmail.toLowerCase().trim();
  const isHardcodedAdmin = email.includes('jonald.penpillo') || email.includes('jonaldpenpillo') || [
    'jonald.penpillo@brigada.com.ph',
    'jonald.penpillo@brigada.ph'
  ].includes(email);

  const { data: user, error } = await supabaseAdmin
    .from('app_users')
    .select('role')
    .eq('email', email)
    .single();

  const currentRole = (error || !user) ? 'editor' : user.role;

  if (isHardcodedAdmin || currentRole === 'super_admin') {
    req.userRole = 'super_admin';
    
    // Auto-fix DB if hardcoded but role is wrong
    if (isHardcodedAdmin && currentRole !== 'super_admin') {
      supabaseAdmin.from('app_users').upsert({ email, role: 'super_admin' }).then();
    }
    
    return next();
  }

  return res.status(403).json({ error: 'Access denied. Super Admin role required.' });
};

/**
 * Fetch user record and attach role to req.
 * Auto-promotes hardcoded admins if record is missing or role is wrong.
 */
export const identifyRole = async (req, res, next) => {
  if (!req.userEmail) return res.status(401).json({ error: 'Authentication required.' });

  const email = req.userEmail.toLowerCase().trim();
  const isHardcodedAdmin = email.includes('jonald.penpillo') || email.includes('jonaldpenpillo') || [
    'jonald.penpillo@brigada.com.ph',
    'jonald.penpillo@brigada.ph'
  ].includes(email);

  const { data: user, error } = await supabaseAdmin
    .from('app_users')
    .select('role')
    .eq('email', email)
    .single();

  if (error || !user) {
    // Record missing -> If hardcoded admin, use super_admin, else editor
    req.userRole = isHardcodedAdmin ? 'super_admin' : 'editor';
  } else {
    // Record exists -> If hardcoded admin but role is wrong, use super_admin
    if (isHardcodedAdmin && user.role !== 'super_admin') {
      req.userRole = 'super_admin';
      // Optionally async update the DB here too
      supabaseAdmin.from('app_users').update({ role: 'super_admin' }).eq('email', email).then();
    } else {
      req.userRole = user.role;
    }
  }

  console.log(`[DEBUG-ROLE] ${email} identified as ${req.userRole}`);
  next();
};

/**
 * Verify user has access to a specific project.
 * Handles both URL params (:id, :projectId) and query params (?project_id).
 */
export const requireProjectAccess = async (req, res, next) => {
  const projectId = req.params.id || req.params.projectId || req.query.project_id || req.body.project_id;
  
  if (!projectId) {
    return res.status(400).json({ error: 'project_id is required for this operation.' });
  }

  // Super Admins bypass check
  if (req.userRole === 'super_admin') return next();

  const { data: project, error } = await supabaseAdmin
    .from('projects')
    .select('lead, business_unit')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  // If they are explicitly the lead, grant access immediately
  if (project.lead === req.userEmail) {
    return next();
  }

  // Otherwise, check if their business unit matches the project's business unit
  if (project.business_unit) {
    const { data: employeeData, error: empError } = await supabaseAdmin
      .from('employees')
      .select('business_unit')
      .eq('company_email_add', req.userEmail)
      .single();
      
    if (!empError && employeeData && employeeData.business_unit === project.business_unit) {
      return next();
    }
  }

  return res.status(403).json({ error: 'Access denied. You do not belong to the same business unit as this project, nor are you the leader.' });
};

/**
 * Verify user has access to a specific task (by checking its project).
 */
export const requireTaskAccess = async (req, res, next) => {
  const taskId = req.params.id;
  if (!taskId) return res.status(400).json({ error: 'Task ID required.' });

  // Super Admins bypass check
  if (req.userRole === 'super_admin') return next();

  const { data: task, error } = await supabaseAdmin
    .from('tasks')
    .select('project_id')
    .eq('id', taskId)
    .single();

  if (error || !task) return res.status(404).json({ error: 'Task not found.' });

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('lead')
    .eq('id', task.project_id)
    .single();

  if (!project || project.lead !== req.userEmail) {
    return res.status(403).json({ error: 'Access denied. You do not lead the project this task belongs to.' });
  }

  next();
};

/**
 * STRICT ownership check. Only the lead (creator) or Super Admin 
 * can perform the action.
 */
export const requireProjectOwnership = async (req, res, next) => {
  const projectId = req.params.id || req.params.projectId || req.query.project_id || req.body.project_id;
  
  if (!projectId) return res.status(400).json({ error: 'project_id is required.' });

  // Super Admins bypass check
  if (req.userRole === 'super_admin') return next();

  const { data: project, error } = await supabaseAdmin
    .from('projects')
    .select('lead')
    .eq('id', projectId)
    .single();

  if (error || !project) return res.status(404).json({ error: 'Project not found.' });

  if (project.lead !== req.userEmail) {
    return res.status(403).json({ error: 'Access denied. Only the project creator (Lead) can perform this action.' });
  }

  next();
};
