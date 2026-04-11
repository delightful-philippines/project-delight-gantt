export type ISODateString = string;

export interface Project {
  id: string;
  name: string;
  description?: string;
  start_date: ISODateString;
  end_date: ISODateString;
  lead?: string;
  business_unit?: string;
  progress: number;
  baselines: Baseline[];
}

export interface Baseline {
  id?: number;          // DB row id — present after creation / when loaded from DB
  label: string;
  timestamp: string;
  tasksById: Record<string, Task>;
  project: Omit<Project, 'baselines'>;
}

export interface Task {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  start_date: ISODateString;
  end_date: ISODateString;
  duration: number;
  bg_color: string;
  text_color: string;
  is_summary: boolean;
  level: number;
  sort_order: number;
  progress: number;
  assignee?: string;
  dependencies: string[]; // IDs of tasks this task depends on
  is_milestone: boolean;
  is_critical?: boolean;
}

export interface ProjectSheet {
  project: Project;
  tasksById: Record<string, Task>;
  childrenByParentId: Record<string, string[]>;
  flatOrder: string[];
}

export type ZoomLevel = "day" | "week" | "month";
export type DensityLevel = "comfortable" | "compact";

export interface TaskDraft {
  id?: string;
  title: string;
  start_date: ISODateString;
  end_date: ISODateString;
  progress: number;
  bg_color: string;
  text_color: string;
  assignee?: string;
  dependencies: string[];
  is_milestone: boolean;
}

export interface ProjectDraft {
  name: string;
  start_date: ISODateString;
  description?: string;
  lead?: string;
}

export interface GanttStore {
  // ── Data ──────────────────────────────────────────────────
  projectsById: Record<string, ProjectSheet>;
  activeProjectId: string | null;
  zoom: ZoomLevel;
  density: DensityLevel;

  // ── Sync state ────────────────────────────────────────────
  userRole: 'super_admin' | 'editor' | 'viewer';
  isLoading: boolean;       // true during the initial DB fetch
  isInitialized: boolean;   // true once data is ready (DB or localStorage fallback)
  syncError: string | null; // non-null when the last background sync failed

  // ── Actions ───────────────────────────────────────────────
  initialize: (preferredProjectId?: string) => Promise<void>;
  createProject: (draft: ProjectDraft) => void;
  openProject: (projectId: string) => void;
  editProject: (projectId: string, draft: ProjectDraft) => void;
  deleteProject: (projectId: string) => void;
  addTask: (draft: TaskDraft, parentTaskId?: string | null) => void;
  bulkAddTasks: (entries: Array<{ draft: TaskDraft; parentTaskId: string | null }>) => void;
  editTask: (taskId: string, draft: TaskDraft) => void;
  deleteTaskWithSubtree: (taskId: string) => void;
  duplicateTask: (taskId: string) => void;
  createBaseline: (label: string) => Promise<void>;
  deleteBaseline: (index: number) => void;
  setZoom: (zoom: ZoomLevel) => void;
  setDensity: (density: DensityLevel) => void;
}
