import { Router } from 'express';
import { supabaseAdmin } from '../db.js';
import { requireUser, identifyRole, requireProjectAccess } from '../middleware/auth.js';

const router = Router();

// Apply auth to all baseline routes
router.use(requireUser);
router.use(identifyRole);

// ── GET /api/baselines?project_id=xxx ────────────────────────
router.get('/', requireProjectAccess, async (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ error: 'project_id query param required.' });

  const { data, error } = await supabaseAdmin
    .from('baselines')
    .select('id, project_id, label, snapshot_at, tasks_json, project_json')
    .eq('project_id', project_id)
    .order('snapshot_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Shape to match the frontend Baseline interface
  const result = (data ?? []).map(b => ({
    id:         b.id,
    project_id: b.project_id,
    label:      b.label,
    timestamp:  b.snapshot_at,
    tasksById:  b.tasks_json,
    project:    b.project_json,
  }));

  res.json(result);
});

// ── POST /api/baselines ──────────────────────────────────────
router.post('/', requireProjectAccess, async (req, res) => {
  const { project_id, label, tasksById, project } = req.body;

  if (!project_id || !label) {
    return res.status(400).json({ error: 'project_id and label are required.' });
  }

  const { data, error } = await supabaseAdmin
    .from('baselines')
    .insert({
      project_id,
      label,
      tasks_json:   tasksById ?? {},
      project_json: project ?? {},
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({
    id:         data.id,
    project_id: data.project_id,
    label:      data.label,
    timestamp:  data.snapshot_at,
    tasksById:  data.tasks_json,
    project:    data.project_json,
  });
});

// ── DELETE /api/baselines/:id ────────────────────────────────
router.delete('/:id', async (req, res) => {
  // Verify access for baseline delete
  if (req.userRole !== 'super_admin') {
    const { data: baseline } = await supabaseAdmin
      .from('baselines')
      .select('project_id')
      .eq('id', req.params.id)
      .single();
    
    if (baseline) {
       const { data: project } = await supabaseAdmin
        .from('projects')
        .select('lead')
        .eq('id', baseline.project_id)
        .single();
        
      if (!project || project.lead !== req.userEmail) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }
  }

  const { error } = await supabaseAdmin
    .from('baselines')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

export default router;
