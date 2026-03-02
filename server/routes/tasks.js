import { Router } from 'express';
import { supabaseAdmin } from '../db.js';
import { requireUser, identifyRole, requireProjectAccess, requireTaskAccess } from '../middleware/auth.js';

const router = Router();

// Apply auth to all task routes
router.use(requireUser);
router.use(identifyRole);

// ── GET /api/tasks?project_id=xxx ───────────────────────────
// Returns tasks + their dependency IDs for a given project.
router.get('/', requireProjectAccess, async (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ error: 'project_id query param required.' });

  // Fetch tasks
  const { data: tasks, error: tErr } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('project_id', project_id)
    .order('sort_order', { ascending: true });

  if (tErr) return res.status(500).json({ error: tErr.message });

  // Fetch dependencies for all tasks in the project
  const taskIds = (tasks ?? []).map(t => t.id);
  let depsMap = {};

  if (taskIds.length) {
    const { data: deps, error: dErr } = await supabaseAdmin
      .from('task_dependencies')
      .select('task_id, depends_on_id')
      .in('task_id', taskIds);

    if (dErr) return res.status(500).json({ error: dErr.message });

    // Build map: taskId → [depends_on_ids]
    (deps ?? []).forEach(({ task_id, depends_on_id }) => {
      if (!depsMap[task_id]) depsMap[task_id] = [];
      depsMap[task_id].push(depends_on_id);
    });
  }

  // Attach dependencies[] array to each task (matches frontend Task type)
  const result = (tasks ?? []).map(t => ({
    ...t,
    dependencies: depsMap[t.id] ?? [],
  }));

  res.json(result);
});

// ── GET /api/tasks/:id ───────────────────────────────────────
router.get('/:id', requireTaskAccess, async (req, res) => {
  const { data: task, error } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: error.message });

  const { data: deps } = await supabaseAdmin
    .from('task_dependencies')
    .select('depends_on_id')
    .eq('task_id', task.id);

  res.json({ ...task, dependencies: (deps ?? []).map(d => d.depends_on_id) });
});

// ── POST /api/tasks ──────────────────────────────────────────
router.post('/', requireProjectAccess, async (req, res) => {
  const {
    id, project_id, parent_id, title,
    start_date, end_date, duration,
    bg_color, text_color, is_summary, is_milestone,
    level, sort_order, progress, assignee,
    dependencies = [],
  } = req.body;

  if (!id || !project_id || !title || !start_date || !end_date) {
    return res.status(400).json({ error: 'id, project_id, title, start_date, end_date are required.' });
  }

  // Insert task
  const { data: task, error: tErr } = await supabaseAdmin
    .from('tasks')
    .insert({
      id, project_id,
      parent_id:    parent_id ?? null,
      title:        title.trim(),
      start_date, end_date,
      duration:     duration ?? 0,
      bg_color:     bg_color ?? '#0f8b8d',
      text_color:   text_color ?? '#ffffff',
      is_summary:   is_summary ?? false,
      is_milestone: is_milestone ?? false,
      is_critical:  false,
      level:        level ?? 0,
      sort_order:   sort_order ?? 0,
      progress:     progress ?? 0,
      assignee:     assignee ?? 'Unassigned',
    })
    .select()
    .single();

  if (tErr) return res.status(500).json({ error: tErr.message });

  // Insert dependencies
  if (dependencies.length) {
    const depRows = dependencies.map(depId => ({
      task_id:       id,
      depends_on_id: depId,
    }));

    const { error: dErr } = await supabaseAdmin
      .from('task_dependencies')
      .insert(depRows);

    if (dErr) return res.status(500).json({ error: dErr.message });
  }

  res.status(201).json({ ...task, dependencies });
});

// ── PUT /api/tasks/:id ───────────────────────────────────────
router.put('/:id', requireTaskAccess, async (req, res) => {
  const {
    title, start_date, end_date, duration,
    bg_color, text_color, is_summary, is_milestone, is_critical,
    level, sort_order, progress, assignee, parent_id,
    dependencies,
  } = req.body;

  const { data: task, error: tErr } = await supabaseAdmin
    .from('tasks')
    .update({
      ...(title        !== undefined && { title: title.trim() }),
      ...(start_date   !== undefined && { start_date }),
      ...(end_date     !== undefined && { end_date }),
      ...(duration     !== undefined && { duration }),
      ...(bg_color     !== undefined && { bg_color }),
      ...(text_color   !== undefined && { text_color }),
      ...(is_summary   !== undefined && { is_summary }),
      ...(is_milestone !== undefined && { is_milestone }),
      ...(is_critical  !== undefined && { is_critical }),
      ...(level        !== undefined && { level }),
      ...(sort_order   !== undefined && { sort_order }),
      ...(progress     !== undefined && { progress }),
      ...(assignee     !== undefined && { assignee }),
      ...(parent_id    !== undefined && { parent_id }),
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (tErr) return res.status(500).json({ error: tErr.message });

  // Replace dependencies if provided
  if (Array.isArray(dependencies)) {
    // Delete old
    await supabaseAdmin
      .from('task_dependencies')
      .delete()
      .eq('task_id', req.params.id);

    // Insert new
    if (dependencies.length) {
      const depRows = dependencies.map(depId => ({
        task_id:       req.params.id,
        depends_on_id: depId,
      }));
      const { error: dErr } = await supabaseAdmin
        .from('task_dependencies')
        .insert(depRows);
      if (dErr) return res.status(500).json({ error: dErr.message });
    }
  }

  // Fetch current deps to return
  const { data: deps } = await supabaseAdmin
    .from('task_dependencies')
    .select('depends_on_id')
    .eq('task_id', req.params.id);

  res.json({ ...task, dependencies: (deps ?? []).map(d => d.depends_on_id) });
});

// ── DELETE /api/tasks/:id ────────────────────────────────────
router.delete('/:id', requireTaskAccess, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ── POST /api/tasks/bulk ─────────────────────────────────────
router.post('/bulk', requireProjectAccess, async (req, res) => {
  const { project_id, tasks } = req.body;

  if (!project_id || !Array.isArray(tasks)) {
    return res.status(400).json({ error: 'project_id and tasks[] are required.' });
  }

  // Upsert all tasks provided in the request
  const rows = tasks.map(t => ({
    id:           t.id,
    project_id:   t.project_id,
    parent_id:    t.parent_id ?? null,
    title:        t.title,
    start_date:   t.start_date,
    end_date:     t.end_date,
    duration:     t.duration ?? 0,
    bg_color:     t.bg_color ?? '#0f8b8d',
    text_color:   t.text_color ?? '#ffffff',
    is_summary:   t.is_summary ?? false,
    is_milestone: t.is_milestone ?? false,
    is_critical:  t.is_critical ?? false,
    level:        t.level ?? 0,
    sort_order:   t.sort_order ?? 0,
    progress:     t.progress ?? 0,
    assignee:     t.assignee ?? 'Unassigned',
  }));

  // Perform upsert
  const { error: tErr } = await supabaseAdmin
    .from('tasks')
    .upsert(rows, { onConflict: 'id' });

  if (tErr) return res.status(500).json({ error: tErr.message });

  // ── DELETE TASKS NOT IN PAYLOAD ──
  // Any task in the DB for this project that isn't in the provided list is now deleted.
  try {
    const currentIds = new Set(tasks.map(t => t.id));
    
    // Fetch existing task IDs for the project
    const { data: dbTasks, error: fetchErr } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('project_id', project_id);
      
    if (!fetchErr && dbTasks) {
      const idsToDelete = dbTasks.map(t => t.id).filter(id => !currentIds.has(id));
      
      if (idsToDelete.length > 0) {
        const { error: delErr } = await supabaseAdmin
          .from('tasks')
          .delete()
          .in('id', idsToDelete);
          
        if (delErr) {
          console.error('[bulk] Sync deletion error:', delErr.message);
        } else {
          console.log(`[bulk] Successfully synced project ${project_id}. Deleted ${idsToDelete.length} obsolete tasks.`);
        }
      }
    }
  } catch (err) {
    console.error('[bulk] Error cleaning up tasks:', err);
  }

  // Replace all dependencies for the project
  const taskIds = tasks.map(t => t.id);

  // Delete old deps for these tasks
  if (taskIds.length) {
    await supabaseAdmin
      .from('task_dependencies')
      .delete()
      .in('task_id', taskIds);
  }

  // Insert fresh deps
  const depRows = tasks.flatMap(t =>
    (t.dependencies ?? []).map(depId => ({
      task_id:       t.id,
      depends_on_id: depId,
    }))
  );

  if (depRows.length) {
    const { error: dErr } = await supabaseAdmin
      .from('task_dependencies')
      .insert(depRows);
    if (dErr) return res.status(500).json({ error: dErr.message });
  }

  res.json({ synced: rows.length });
});

export default router;
