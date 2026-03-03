import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProjectDraft, Task, TaskDraft } from "../types";
import { useAuthStore } from "../store/useAuthStore";
import { useGanttStore, blankTaskDraft } from "../store/useGanttStore";
import { api, DBUser, DBEmployee } from "../lib/api";
import { TaskGrid } from "./TaskGrid";
import { Timeline } from "./Timeline";
import { TeamProgress } from "./TeamProgress";
import { CustomSelect } from "./ui/CustomSelect";
import { CustomDatePicker } from "./ui/CustomDatePicker";
import { UserAvatar } from "./ui/UserAvatar";
import { UserSelect } from "./ui/UserSelect";
import { SupabaseStatus, DbStatusButton } from "./SupabaseStatus";
import { ConfirmDialog, Toast } from "./ui/Dialog";

type ModalState =
  | { type: "none" }
  | { type: "create_project" }
  | { type: "edit_project"; projectId: string }
  | { type: "project_list" }
  | { type: "settings" }
  | { type: "profile" }
  | { type: "team" }
  | { type: "add_task"; parentTaskId: string | null }
  | { type: "edit_task"; taskId: string }
  | { type: "delete_task"; taskId: string }
  | { type: "delete_project"; projectId: string }
  | { type: "baselines" };

function FieldLabel({ children }: { children: string }): JSX.Element {
  return <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{children}</span>;
}

const CURATED_COLORS = [
  { bg: "#3b82f6", text: "#ffffff", name: "Blue" },
  { bg: "#10b981", text: "#ffffff", name: "Green" },
  { bg: "#f59e0b", text: "#ffffff", name: "Amber" },
  { bg: "#ef4444", text: "#ffffff", name: "Red" },
  { bg: "#8b5cf6", text: "#ffffff", name: "Purple" },
  { bg: "#ec4899", text: "#ffffff", name: "Pink" },
  { bg: "#06b6d4", text: "#ffffff", name: "Cyan" },
  { bg: "#f97316", text: "#ffffff", name: "Orange" },
  { bg: "#64748b", text: "#ffffff", name: "Slate" },
];

function TaskForm({
  value,
  onChange,
  disableDates = false,
  disableProgress = false,
  availableTasks = [],
  currentTaskId,
  systemUsers
}: {
  value: TaskDraft;
  onChange: (next: TaskDraft) => void;
  disableDates?: boolean;
  disableProgress?: boolean;
  availableTasks?: Task[];
  currentTaskId?: string;
  systemUsers: DBUser[];
}): JSX.Element {
  // Local state for smooth editing without re-rendering the whole app
  const [local, setLocal] = useState(value);
  const [showDepSearch, setShowDepSearch] = useState(false);

  const sync = (next: TaskDraft) => {
    setLocal(next);
    onChange(next);
  };

  const filteredTasks = (availableTasks || []).filter(t => t.id !== currentTaskId);
  const uniqueAssignees = Array.from(new Set((availableTasks || []).map(t => t.assignee).filter(Boolean)));

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 flex items-center justify-center rounded-xl transition-colors ${local.is_milestone ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {local.is_milestone 
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.518 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              }
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-800">Task Mode</div>
            <p className="text-xs text-slate-500">{local.is_milestone ? 'Zero-duration milestone' : 'Standard work task'}</p>
          </div>
        </div>
        <button 
          type="button"
          onClick={() => sync({ ...local, is_milestone: !local.is_milestone })}
          className={`flex h-6 w-11 items-center rounded-full transition-colors ${local.is_milestone ? 'bg-amber-500' : 'bg-slate-200'}`}
        >
          <div className={`h-4 w-4 rounded-full bg-white transition-transform ${local.is_milestone ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <label className="grid gap-1.5 focus-within:text-blue-500 transition-colors">
        <FieldLabel>Task Name</FieldLabel>
        <input 
          className="input-premium font-medium text-sm" 
          placeholder="What needs to be done?"
          value={local.title} 
          onChange={(e) => sync({ ...local, title: e.target.value })} 
          required 
          autoFocus
        />
      </label>
      
      <label className="grid gap-1.5">
        <FieldLabel>Assignee</FieldLabel>
        <UserSelect 
          users={systemUsers}
          value={local.assignee || ""}
          onChange={(val) => sync({ ...local, assignee: val })}
        />
      </label>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <FieldLabel>Start Date</FieldLabel>
          <CustomDatePicker
            disabled={disableDates}
            value={local.start_date}
            max={local.end_date}
            onChange={(val) => {
              const next: TaskDraft = { ...local, start_date: val };
              if (val > local.end_date) next.end_date = val;
              sync(next);
            }}
          />
        </label>
        <label className="grid gap-1.5">
          <FieldLabel>End Date</FieldLabel>
          <CustomDatePicker
            disabled={disableDates}
            value={local.end_date}
            min={local.start_date}
            onChange={(val) => {
              const next: TaskDraft = { ...local, end_date: val };
              if (val < local.start_date) next.start_date = val;
              sync(next);
            }}
          />
        </label>
      </div>

      <div className="space-y-4">
        <div className={`grid gap-2 ${disableProgress ? "opacity-40 grayscale pointer-events-none" : ""}`}>
          <div className="flex items-center justify-between">
            <FieldLabel>Completion Progress</FieldLabel>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{local.progress}%</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 h-6 flex items-center">
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="1"
                className="w-full accent-blue-600 h-1.5 rounded-full bg-slate-100 cursor-pointer appearance-none"
                value={local.progress} 
                onChange={(e) => sync({ ...local, progress: parseInt(e.target.value) || 0 })} 
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <FieldLabel>Theme & Color</FieldLabel>
          <div className="flex flex-wrap gap-5 p-5 bg-slate-50/50 rounded-xl border border-slate-100">
            {CURATED_COLORS.map((c) => (
              <button
                key={c.bg}
                type="button"
                onClick={() => sync({ ...local, bg_color: c.bg, text_color: c.text })}
                className={`h-7 w-7 rounded-full border-2 transition-all hover:scale-[1.4] hover:shadow-[0_0_15px_-3px_rgba(0,0,0,0.2)] active:scale-95 ${
                  local.bg_color === c.bg ? "border-slate-800 ring-4 ring-slate-800/20" : "border-white shadow-sm"
                }`}
                style={{ backgroundColor: c.bg }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <FieldLabel>Dependencies</FieldLabel>
            <button 
              type="button"
              onClick={() => setShowDepSearch(!showDepSearch)}
              className="text-xs font-medium text-blue-600 uppercase hover:underline"
            >
              {showDepSearch ? "Done" : "Add Link"}
            </button>
          </div>
          
          {local.dependencies.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {local.dependencies.map(depId => {
                const t = (availableTasks || []).find(x => x.id === depId);
                return (
                  <div key={depId} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg text-xs font-medium text-blue-700">
                    <span className="truncate max-w-[120px]">{t?.title || "Unknown"}</span>
                    <button 
                      onClick={() => sync({ ...local, dependencies: local.dependencies.filter(id => id !== depId) })}
                      className="hover:text-blue-900"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {showDepSearch && (
            <div className="scroll-premium max-h-48 overflow-auto grid gap-1 p-3 bg-slate-50 border border-slate-100 rounded-xl">
              {filteredTasks.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No other tasks available</p>}
              {filteredTasks.map(t => {
                const isSelected = local.dependencies.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const next = isSelected 
                        ? local.dependencies.filter(id => id !== t.id)
                        : [...local.dependencies, t.id];
                      sync({ ...local, dependencies: next });
                    }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'hover:bg-white hover:shadow-sm text-slate-600'}`}
                  >
                    <div className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'border-white/40 bg-white/20' : 'border-slate-200 bg-white'}`}>
                      {isSelected && <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-xs font-medium truncate">{t.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalLayout({
  title,
  children,
  onCancel,
  onConfirm,
  confirmLabel,
  confirmVariant = "primary"
}: {
  title: string;
  children: JSX.Element | JSX.Element[];
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmVariant?: "primary" | "danger";
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-slate-900/40 backdrop-blur-sm animate-fade-in px-4">
      <div className="animate-enter w-full max-w-xl flex flex-col rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Sticky Header */}
        <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 flex items-center justify-between shrink-0">
          <h3 className="text-lg sm:text-xl font-medium tracking-tight text-slate-800">{title}</h3>
          <button onClick={onCancel} className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-4 sm:px-8 py-2 overflow-y-auto overflow-x-visible grow no-scrollbar min-h-0">
          <div className="pb-6">
            {children}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 flex justify-end gap-3 border-t border-slate-50 bg-slate-50/30 shrink-0">
          <button className="btn-premium btn-secondary px-6 sm:px-8" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className={`btn-premium px-8 sm:px-10 ${confirmVariant === "danger" ? "btn-danger shadow-red-200" : "btn-primary shadow-blue-200"} shadow-xl`} 
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
export function GanttApp(): JSX.Element {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const {
    projectsById,
    activeProjectId,
    zoom,
    createProject,
    openProject,
    editProject,
    deleteProject,
    addTask,
    editTask,
    deleteTaskWithSubtree,
    createBaseline,
    deleteBaseline,
    setZoom,
    initialize,
    isLoading,
    isInitialized,
    syncError,
    userRole,
  } = useGanttStore((s) => ({
    projectsById: s.projectsById,
    activeProjectId: s.activeProjectId,
    zoom: s.zoom,
    createProject: s.createProject,
    openProject: s.openProject,
    editProject: s.editProject,
    deleteProject: s.deleteProject,
    addTask: s.addTask,
    editTask: s.editTask,
    deleteTaskWithSubtree: s.deleteTaskWithSubtree,
    createBaseline: s.createBaseline,
    deleteBaseline: s.deleteBaseline,
    setZoom: s.setZoom,
    initialize: s.initialize,
    isLoading: s.isLoading,
    isInitialized: s.isInitialized,
    syncError: s.syncError,
    userRole: s.userRole,
  }));

  const activeSheet = activeProjectId ? projectsById[activeProjectId] : null;

  const assignees = useMemo(() => {
    if (!activeSheet) return [];
    const set = new Set<string>();
    if (activeSheet.project.lead && activeSheet.project.lead !== "Unassigned") {
      set.add(activeSheet.project.lead);
    }
    Object.values(activeSheet.tasksById).forEach(t => {
      if (t.assignee && t.assignee !== "Unassigned") {
        set.add(t.assignee);
      }
    });
    return Array.from(set);
  }, [activeSheet]);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(620);
  const [activeTab, setActiveTab] = useState<"Gantt" | "Timeline" | "Tasks" | "Progress">("Gantt");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [systemUsers, setSystemUsers] = useState<DBUser[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<DBUser[]>([]);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>({
    name: "",
    start_date: new Date().toISOString().slice(0, 10),
    description: ""
  });
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() => blankTaskDraft(projectDraft.start_date));
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [selectedBaselineIndex, setSelectedBaselineIndex] = useState<number | null>(null);
  const [baselineLabel, setBaselineLabel] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showDbStatus, setShowDbStatus] = useState(false);
  const [employeeInfo, setEmployeeInfo] = useState<DBEmployee | null>(null);
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(new Set());

  const projectViewers = useMemo(() => {
    if (!registeredUsers.length) return [];
    // Only show people with global view permissions as "Viewers"
    return registeredUsers.filter(u => u.can_view_all_projects);
  }, [registeredUsers]);

  const visibleRowIds = useMemo(() => {
    if (!activeSheet) return [];
    const collapsed = collapsedTaskIds;
    const result: string[] = [];
    let skipUntilLevel: number | null = null;
    for (const taskId of activeSheet.flatOrder) {
      const task = activeSheet.tasksById[taskId];
      if (skipUntilLevel !== null) {
        if (task.level > skipUntilLevel) continue;
        else skipUntilLevel = null;
      }
      result.push(taskId);
      if (collapsed.has(taskId)) {
        skipUntilLevel = task.level;
      }
    }
    return result;
  }, [activeSheet, collapsedTaskIds]);

  const toggleCollapse = (taskId: string) => {
    setCollapsedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // ── Dialog state ───────────────────────────────────────────
  const [toast, setToast] = useState<{ title: string; message?: string; variant?: 'success' | 'info' | 'warning' | 'danger' } | null>(null);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const showToast = (title: string, message?: string, variant: 'success' | 'info' | 'warning' | 'danger' = 'info') =>
    setToast({ title, message, variant });
  const showConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirmState({ title, message, onConfirm });

  // ── Initialize from Supabase if needed ──────────────
  useEffect(() => {
    if (!isInitialized) {
      initialize(projectId);
    } else if (projectId && projectId !== activeProjectId) {
      if (projectsById[projectId]) {
        openProject(projectId);
      } else {
        // Project not found, go back
        navigate('/', { replace: true });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, projectId, activeProjectId]);

  // Reset collapse state when project changes
  useEffect(() => {
    setCollapsedTaskIds(new Set());
    setScrollTop(0);
  }, [activeProjectId]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await api.employees.search('');
        const mappedUsers: DBUser[] = data.map((e: DBEmployee) => ({
          email: e.company_email_add || `id:${e.employee_id}`,
          first_name: e.first_name,
          last_name: e.last_name,
          role: 'viewer' as const,
          created_at: '',
          updated_at: '',
          can_view_all_projects: false
        }));
        setSystemUsers(mappedUsers);
        
        // Also fetch registered users to identify viewers
        const regUsers = await api.users.list();
        setRegisteredUsers(regUsers);
      } catch (err) {
        console.error("Failed to fetch directory or registered users:", err);
      }
    };
    fetchUsers();
    api.employees.me().then(setEmployeeInfo).catch(console.error);
  }, []);

  const editingTask: Task | null =
    modal.type === "edit_task" && activeSheet ? activeSheet.tasksById[modal.taskId] ?? null : null;
  const deletingTask: Task | null =
    modal.type === "delete_task" && activeSheet ? activeSheet.tasksById[modal.taskId] ?? null : null;

  const projectOptions = Object.values(projectsById).map(p => ({
    value: p.project.id,
    label: p.project.name
  }));

  const zoomOptions = [
    { value: "day", label: "Day View" },
    { value: "week", label: "Week View" },
    { value: "month", label: "Month View" }
  ];

  return (
    <div className="flex h-full bg-slate-100 overflow-hidden font-sans relative">
      <SupabaseStatus isOpen={showDbStatus} onClose={() => setShowDbStatus(false)} />

      {/* ── DB Loading overlay ── */}
      {isLoading && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15,23,42,0.82)',
          backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16, fontFamily: '"Inter", system-ui, sans-serif',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '3px solid #1e293b',
            borderTop: '3px solid #34d399',
            animation: 'sb-spin 0.8s linear infinite',
          }} />
          <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>
            Loading from Supabase…
          </p>
          <style>{`@keyframes sb-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Sync error toast ── */}
      {!isLoading && syncError && (
        <div style={{
          position: 'fixed', bottom: 56, left: 20, zIndex: 9990,
          background: '#450a0a', border: '1px solid #7f1d1d',
          borderRadius: 10, padding: '10px 16px',
          fontSize: 12, color: '#fca5a5', maxWidth: 320,
          fontFamily: '"Inter", system-ui, sans-serif',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          ⚠️ {syncError}
        </div>
      )}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-[200] w-[72px] flex-col items-center border-r border-slate-200/60 bg-white/80 backdrop-blur-3xl py-6 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.05)]">
        <div className="mb-8 flex h-10 w-10 items-center justify-center text-blue-600">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="flex flex-col items-center gap-6">
          {[
            { id: "B", label: "Dashboard", onClick: () => navigate("/"), icon: <path d="M10 19l-7-7m0 0l7-7m-7 7h18" /> },
            { id: "H", label: "Gantt View", onClick: () => setActiveTab("Gantt"), icon: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
            { id: "S", label: "Team Progress", onClick: () => setActiveTab("Progress"), icon: <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
            { id: "U", label: "Toggle View", onClick: () => setActiveTab(activeTab === "Gantt" ? "Timeline" : "Gantt"), icon: <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /> },
            { id: "+", label: "New Project", onClick: () => setModal({ type: "create_project" }), icon: <path d="M12 4v16m8-8H4" /> },
          ].map((item) => (
            <button 
              key={item.id} 
              onClick={item.onClick}
              className={`group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                (item.id === "H" && activeTab === "Gantt") ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-400 hover:bg-slate-100 hover:text-blue-500"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {item.icon}
              </svg>
              <span className="absolute left-full ml-3 hidden group-hover:block whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-xs font-medium text-white uppercase tracking-wider shadow-xl z-[300]">
                {item.label}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-auto flex flex-col items-center gap-6 pb-4">
          <button 
            className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
            onClick={() => setModal({ type: "settings" })}
            title="System Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>


          <button 
            onClick={() => logout()}
            className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all group relative border border-transparent hover:border-slate-200"
            title="Logout"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="absolute left-full ml-3 hidden group-hover:block whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-bold text-white uppercase tracking-wider shadow-xl z-[300]">
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col pl-0 lg:pl-[72px] pb-16 lg:pb-0 relative bg-[#f8fafc]">
        {/* ── Background Patterns (Gantt-inspired, synced with Login) ── */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.012]">
          {/* Vertical Grid Lines */}
          <div className="absolute inset-0 flex justify-around">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="h-full w-px bg-slate-900" />
            ))}
          </div>
          
          {/* Faded Horizontal Task Bars */}
          <div className="absolute inset-0 py-24 flex flex-col gap-16">
             <div className="h-10 w-64 bg-slate-900 rounded-full ml-[5%] opacity-40" />
             <div className="h-10 w-[400px] bg-slate-900 rounded-full ml-[45%] opacity-20" />
             <div className="h-10 w-48 bg-slate-900 rounded-full ml-[25%] opacity-30" />
             <div className="h-10 w-80 bg-slate-900 rounded-full ml-[70%] opacity-15" />
             <div className="h-10 w-[600px] bg-slate-900 rounded-full ml-[10%] opacity-25" />
             <div className="h-10 w-96 bg-slate-900 rounded-full ml-[35%] opacity-35" />
          </div>
        </div>
        <header className="z-[150] sticky top-0 border-b border-slate-200/60 bg-white/70 backdrop-blur-2xl px-4 lg:px-6 py-4 shadow-[0_4px_24px_-10px_rgba(0,0,0,0.05)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 lg:gap-3 overflow-hidden">
              <button 
                className="hidden lg:flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-all group shrink-0"
              >
                <div className="flex items-center gap-2">
                  <span>Workspace</span>
                  {employeeInfo?.business_unit && (
                    <>
                      <span className="text-slate-200 font-normal">/</span>
                      <span className="text-slate-500 group-hover:text-blue-500 transition-colors">{employeeInfo.business_unit}</span>
                    </>
                  )}
                </div>
                <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </button>
              <div className="flex flex-col lg:flex-row lg:items-center gap-0 lg:gap-4 overflow-hidden">
                <h1 className="text-base lg:text-lg font-medium tracking-tight text-slate-800 flex items-center gap-2 truncate">
                  {activeSheet?.project.name ?? "Select Project"}
                  {activeSheet && (
                    <button 
                      onClick={() => {
                        setProjectDraft({
                          name: activeSheet.project.name,
                          start_date: activeSheet.project.start_date,
                          description: activeSheet.project.description,
                          lead: activeSheet.project.lead
                        });
                        setModal({ type: "edit_project", projectId: activeSheet.project.id });
                      }}
                      className="hidden lg:block p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-500 transition-all"
                      title="Rename Project"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  )}
                </h1>
                {activeSheet && (
                  <div className="flex items-center gap-1.5 lg:border-l lg:border-slate-200 lg:pl-4">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-tighter">Progress:</span>
                    <span className="text-sm font-medium text-blue-600 font-mono">
                      {activeSheet.project.progress ?? 0}%
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 sm:gap-3 no-scrollbar shrink-0">
              {activeSheet && (
                <div className="hidden md:flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-xl border border-slate-200/60 shadow-sm mr-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Lead</span>
                  <div className="h-4 w-px bg-slate-200 mx-1" />
                  <span className="text-xs font-semibold text-slate-700">
                    {(() => {
                      const email = activeSheet.project.lead;
                      if (!email) return "Unassigned";
                      const user = systemUsers.find(u => u.email === email);
                      if (user?.first_name || user?.last_name) {
                        const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                        return full.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                      }
                      return email;
                    })()}
                  </span>
                </div>
              )}
              
              <div className="hidden sm:flex -space-x-1.5 mr-2">
                {projectViewers.slice(0, 3).map((u: DBUser) => (
                  <UserAvatar key={u.email} email={u.email} name={`${u.first_name || ''} ${u.last_name || ''}`} size="md" className="border-2 border-white ring-1 ring-slate-100" />
                ))}
                {projectViewers.length > 3 && (
                  <button 
                    onClick={() => setModal({ type: "team" })}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-white bg-slate-50 text-xs font-medium text-slate-400 ring-1 ring-slate-100 hover:bg-slate-100 transition-colors"
                  >
                    +{projectViewers.length - 3}
                  </button>
                )}
              </div>

              <div className="hidden lg:flex items-center gap-2">
                <button 
                  className="btn-premium btn-secondary h-9 px-3 sm:px-4 text-xs font-medium flex items-center gap-2"
                  onClick={() => { navigator.clipboard.writeText(window.location.href).catch(()=>{}); showToast('Link Copied!', 'Project share link has been copied to clipboard.', 'success'); }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  <span className="hidden md:inline">Share</span>
                </button>
                <button 
                  className="btn-premium btn-primary h-9 px-3 sm:px-4 text-xs font-medium flex items-center gap-2"
                  onClick={() => {
                    if (!activeSheet) return;
                    const data = JSON.stringify(activeSheet, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${activeSheet.project.name.replace(/\s+/g, '_')}_Gantt.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast('Export Successful', `"${activeSheet?.project.name}" exported as JSON.`, 'success');
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span className="hidden md:inline">Export</span>
                </button>

                {/* Current User Profile at the very right */}
                <div className="hidden sm:flex items-center gap-3 border-l border-slate-200 pl-4 ml-2">
                  <div className="flex flex-col text-right leading-tight">
                    <span className="text-xs font-semibold text-slate-800 leading-none">{user?.name || 'User'}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-1">
                      {userRole?.replace('_', ' ')}
                    </span>
                  </div>
                  <UserAvatar 
                    email={user?.email} 
                    name={user?.name || user?.email} 
                    size="md" 
                    className="border-2 border-white ring-1 ring-slate-100 cursor-pointer hover:ring-blue-100 transition-all" 
                    onClick={() => setModal({ type: "profile" })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <nav className="flex items-center gap-1 rounded-xl bg-slate-100/50 p-1">
              {(["Gantt", "Timeline", "Tasks"] as const).map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 sm:px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-all rounded-lg ${activeTab === tab ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {tab}
                </button>
              ))}
            </nav>
            
            <div className="flex items-center gap-2">
              {activeSheet && (
                <button 
                  className="lg:hidden btn-premium btn-secondary h-9 w-9 p-0 flex items-center justify-center"
                  onClick={() => setIsMobileMenuOpen(true)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                </button>
              )}

              <div className="hidden lg:flex items-center gap-3 overflow-x-auto pb-2 lg:pb-0 no-scrollbar -mx-2 px-2 lg:mx-0 lg:px-0">
                {userRole !== 'viewer' && (
                  <button className="btn-premium btn-secondary h-9 px-4 text-xs" onClick={() => setModal({ type: "create_project" })}>
                    + New Project
                  </button>
                )}
                
                {activeSheet && (
                  <>
                    <button 
                      onClick={() => setShowCriticalPath(!showCriticalPath)}
                      className={`btn-premium h-9 px-3 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                        showCriticalPath ? "bg-red-50 text-red-600 border-red-200" : "btn-secondary"
                      }`}
                      title="Toggle Critical Path"
                    >
                      <div className={`w-2 h-2 rounded-full ${showCriticalPath ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} />
                      Critical Path
                    </button>

                    <button 
                      className="btn-premium btn-secondary h-9 px-4 text-xs font-medium flex items-center gap-2"
                      onClick={() => setModal({ type: "baselines" })}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Snapshots
                    </button>

                    <div className="h-6 w-px bg-slate-200 mx-1" />
                    <CustomSelect
                      className="min-w-[200px]"
                      options={projectOptions}
                      value={activeSheet.project.id}
                      onChange={(val) => navigate(`/project/${val}`)}
                    />
                    <CustomSelect
                      className="min-w-[140px]"
                      options={zoomOptions}
                      value={zoom}
                      onChange={(val) => setZoom(val as any)}
                    />
                    {userRole !== 'viewer' && (
                      <>
                        <button className="btn-premium btn-primary h-9 px-4 text-xs group" onClick={() => {
                          const defaultAssignee = activeSheet?.project.lead || "Unassigned";
                          setTaskDraft({ ...blankTaskDraft(activeSheet?.project.start_date || new Date().toISOString().slice(0, 10)), assignee: defaultAssignee });
                          setModal({ type: "add_task", parentTaskId: null });
                        }}>
                          <svg className="w-4 h-4 mr-1 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          New Task
                        </button>
                        <button 
                          className="btn-premium btn-danger h-9 w-9 p-0 flex items-center justify-center" 
                          onClick={() => setModal({ type: "delete_project", projectId: activeSheet.project.id })}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
              {userRole !== 'viewer' && (
                <button 
                  className="lg:hidden btn-premium btn-primary h-9 px-4 text-xs group" 
                  onClick={() => setModal({ type: "add_task", parentTaskId: null })}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  <span className="hidden sm:inline ml-1">Task</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {activeSheet ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Shared Vertical Scroll Container */}
            <div 
              className="flex-1 overflow-y-auto scroll-premium" 
              onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
            >
              <div className={`grid min-h-full gap-px pr-0 pb-px ${
                activeTab === "Gantt" 
                  ? "grid-cols-1 lg:grid-cols-[minmax(640px,45%)_1fr]" 
                  : "grid-cols-1"
              }`}>
                {(activeTab === "Gantt" || activeTab === "Tasks") && (
                  <TaskGrid
                    sheet={activeSheet}
                    rowIds={visibleRowIds}
                    scrollTop={scrollTop}
                    onScrollTop={setScrollTop}
                    onViewportHeight={setViewportHeight}
                    viewportHeight={viewportHeight}
                    onAddSubtask={(p: Task) => {
                      setTaskDraft({ ...blankTaskDraft(p.start_date), assignee: p.assignee || "Unassigned" });
                      setModal({ type: "add_task", parentTaskId: p.id });
                    }}
                    onEditTask={(t: Task) => {
                      setTaskDraft({ 
                        title: t.title, 
                        start_date: t.start_date, 
                        end_date: t.end_date, 
                        progress: t.progress,
                        bg_color: t.bg_color, 
                        text_color: t.text_color,
                        assignee: t.assignee,
                        dependencies: t.dependencies || [],
                        is_milestone: t.is_milestone || false
                      });
                      setModal({ type: "edit_task", taskId: t.id });
                    }}
                    onDeleteTask={(t: Task) => setModal({ type: "delete_task", taskId: t.id })}
                    userRole={userRole}
                    systemUsers={systemUsers}
                    collapsedTaskIds={collapsedTaskIds}
                    onToggleCollapse={toggleCollapse}
                  />
                )}
                {(activeTab === "Gantt" || activeTab === "Timeline") && (
                  <Timeline
                    sheet={activeSheet}
                    rowIds={visibleRowIds}
                    scrollTop={scrollTop}
                    onScrollTop={setScrollTop}
                    viewportHeight={viewportHeight}
                    zoom={zoom}
                    onEditTask={(t: Task) => {
                       setTaskDraft({ 
                        title: t.title, 
                        start_date: t.start_date, 
                        end_date: t.end_date, 
                        progress: t.progress,
                        bg_color: t.bg_color, 
                        text_color: t.text_color,
                        assignee: t.assignee,
                        dependencies: t.dependencies || [],
                        is_milestone: t.is_milestone || false
                      });
                      setModal({ type: "edit_task", taskId: t.id });
                    }}
                    showCriticalPath={showCriticalPath}
                    baseline={selectedBaselineIndex !== null ? activeSheet.project.baselines[selectedBaselineIndex] : undefined}
                    userRole={userRole}
                  />
                )}
                {activeTab === "Progress" && (
                  <TeamProgress sheet={activeSheet} systemUsers={systemUsers} />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 place-items-center bg-slate-50">
            <div className="animate-enter max-w-lg text-center p-12 card-premium">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              </div>
              <h2 className="text-3xl font-medium tracking-tight text-slate-900">Get started today</h2>
              <p className="mt-4 text-slate-500 text-lg">
                Create your first project to visualize your tasks, dependencies, and timeline in one place.
              </p>
              <button 
                className="btn-premium btn-primary mt-8 h-12 px-8 text-base shadow-xl shadow-blue-200" 
                onClick={() => setModal({ type: "create_project" })}
              >
                Create My Project
              </button>
            </div>
          </div>
        )}

        {/* Project Sheet Tabs (Spreadsheet Style) */}
        <div className="h-10 shrink-0 bg-white border-t border-slate-200 flex items-center px-4 gap-1 z-10 overflow-x-auto scroll-premium">
          <div className="flex items-center gap-0.5 pr-4 border-r border-slate-100 mr-2">
            <button 
              onClick={() => setModal({ type: "create_project" })}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-all"
              title="Create New Project"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            </button>
            <button 
              onClick={() => setModal({ type: "project_list" })}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
              title="All Projects"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>

          {Object.values(projectsById).map(p => {
            const isActive = activeProjectId === p.project.id;
            return (
              <button
                key={p.project.id}
                onClick={() => navigate(`/project/${p.project.id}`)}
                className={`group h-full px-5 flex items-center gap-2 text-xs font-medium transition-all relative border-r border-slate-50 min-w-[120px] max-w-[200px] ${
                  isActive 
                    ? "bg-slate-50 text-blue-600 shadow-[inset_0_-2px_0_#3b82f6]" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-500 animate-pulse' : 'bg-slate-200'}`} />
                <span className="truncate flex-1">{p.project.name}</span>
                <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                  {p.project.progress ?? 0}%
                </span>
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500 opacity-20" />
                )}
              </button>
            );
          })}
          {/* DB Status pill — pinned to the far right */}
          <div style={{ marginLeft: 'auto', height: '100%', display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
            <DbStatusButton
              status="connected"
              onClick={() => setShowDbStatus(prev => !prev)}
            />
          </div>
        </div>
      </main>

      {modal.type === "project_list" && (
        <ModalLayout
          title="Switch Project"
          onCancel={() => setModal({ type: "none" })}
          onConfirm={() => setModal({ type: "create_project" })}
          confirmLabel="Create New"
        >
          <div className="grid gap-3">
            {Object.values(projectsById).map(p => (
              <button 
                key={p.project.id}
                onClick={() => {
                  navigate(`/project/${p.project.id}`);
                  setModal({ type: "none" });
                }}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all hover:scale-[1.02] active:scale-95 ${
                  activeProjectId === p.project.id ? "border-blue-500 bg-blue-50/50 ring-4 ring-blue-500/5 text-blue-700" : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"
                }`}
              >
                <div>
                  <div className="font-medium">{p.project.name}</div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 mt-1">{p.flatOrder.length} Tasks • Starts {p.project.start_date}</div>
                </div>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${activeProjectId === p.project.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                </div>
              </button>
            ))}
          </div>
        </ModalLayout>
      )}

      {modal.type === "settings" && (
        <ModalLayout
          title="System Settings"
          onCancel={() => setModal({ type: "none" })}
          onConfirm={() => setModal({ type: "none" })}
          confirmLabel="Close"
        >
          <div className="grid gap-6 py-2">
            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-100">
               <div>
                  <div className="text-sm font-medium text-slate-800">Database Sync</div>
                  <p className="text-xs text-slate-500 mt-1">All project data is stored securely in Supabase.</p>
               </div>
               <div className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" />
            </div>
          </div>
        </ModalLayout>
      )}

      {modal.type === "profile" && (
        <ModalLayout
          title="User Profile"
          onCancel={() => setModal({ type: "none" })}
          onConfirm={() => setModal({ type: "none" })}
          confirmLabel="Done"
        >
          <div className="flex flex-col items-center py-6">
            <div className="relative">
              <UserAvatar email={user?.email} name={user?.name || user?.email} size="xl" className="border-4 border-white shadow-xl" />
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-lg bg-green-500 border-4 border-white shadow-sm" />
            </div>
            <h4 className="mt-4 text-xl font-medium text-slate-800">
              {user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.name || "Workspace Member"}
            </h4>
            <p className="text-sm text-slate-400 font-medium mb-1">{user?.email}</p>
            <p className="text-xs uppercase font-medium text-slate-300 tracking-widest">member since Feb 2024</p>
            
            <div className="mt-8 grid w-full gap-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Active Status</span>
                <span className="text-sm font-medium text-green-600">Online</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Workspace Role</span>
                <span className="text-sm font-medium text-blue-600">Administrator</span>
              </div>
            </div>
          </div>
        </ModalLayout>
      )}

      {modal.type === "team" && (
        <ModalLayout
          title="Shared Viewers"
          onCancel={() => setModal({ type: "none" })}
          onConfirm={() => setModal({ type: "none" })}
          confirmLabel="Close"
        >
          <div className="grid gap-4 py-2">
            {projectViewers.length > 0 ? (
              projectViewers.map((user: DBUser) => (
                <div key={user.email} className="flex items-center justify-between rounded-xl border border-slate-100 p-4 transition-all hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <UserAvatar email={user.email} size="lg" />
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.email}
                      </div>
                      <div className="text-xs text-slate-400 uppercase tracking-widest">
                        {user.can_view_all_projects ? "Global Viewer" : "Restricted"}
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-widest">Workspace Viewer</div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-400">No global viewers configured.</p>
              </div>
            )}
          </div>
        </ModalLayout>
      )}

      {/* Modals */}
      {modal.type === "edit_project" && (
        <ModalLayout
          title="Edit Project Details"
          onCancel={() => setModal({ type: "none" })}
          onConfirm={() => {
            if (!projectDraft.name.trim()) return;
            editProject(modal.projectId, projectDraft);
            setModal({ type: "none" });
          }}
          confirmLabel="Save Project"
        >
          <div className="grid gap-6">
            <label className="grid gap-1.5 focus-within:text-blue-600 transition-colors">
              <FieldLabel>Project Name</FieldLabel>
              <input 
                className="input-premium" 
                placeholder="E.g. Website Redesign 2024"
                value={projectDraft.name} 
                onChange={(e) => setProjectDraft((d) => ({ ...d, name: e.target.value }))} 
              />
            </label>
            <label className="grid gap-1.5">
              <FieldLabel>Start Date</FieldLabel>
              <CustomDatePicker
                value={projectDraft.start_date}
                onChange={(val) => setProjectDraft({ ...projectDraft, start_date: val })}
              />
            </label>
            <label className="grid gap-1.5 focus-within:text-blue-600 transition-colors">
              <FieldLabel>Project Lead</FieldLabel>
              <UserSelect
                users={systemUsers}
                value={projectDraft.lead || ""}
                onChange={(val) => setProjectDraft((d) => ({ ...d, lead: val }))}
              />
            </label>
            <label className="grid gap-1.5 focus-within:text-blue-600 transition-colors">
              <FieldLabel>Description (Optional)</FieldLabel>
              <textarea
                className="scroll-premium min-h-32 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                placeholder="Describe your project goals..."
                value={projectDraft.description}
                onChange={(e) => setProjectDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </label>
          </div>
        </ModalLayout>
      )}

      {modal.type === "delete_project" && (
        <ModalLayout
          title="Delete Project"
          onCancel={() => setModal({ type: "none" })}
          onConfirm={() => {
            deleteProject(modal.projectId);
            setModal({ type: "none" });
          }}
          confirmLabel="Delete Everything"
          confirmVariant="danger"
        >
          <div className="py-2">
            <p className="text-slate-600 leading-relaxed">
              Are you sure you want to delete <span className="font-medium text-slate-900">"{projectsById[modal.projectId]?.project.name}"</span>?
            </p>
            <p className="mt-2 text-sm text-red-500 font-medium bg-red-50 p-3 rounded-xl border border-red-100">
              This action is permanent and will remove all tasks and data associated with this project.
            </p>
          </div>
        </ModalLayout>
      )}
      {modal.type === "create_project" && (
        <ModalLayout
          title="Create New Project"
          onCancel={() => setModal({ type: "none" })}
          onConfirm={() => {
            if (!projectDraft.name.trim()) return;
            createProject(projectDraft);
            setModal({ type: "none" });
          }}
          confirmLabel="Create Project"
        >
          <div className="grid gap-6">
            <label className="grid gap-1.5 focus-within:text-blue-600 transition-colors">
              <FieldLabel>Project Name</FieldLabel>
              <input 
                className="input-premium" 
                placeholder="E.g. Website Redesign 2024"
                value={projectDraft.name} 
                onChange={(e) => setProjectDraft((d) => ({ ...d, name: e.target.value }))} 
              />
            </label>
            <label className="grid gap-1.5">
              <FieldLabel>Start Date</FieldLabel>
              <CustomDatePicker
                value={projectDraft.start_date}
                onChange={(val) => setProjectDraft({ ...projectDraft, start_date: val })}
              />
            </label>
            <label className="grid gap-1.5 focus-within:text-blue-600 transition-colors">
              <FieldLabel>Project Lead</FieldLabel>
              <UserSelect 
                users={systemUsers}
                value={projectDraft.lead || ""}
                onChange={(val) => setProjectDraft((d) => ({ ...d, lead: val }))}
              />
            </label>
            <label className="grid gap-1.5 focus-within:text-blue-600 transition-colors">
              <FieldLabel>Description (Optional)</FieldLabel>
              <textarea
                className="scroll-premium min-h-32 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                placeholder="Describe your project goals..."
                value={projectDraft.description}
                onChange={(e) => setProjectDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </label>
          </div>
        </ModalLayout>
      )}

      {modal.type === "add_task" && activeSheet && (
        <ModalLayout
          title={modal.parentTaskId ? "New Subtask" : "New Main Task"}
          onCancel={() => setModal({ type: "none" })}
          onConfirm={() => {
            if (!taskDraft.title.trim()) return;
            addTask(taskDraft, modal.parentTaskId);
            setModal({ type: "none" });
          }}
          confirmLabel="Add Task"
        >
          <TaskForm 
            value={taskDraft} 
            onChange={setTaskDraft} 
            availableTasks={activeSheet ? Object.values(activeSheet.tasksById) : []}
            systemUsers={systemUsers}
          />
        </ModalLayout>
      )}

      {modal.type === "edit_task" && editingTask && (
        <ModalLayout
          title="Edit Task Details"
          onCancel={() => setModal({ type: "none" })}
          onConfirm={() => {
            editTask(editingTask.id, taskDraft);
            setModal({ type: "none" });
          }}
          confirmLabel="Save Changes"
        >
          <>
            <TaskForm 
              value={taskDraft} 
              onChange={setTaskDraft} 
              disableDates={editingTask.is_summary} 
              disableProgress={editingTask.is_summary}
              availableTasks={activeSheet ? Object.values(activeSheet.tasksById) : []}
              currentTaskId={editingTask.id}
              systemUsers={systemUsers}
            />
            {editingTask.is_summary && (
              <div className="mt-4 flex gap-3 rounded-xl bg-amber-50 p-4 text-amber-700">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-xs font-medium leading-relaxed">
                  Note: Summary dates and progress are auto-calculated from child tasks.
                </p>
              </div>
            )}
          </>
        </ModalLayout>
      )}

       {modal.type === "delete_task" && deletingTask && (
        <ModalLayout
          title="Confirm Deletion"
          onCancel={() => setModal({ type: "none" })}
          onConfirm={() => {
            deleteTaskWithSubtree(deletingTask.id);
            setModal({ type: "none" });
          }}
          confirmLabel="Delete Task"
          confirmVariant="danger"
        >
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <div>
              <p className="text-slate-900 font-medium text-lg">Are you sure?</p>
              <p className="mt-2 text-slate-500 max-w-sm">
                {deletingTask.is_summary && activeSheet
                  ? `This will permanently delete "${deletingTask.title}" and its ${activeSheet.childrenByParentId[deletingTask.id]?.length ?? 0} subtasks.`
                  : `This will permanently delete the task "${deletingTask.title}". This action cannot be undone.`}
              </p>
            </div>
          </div>
        </ModalLayout>
      )}

      {modal.type === "baselines" && activeSheet && (
        <ModalLayout 
          title="Project Snapshots" 
          onCancel={() => setModal({ type: "none" })}
          onConfirm={() => setModal({ type: "none" })}
          confirmLabel="Close"
        >
          <div className="space-y-6 p-1">
            {userRole !== 'viewer' && (
              <div className="flex items-end gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex-1 space-y-2">
                  <FieldLabel>Capture New Snapshot</FieldLabel>
                  <input 
                    type="text"
                    placeholder="e.g. Pre-Q2 Replan"
                    className="input-premium w-full"
                    value={baselineLabel}
                    onChange={(e) => setBaselineLabel(e.target.value)}
                  />
                </div>
                <button 
                  className="btn-premium btn-primary h-11 px-6 text-xs font-medium"
                  onClick={() => {
                    if (!baselineLabel.trim()) return;
                    createBaseline(baselineLabel.trim());
                    setBaselineLabel("");
                  }}
                >
                  Save
                </button>
              </div>
            )}

            <div className="space-y-3">
              <FieldLabel>Manage Baselines</FieldLabel>
              <div className="grid gap-2">
                <button 
                  onClick={() => setSelectedBaselineIndex(null)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    selectedBaselineIndex === null 
                      ? "bg-blue-50 border-blue-200 ring-1 ring-blue-100" 
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedBaselineIndex === null ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                      {selectedBaselineIndex === null && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-medium text-slate-700">Live Project</div>
                      <div className="text-xs text-slate-400">Current actual schedule</div>
                    </div>
                  </div>
                </button>

                {(activeSheet.project.baselines || []).map((bl, idx) => (
                  <div key={idx} className="group relative">
                    <button 
                      onClick={() => setSelectedBaselineIndex(idx)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                        selectedBaselineIndex === idx 
                          ? "bg-blue-50 border-blue-200 ring-1 ring-blue-100" 
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedBaselineIndex === idx ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                          {selectedBaselineIndex === idx && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="text-left">
                          <div className="text-xs font-medium text-slate-700">{bl.label}</div>
                          <div className="text-xs text-slate-400">{new Date(bl.timestamp).toLocaleString()}</div>
                        </div>
                      </div>
                    </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteBaseline(idx); if(selectedBaselineIndex === idx) setSelectedBaselineIndex(null); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all border-none bg-transparent"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalLayout>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around z-[200] px-4 shadow-lg shadow-black/5">
        {[
          { id: "G", label: "Gantt", onClick: () => setActiveTab("Gantt"), icon: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />, active: activeTab === "Gantt" },
          { id: "S", label: "Progress", onClick: () => setActiveTab("Progress"), icon: <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />, active: activeTab === "Progress" },
          { id: "T", label: "Timeline", onClick: () => setActiveTab("Timeline"), icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />, active: activeTab === "Timeline" },
          { id: "P", label: "Projects", onClick: () => setModal({ type: "project_list" }), icon: <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />, active: false },
          { id: "+", label: "New", onClick: () => setModal({ type: "create_project" }), icon: <path d="M12 4v16m8-8H4" />, active: false }
        ].map((item) => (
          <button 
            key={item.id} 
            onClick={item.onClick}
            className={`flex flex-col items-center gap-1 transition-all ${
              item.active ? "text-blue-600" : "text-slate-400"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {item.icon}
            </svg>
            <span className="text-xs font-medium uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Mobile Actions Drawer */}
      {isMobileMenuOpen && activeSheet && (
        <div className="fixed inset-0 z-[300] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute inset-x-0 inset-y-0 w-full bg-white shadow-2xl animate-enter flex flex-col overflow-hidden">
            <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white z-10">
              <h3 className="text-lg font-medium text-slate-800">Actions</h3>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scroll-premium p-6">
              <div className="space-y-3">
                <FieldLabel>Project Details</FieldLabel>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-slate-700">Project Stats</div>
                    <div className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{activeSheet.project.progress ?? 0}% Complete</div>
                  </div>
                    <button 
                      onClick={() => {
                        setProjectDraft({
                          name: activeSheet.project.name,
                          start_date: activeSheet.project.start_date,
                          description: activeSheet.project.description,
                          lead: activeSheet.project.lead
                        });
                        setModal({ type: "edit_project", projectId: activeSheet.project.id });
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full btn-premium btn-secondary h-10 text-xs gap-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      Rename & Edit Details
                    </button>
                </div>
              </div>

              <div className="space-y-3">
                <FieldLabel>Manage Project</FieldLabel>
                <CustomSelect
                  options={projectOptions}
                  value={activeSheet.project.id}
                  onChange={(val) => { navigate(`/project/${val}`); setIsMobileMenuOpen(false); }}
                />
                  <button 
                    className="w-full btn-premium btn-danger mt-2"
                    onClick={() => { setModal({ type: "delete_project", projectId: activeSheet.project.id }); setIsMobileMenuOpen(false); }}
                  >
                    Delete Project
                  </button>
              </div>

              <div className="space-y-3">
                <FieldLabel>Timeline View</FieldLabel>
                <CustomSelect
                  options={zoomOptions}
                  value={zoom}
                  onChange={(val) => setZoom(val as any)}
                />
                <button 
                  onClick={() => setShowCriticalPath(!showCriticalPath)}
                  className={`w-full btn-premium h-11 px-3 text-xs font-medium uppercase tracking-wider flex items-center justify-between transition-all ${
                    showCriticalPath ? "bg-red-50 text-red-600 border-red-200" : "btn-secondary"
                  }`}
                >
                  <span>Critical Path</span>
                  <div className={`w-2 h-2 rounded-full ${showCriticalPath ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} />
                </button>
                <button 
                  className="w-full btn-premium btn-secondary h-11 text-xs font-medium flex items-center gap-2"
                  onClick={() => { setModal({ type: "baselines" }); setIsMobileMenuOpen(false); }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Snapshots
                </button>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100">
                <FieldLabel>Collaboration</FieldLabel>
                <div className="flex flex-col gap-2">
                  <button 
                    className="w-full btn-premium btn-secondary text-xs"
                    onClick={() => { navigator.clipboard.writeText(window.location.href).catch(()=>{}); showToast('Link Copied!', 'Project share link copied to clipboard.', 'success'); setIsMobileMenuOpen(false); }}
                  >
                    Share Project
                  </button>
                  <button 
                    className="w-full btn-premium btn-primary text-xs"
                    onClick={() => {
                      if (!activeSheet) return;
                      const data = JSON.stringify(activeSheet, null, 2);
                      const blob = new Blob([data], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${activeSheet.project.name.replace(/\s+/g, '_')}_Gantt.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      showToast('Export Successful', `"${activeSheet.project.name}" exported as JSON.`, 'success');
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    Export Data
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 pb-20">
                <div className="flex items-center gap-3">
                  <UserAvatar email={activeSheet.project.lead || undefined} size="lg" className="border border-blue-100" />
                  <div>
                    <div className="text-xs uppercase font-medium text-slate-400">Project Lead</div>
                    <div className="text-sm font-medium text-slate-800">
                      {(() => {
                        const email = activeSheet.project.lead;
                        if (!email) return "Unassigned";
                        const user = systemUsers.find(u => u.email === email);
                        if (user?.first_name || user?.last_name) {
                          const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                          return full.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                        }
                        return email;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Dialogs ── */}
      <Toast
        isOpen={!!toast}
        title={toast?.title ?? ''}
        message={toast?.message}
        variant={toast?.variant ?? 'info'}
        onClose={() => setToast(null)}
      />
      <ConfirmDialog
        isOpen={!!confirmState}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        onConfirm={() => { confirmState?.onConfirm(); setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
