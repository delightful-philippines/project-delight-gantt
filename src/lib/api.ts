/**
 * src/lib/api.ts
 * ─────────────────────────────────────────────────────────────
 * Typed REST client for the Express backend.
 * Vite proxies /api/* → http://localhost:3001 in dev.
 * ─────────────────────────────────────────────────────────────
 */

const BASE = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const devUserEmail =
    typeof window !== 'undefined' ? window.sessionStorage.getItem('user_email') : null;
  if (!import.meta.env.PROD && devUserEmail) {
    headers['x-user-email'] = devUserEmail;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include', // Send session cookies to backend
    headers: { ...headers, ...(init?.headers || {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

// ── DB row shapes (what the API returns) ─────────────────────

export interface DBUser {
  email: string;
  role: 'super_admin' | 'editor' | 'viewer';
  first_name?: string | null;
  last_name?: string | null;
  employee_id?: number | null;
  company_email_add?: string | null;
  personal_email_add?: string | null;
  position?: string | null;
  department?: string | null;
  business_unit?: string | null;
  can_view_all_projects?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DBEmployee {
  employee_id: number;
  first_name: string;
  last_name: string;
  company_email_add: string | null;
  personal_email_add: string | null;
  position: string;
  department: string;
  business_unit?: string;
  nick_name?: string;
}

export interface DBProject {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  lead: string;
  business_unit: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface DBTask {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  start_date: string;
  end_date: string;
  duration: number;
  bg_color: string;
  text_color: string;
  is_summary: boolean;
  is_milestone: boolean;
  is_critical: boolean;
  level: number;
  sort_order: number;
  progress: number;
  assignee: string;
  dependencies: string[];
}

export interface DBBaseline {
  id: number;
  project_id: string;
  label: string;
  timestamp: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasksById: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any;
}

// ── API client ────────────────────────────────────────────────

export const api = {
  health: () => req<{ status: string }>('/health'),

  users: {
    me: () => req<DBUser>('/users/me'),
    list: () => req<DBUser[]>('/users'),
    upsert: (email: string, role: string, extra?: { can_view_all_projects?: boolean }) =>
      req<DBUser>('/users', { method: 'POST', body: JSON.stringify({ email, role, ...extra }) }),
    invite: (email: string, role: string) =>
      req<{ message: string; user: DBUser }>('/users/invite', { method: 'POST', body: JSON.stringify({ email, role }) }),
    delete: (email: string) =>
      req<void>(`/users/${encodeURIComponent(email)}`, { method: 'DELETE' }),
  },

  employees: {
    me: () =>
      req<DBEmployee | null>('/employees/me'),
    search: (query: string) =>
      req<DBEmployee[]>(`/employees?search=${encodeURIComponent(query)}`),
    getById: (employeeId: number) =>
      req<DBEmployee[]>(`/employees?employee_id=${employeeId}`),
  },

  projects: {
    list: () =>
      req<DBProject[]>('/projects'),

    get: (id: string) =>
      req<DBProject>(`/projects/${id}`),

    create: (data: Omit<DBProject, 'created_at' | 'updated_at' | 'business_unit'>) =>
      req<DBProject>('/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<DBProject>) =>
      req<DBProject>(`/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      req<void>(`/projects/${id}`, { method: 'DELETE' }),
  },

  tasks: {
    list: (projectId: string) =>
      req<DBTask[]>(`/tasks?project_id=${encodeURIComponent(projectId)}`),

    create: (data: DBTask) =>
      req<DBTask>('/tasks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<DBTask>) =>
      req<DBTask>(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      req<void>(`/tasks/${id}`, { method: 'DELETE' }),

    /** Upsert an entire project's task list at once. */
    bulk: (projectId: string, tasks: DBTask[]) =>
      req<{ synced: number }>('/tasks/bulk', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, tasks }),
      }),
  },

  baselines: {
    list: (projectId: string) =>
      req<DBBaseline[]>(`/baselines?project_id=${encodeURIComponent(projectId)}`),

    create: (data: {
      project_id: string;
      label: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tasksById: Record<string, any>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      project: any;
    }) =>
      req<DBBaseline>('/baselines', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    delete: (id: number) =>
      req<void>(`/baselines/${id}`, { method: 'DELETE' }),
  },

  ai: {
    generateUpdate: (data: {
      project: Pick<DBProject, 'name' | 'start_date' | 'id'>;
      currentTasks: any[];
      context: string;
    }) =>
      req<{ operations: any[] }>('/ai/generate_update', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    generatePms: async (data: {
      employeeEmail: string;
      employeeId?: number | null;
      employeeName: string;
      employeePosition?: string | null;
      employeeBusinessUnit?: string | null;
      year: number;
      quarter: 1 | 2 | 3 | 4;
    }): Promise<Blob> => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const devUserEmail =
        typeof window !== 'undefined' ? window.sessionStorage.getItem('user_email') : null;
      if (!import.meta.env.PROD && devUserEmail) headers['x-user-email'] = devUserEmail;

      const res = await fetch(`${BASE}/ai/generate_pms`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      return res.blob();
    },
  },
};

export default api;
