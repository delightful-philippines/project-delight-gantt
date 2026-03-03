import { create, StoreApi } from "zustand";
import {
  Baseline,
  GanttStore,
  Project,
  ProjectDraft,
  ProjectSheet,
  Task,
  TaskDraft,
  ZoomLevel,
} from "../types";
import { addDays, durationFromDates, endFromStartDuration, maxDate, minDate } from "../utils/date";
import { id } from "../utils/ids";
import { api } from "../lib/api";
import type { DBTask } from "../lib/api";

// ── Constants ─────────────────────────────────────────────────
const ROOT_KEY = "root";

// ─────────────────────────────────────────────────────────────
// Pure helpers (tree / recalc)
// ─────────────────────────────────────────────────────────────

function sortChildren(
  tasksById: Record<string, Task>,
  childrenByParentId: Record<string, string[]>
): void {
  Object.keys(childrenByParentId).forEach((k) => {
    childrenByParentId[k].sort((a, b) => tasksById[a].sort_order - tasksById[b].sort_order);
  });
}

function rebuildChildrenIndex(tasksById: Record<string, Task>): Record<string, string[]> {
  const map: Record<string, string[]> = { [ROOT_KEY]: [] };
  Object.values(tasksById).forEach((task) => {
    const key = task.parent_id ?? ROOT_KEY;
    if (!map[key]) map[key] = [];
    map[key].push(task.id);
  });
  sortChildren(tasksById, map);
  return map;
}

function flattenOrder(sheet: ProjectSheet): string[] {
  const out: string[] = [];
  const walk = (parentId: string | null, level: number): void => {
    const ids = sheet.childrenByParentId[parentId ?? ROOT_KEY] ?? [];
    ids.forEach((taskId) => {
      sheet.tasksById[taskId].level = level;
      out.push(taskId);
      walk(taskId, level + 1);
    });
  };
  walk(null, 0);
  return out;
}

function applyRollups(sheet: ProjectSheet): void {
  const order = [...sheet.flatOrder].reverse();
  const childSet = new Set<string>();
  Object.values(sheet.tasksById).forEach((task) => {
    if (task.parent_id) childSet.add(task.parent_id);
  });

  order.forEach((taskId) => {
    const task = sheet.tasksById[taskId];
    const childIds = sheet.childrenByParentId[taskId] ?? [];
    if (!childIds.length) {
      if (task.is_milestone) {
        task.end_date = task.start_date;
        task.duration = 0;
      } else {
        task.duration = durationFromDates(task.start_date, task.end_date);
      }
      return;
    }
    const children = childIds.map((idVal) => sheet.tasksById[idVal]);
    task.is_summary = true;
    task.start_date = minDate(...children.map((c) => c.start_date));
    task.end_date = maxDate(...children.map((c) => c.end_date));
    task.duration = durationFromDates(task.start_date, task.end_date);
    task.progress =
      childIds.length > 0
        ? Math.round(children.reduce((acc, c) => acc + c.progress, 0) / childIds.length)
        : 0;
    if (!task.bg_color) task.bg_color = "#2d5a72";
  });

  const leafEnds = Object.values(sheet.tasksById)
    .filter((task) => !childSet.has(task.id))
    .map((task) => task.end_date);
  sheet.project.end_date = leafEnds.length ? maxDate(...leafEnds) : sheet.project.start_date;

  const allTasks = Object.values(sheet.tasksById);
  sheet.project.progress =
    allTasks.length > 0
      ? Math.round(allTasks.reduce((acc, t) => acc + t.progress, 0) / allTasks.length)
      : 0;
}

function applyDependencies(sheet: ProjectSheet): void {
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 50;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;
    Object.values(sheet.tasksById).forEach((task) => {
      if (!task.dependencies?.length) return;
      const preds = task.dependencies.map((depId) => sheet.tasksById[depId]).filter(Boolean);
      if (!preds.length) return;
      const minStart = addDays(maxDate(...preds.map((p) => p.end_date)), 1);
      if (task.start_date < minStart) {
        const duration = task.is_milestone ? 0 : durationFromDates(task.start_date, task.end_date);
        task.end_date = task.is_milestone ? minStart : endFromStartDuration(minStart, duration);
        changed = true;
      }
    });
  }
}

function applyCriticalPath(sheet: ProjectSheet): void {
  const tasks = Object.values(sheet.tasksById);
  if (!tasks.length) return;
  tasks.forEach((t) => (t.is_critical = false));
  const successors: Record<string, string[]> = {};
  tasks.forEach((t) => {
    (t.dependencies || []).forEach((depId) => {
      if (!successors[depId]) successors[depId] = [];
      successors[depId].push(t.id);
    });
  });
  const lateFinish: Record<string, string> = {};
  const lateStart: Record<string, string> = {};
  const projectEnd = sheet.project.end_date;
  const order = [...sheet.flatOrder].reverse();
  order.forEach((taskId) => {
    const task = sheet.tasksById[taskId];
    const succs = successors[taskId] || [];
    if (succs.length === 0) {
      lateFinish[taskId] = projectEnd;
    } else {
      const succLS = succs.map((sId) => lateStart[sId]).filter(Boolean);
      lateFinish[taskId] = succLS.length ? addDays(minDate(...succLS), -1) : projectEnd;
    }
    lateStart[taskId] =
      task.duration > 0
        ? addDays(lateFinish[taskId], -(task.duration - 1))
        : lateFinish[taskId];
    if (task.end_date >= lateFinish[taskId]) task.is_critical = true;
  });
}

export function recalc(sheet: ProjectSheet): ProjectSheet {
  sheet.childrenByParentId = rebuildChildrenIndex(sheet.tasksById);
  sheet.flatOrder = flattenOrder(sheet);
  applyDependencies(sheet);
  applyRollups(sheet);
  applyCriticalPath(sheet);
  return sheet;
}

function defaultTask(
  projectId: string,
  sortOrder: number,
  draft: TaskDraft,
  parentId: string | null,
  level: number
): Task {
  return {
    id: id("task"),
    project_id: projectId,
    parent_id: parentId,
    title: draft.title,
    start_date: draft.start_date,
    end_date: draft.end_date,
    duration: durationFromDates(draft.start_date, draft.end_date),
    bg_color: draft.bg_color || "#0f8b8d",
    text_color: draft.text_color || "#ffffff",
    is_summary: false,
    level,
    sort_order: sortOrder,
    progress: draft.progress ?? 0,
    assignee: draft.assignee || "Unassigned",
    dependencies: draft.dependencies || [],
    is_milestone: draft.is_milestone || false,
  };
}

function makeEmptySheet(draft: ProjectDraft): ProjectSheet {
  const project: Project = {
    id: id("project"),
    name: draft.name,
    description: draft.description ?? "",
    start_date: draft.start_date,
    end_date: draft.start_date,
    progress: 0,
    baselines: [],
  };
  return {
    project: { ...project, lead: draft.lead || "Unassigned" },
    tasksById: {},
    childrenByParentId: { [ROOT_KEY]: [] },
    flatOrder: [],
  };
}

// ── API sync helpers ──────────────────────────────────────────



/** Convert a frontend Task to the shape the bulk endpoint expects. */
function toDBTask(t: Task): DBTask {
  return {
    id:           t.id,
    project_id:   t.project_id,
    parent_id:    t.parent_id,
    title:        t.title,
    start_date:   t.start_date,
    end_date:     t.end_date,
    duration:     t.duration,
    bg_color:     t.bg_color,
    text_color:   t.text_color,
    is_summary:   t.is_summary,
    is_milestone: t.is_milestone,
    is_critical:  t.is_critical ?? false,
    level:        t.level,
    sort_order:   t.sort_order,
    progress:     t.progress,
    assignee:     t.assignee ?? "Unassigned",
    dependencies: t.dependencies ?? [],
  };
}

/**
 * Sync a whole project sheet to the backend (optimistic — call after local update).
 * Updates the project row (progress, end_date) and bulk-upserts tasks.
 */
async function syncSheetToAPI(projectId: string, sheet: ProjectSheet): Promise<void> {
  const tasks = Object.values(sheet.tasksById).map(toDBTask);
  await Promise.all([
    api.projects.update(projectId, {
      end_date: sheet.project.end_date,
      progress: sheet.project.progress,
      name:        sheet.project.name,
      description: sheet.project.description ?? "",
      lead:        sheet.project.lead ?? "Unassigned",
      start_date:  sheet.project.start_date,
    }),
    api.tasks.bulk(projectId, tasks),
  ]);
}



/**
 * Convert raw DB rows into a hydrated ProjectSheet with recalc applied.
 */
async function buildSheetFromDB(projectId: string, project: Project): Promise<ProjectSheet> {
  const dbTasks = await api.tasks.list(projectId);
  const tasksById: Record<string, Task> = {};
  dbTasks.forEach((t) => {
    tasksById[t.id] = {
      id:           t.id,
      project_id:   t.project_id,
      parent_id:    t.parent_id,
      title:        t.title,
      start_date:   t.start_date,
      end_date:     t.end_date,
      duration:     t.duration,
      bg_color:     t.bg_color,
      text_color:   t.text_color,
      is_summary:   t.is_summary,
      is_milestone: t.is_milestone,
      is_critical:  t.is_critical,
      level:        t.level,
      sort_order:   t.sort_order,
      progress:     t.progress,
      assignee:     t.assignee,
      dependencies: t.dependencies,
    };
  });

  const sheet: ProjectSheet = {
    project,
    tasksById,
    childrenByParentId: {},
    flatOrder: [],
  };
  return recalc(sheet);
}

// ── mutateActive ──────────────────────────────────────────────

type SetFn = StoreApi<GanttStore>['setState'];
type GetFn = StoreApi<GanttStore>['getState'];

function mutateActive(
  set: SetFn,
  updater: (sheet: ProjectSheet) => ProjectSheet
): void {
  let syncTarget: { projectId: string; sheet: ProjectSheet } | null = null;

  set((state) => {
    if (!state.activeProjectId) return {};
    const active = state.projectsById[state.activeProjectId];
    if (!active) return {};
    const next = updater(structuredClone(active));
    const projectsById = { ...state.projectsById, [state.activeProjectId]: next };
    syncTarget = { projectId: state.activeProjectId, sheet: next };
    return { projectsById };
  });

  // Fire async API sync after the synchronous state update
  if (syncTarget) {
    const { projectId, sheet } = syncTarget;
    syncSheetToAPI(projectId, sheet).catch((e) =>
      console.error("[store] Task sync failed:", e)
    );
  }
}

// ── Store ─────────────────────────────────────────────────────

export const useGanttStore = create<GanttStore>((set, get) => ({
  projectsById:    {},
  activeProjectId: null,
  zoom:            (localStorage.getItem("gantt_zoom") as ZoomLevel) || "week",
  userRole:        "editor",
  isLoading:       false,
  isInitialized:   false,
  syncError:       null,

  // ── initialize ───────────────────────────────────────────
  initialize: async (preferredProjectId?: string) => {
    set({ isLoading: true, syncError: null });

    try {
      const user = await api.users.me();
      // Upgrade anyone who is a viewer to editor
      set({ userRole: user.role === 'viewer' ? 'editor' : user.role });

      const dbProjects = await api.projects.list();
      await hydrateFromDB(set, get, dbProjects, preferredProjectId ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[store] initialize failed:", msg);
      set({
        isLoading:     false,
        isInitialized: true,
        syncError:     `Could not load data from server. (${msg})`,
      });
    }
  },

  // ── createProject ────────────────────────────────────────
  createProject: (draft) =>
    set((state) => {
      const sheet = makeEmptySheet(draft);
      const projectsById = { ...state.projectsById, [sheet.project.id]: sheet };

      // Persist to DB
      const { baselines: _b, ...proj } = sheet.project;
      api.projects
        .create({
          id:          proj.id,
          name:        proj.name,
          description: proj.description ?? "",
          start_date:  proj.start_date,
          end_date:    proj.end_date,
          lead:        proj.lead ?? "Unassigned",
          progress:    proj.progress,
        })
        .catch((e) => console.error("[store] createProject API error:", e));

      return { projectsById, activeProjectId: sheet.project.id };
    }),

  // ── openProject ──────────────────────────────────────────
  openProject: (projectId) =>
    set((state) => {
      if (!state.projectsById[projectId]) return {};
      return { activeProjectId: projectId };
    }),

  // ── editProject ──────────────────────────────────────────
  editProject: (projectId, draft) =>
    set((state) => {
      const active = state.projectsById[projectId];
      if (!active) return {};
      const next = structuredClone(active);
      next.project.name        = draft.name.trim() || next.project.name;
      next.project.description = draft.description ?? "";
      next.project.start_date  = draft.start_date;
      next.project.lead        = draft.lead || next.project.lead;
      const projectsById = { ...state.projectsById, [projectId]: next };

      api.projects
        .update(projectId, {
          name:        next.project.name,
          description: next.project.description,
          start_date:  next.project.start_date,
          lead:        next.project.lead,
        })
        .catch((e) => console.error("[store] editProject API error:", e));

      return { projectsById };
    }),

  // ── deleteProject ────────────────────────────────────────
  deleteProject: (projectId) =>
    set((state) => {
      const projectsById = { ...state.projectsById };
      delete projectsById[projectId];
      const activeProjectId =
        state.activeProjectId === projectId
          ? (Object.keys(projectsById)[0] ?? null)
          : state.activeProjectId;

      api.projects
        .delete(projectId)
        .catch((e) => console.error("[store] deleteProject API error:", e));

      return { projectsById, activeProjectId };
    }),

  // ── addTask ──────────────────────────────────────────────
  addTask: (draft, parentTaskId = null) =>
    mutateActive(set, (sheet) => {
      const title = draft.title.trim();
      if (!title) throw new Error("Task name is required.");
      const parent = parentTaskId ? sheet.tasksById[parentTaskId] : null;
      const siblings = sheet.childrenByParentId[parentTaskId ?? ROOT_KEY] ?? [];
      const nextSort =
        siblings.reduce((mx, taskId) => Math.max(mx, sheet.tasksById[taskId].sort_order), 0) + 1;
      const task = defaultTask(sheet.project.id, nextSort, draft, parentTaskId, parent ? parent.level + 1 : 0);
      sheet.tasksById[task.id] = task;
      return recalc(sheet);
    }),

  // ── editTask ─────────────────────────────────────────────
  editTask: (taskId, draft) =>
    mutateActive(set, (sheet) => {
      const task = sheet.tasksById[taskId];
      if (!task) return sheet;
      task.title        = draft.title.trim() || task.title;
      task.bg_color     = draft.bg_color;
      task.text_color   = draft.text_color;
      task.progress     = draft.progress;
      task.assignee     = draft.assignee || "Unassigned";
      task.dependencies = draft.dependencies || [];
      task.is_milestone = draft.is_milestone || false;
      if (task.is_milestone) {
        task.end_date = task.start_date;
        task.duration = 0;
      } else if (!task.is_summary) {
        task.start_date = draft.start_date;
        task.end_date   = draft.end_date;
        task.duration   = durationFromDates(task.start_date, task.end_date);
      }
      return recalc(sheet);
    }),

  // ── deleteTaskWithSubtree ────────────────────────────────
  deleteTaskWithSubtree: (taskId) =>
    mutateActive(set, (sheet) => {
      const deleteIds: string[] = [];
      const walk = (idVal: string): void => {
        deleteIds.push(idVal);
        (sheet.childrenByParentId[idVal] ?? []).forEach(walk);
      };
      walk(taskId);
      deleteIds.forEach((idVal) => delete sheet.tasksById[idVal]);
      return recalc(sheet);
    }),

  // ── createBaseline ───────────────────────────────────────
  createBaseline: async (label) => {
    let projectId: string | null = null;
    let newBaseline: Baseline | null = null;

    // 1. Apply locally
    set((state) => {
      if (!state.activeProjectId) return {};
      projectId = state.activeProjectId;
      const active = state.projectsById[state.activeProjectId];
      if (!active) return {};
      const next = structuredClone(active);
      const { baselines, ...projectWithoutBaselines } = next.project;
      const baseline: Baseline = {
        label,
        timestamp: new Date().toISOString(),
        tasksById: structuredClone(next.tasksById),
        project:   structuredClone(projectWithoutBaselines),
      };
      newBaseline = baseline;
      next.project.baselines = [...(baselines || []), baseline];
      const projectsById = { ...state.projectsById, [state.activeProjectId]: next };
      return { projectsById };
    });

    // 2. Persist to DB and attach the DB id back
    if (projectId && newBaseline) {
      try {
        const dbBaseline = await api.baselines.create({
          project_id: projectId,
          label:      (newBaseline as Baseline).label,
          tasksById:  (newBaseline as Baseline).tasksById,
          project:    (newBaseline as Baseline).project,
        });

        // Patch the db id onto the baseline we just created
        set((state) => {
          const pId = projectId!;
          const proj = state.projectsById[pId];
          if (!proj) return {};
          const next = structuredClone(proj);
          // Find last baseline with matching label that has no id yet
          let idx = -1;
          for (let i = next.project.baselines.length - 1; i >= 0; i--) {
            if (next.project.baselines[i].label === label && next.project.baselines[i].id === undefined) {
              idx = i;
              break;
            }
          }
          if (idx >= 0) next.project.baselines[idx].id = dbBaseline.id;
          return { projectsById: { ...state.projectsById, [pId]: next } };
        });
      } catch (e) {
        console.error("[store] createBaseline API error:", e);
      }
    }
  },

  // ── deleteBaseline ───────────────────────────────────────
  deleteBaseline: (index) => {
    let dbId: number | undefined;

    set((state) => {
      if (!state.activeProjectId) return {};
      const active = state.projectsById[state.activeProjectId];
      if (!active) return {};
      const next = structuredClone(active);
      const baselines = [...(next.project.baselines || [])];
      dbId = baselines[index]?.id;
      baselines.splice(index, 1);
      next.project.baselines = baselines;
      const projectsById = { ...state.projectsById, [state.activeProjectId]: next };
      return { projectsById };
    });

    if (dbId !== undefined) {
      api.baselines
        .delete(dbId)
        .catch((e) => console.error("[store] deleteBaseline API error:", e));
    }
  },

  // ── setZoom ──────────────────────────────────────────────
  setZoom: (zoom) => {
    localStorage.setItem("gantt_zoom", zoom);
    set(() => ({ zoom }));
  },
}));

// ── hydrateFromDB (helper used by initialize) ─────────────────

async function hydrateFromDB(
  set: SetFn,
  get: GetFn,
  dbProjects: Awaited<ReturnType<typeof api.projects.list>>,
  preferredActiveId: string | null
): Promise<void> {
  // Fetch tasks + baselines for every project in parallel
  const sheets: Record<string, ProjectSheet> = {};

  const results = await Promise.allSettled(
    dbProjects.map(async (proj) => {
      try {
        const [dbTasks, dbBaselines] = await Promise.all([
          api.tasks.list(proj.id),
          api.baselines.list(proj.id),
        ]);

        const tasksById: Record<string, Task> = {};
        dbTasks.forEach((t) => {
          tasksById[t.id] = {
            id:           t.id,
            project_id:   t.project_id,
            parent_id:    t.parent_id,
            title:        t.title,
            start_date:   t.start_date,
            end_date:     t.end_date,
            duration:     t.duration,
            bg_color:     t.bg_color,
            text_color:   t.text_color,
            is_summary:   t.is_summary,
            is_milestone: t.is_milestone,
            is_critical:  t.is_critical,
            level:        t.level,
            sort_order:   t.sort_order,
            progress:     t.progress,
            assignee:     t.assignee,
            dependencies: t.dependencies,
          };
        });

        const baselines: Baseline[] = dbBaselines.map((b) => ({
          id:        b.id,
          label:     b.label,
          timestamp: b.timestamp,
          tasksById: b.tasksById as Record<string, Task>,
          project:   b.project as Omit<Project, "baselines">,
        }));

        const project: Project = {
          id:          proj.id,
          name:        proj.name,
          description: proj.description,
          start_date:  proj.start_date,
          end_date:    proj.end_date,
          lead:        proj.lead,
          progress:    proj.progress,
          baselines,
        };

        const sheet: ProjectSheet = {
          project,
          tasksById,
          childrenByParentId: {},
          flatOrder: [],
        };
        recalc(sheet);
        sheets[proj.id] = sheet;
      } catch (err) {
        console.warn(`[store] Failed to load project ${proj.id}:`, err);
        // We don't throw, so other projects can still load
      }
    })
  );

  // Determine active project
  const currentActive  = get().activeProjectId;
  const preferredValid = preferredActiveId && sheets[preferredActiveId];
  const activeProjectId =
    preferredValid
      ? preferredActiveId
      : currentActive && sheets[currentActive]
      ? currentActive
      : (Object.keys(sheets)[0] ?? null);

  set({
    projectsById: sheets,
    activeProjectId,
    isLoading:     false,
    isInitialized: true,
    syncError:     null,
  });

  console.log(
    `[store] ✅  Hydrated ${Object.keys(sheets).length} project(s) from Supabase`
  );
}

// ── blankTaskDraft ────────────────────────────────────────────

export function blankTaskDraft(projectStart: string): TaskDraft {
  return {
    title:        "",
    start_date:   projectStart,
    end_date:     addDays(projectStart, 2),
    progress:     0,
    bg_color:     "#0f8b8d",
    text_color:   "#ffffff",
    assignee:     "Unassigned",
    dependencies: [],
    is_milestone: false,
  };
}
