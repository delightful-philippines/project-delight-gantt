import React, { useEffect, useMemo, useState } from 'react';
import { useGanttStore } from '../store/useGanttStore';
import { DashboardShell } from './ui/DashboardShell';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CustomSelect } from './ui/CustomSelect';
import { api, DBEmployee, DBUser } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#a3e635', '#ec4899'];

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const normalized = raw.length === 3
    ? raw.split('').map(ch => ch + ch).join('')
    : raw;
  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// â”€â”€ Custom SVG radial ring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RadialRing({ value, size = 140, trackW = 9, color = '#3b82f6', id }: {
  value: number; size?: number; trackW?: number; color?: string; id: string;
}) {
  const r = (size - trackW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, value)) / 100);
  const c = size / 2;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} overflow="visible">
      <circle cx={c} cy={c} r={r} fill="none" stroke="#f1f5f9" strokeWidth={trackW} />
      {value > 0 && (
        <circle
          cx={c} cy={c} r={r} fill="none"
          stroke={color} strokeWidth={trackW}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

// â”€â”€ Mini ring for team members â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MiniRing({ value, size = 34, color }: { value: number; size?: number; color: string }) {
  const t = 3;
  const r = (size - t * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, value)) / 100);
  const c = size / 2;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#f1f5f9" strokeWidth={t} />
      {value > 0 && (
        <circle cx={c} cy={c} r={r} fill="none" stroke={color}
          strokeWidth={t} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      )}
    </svg>
  );
}

// â”€â”€ Chart tooltip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 shadow-2xl">
      {label && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: p.stroke }} />
          <span className="text-xs font-semibold text-white">{p.value} {p.name}</span>
        </div>
      ))}
    </div>
  );
}

// â”€â”€ Stat tile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const normalized = values.length > 1 ? values : [0, 0];
  const width = 120;
  const height = 34;
  const padding = 3;
  const max = Math.max(...normalized, 1);
  const min = Math.min(...normalized, 0);
  const range = Math.max(1, max - min);
  const step = width / Math.max(1, normalized.length - 1);
  const points = normalized.map((value, index) => {
    const x = index * step;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${width} ${height - padding} L 0 ${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-28 shrink-0 overflow-visible" aria-hidden="true">
      <path d={areaPath} fill={hexToRgba(color, 0.12)} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r="1.8" fill={color} />
      ))}
    </svg>
  );
}

function StatTile({ label, value, sub, barColor, barFill, chip, sparkValues }: {
  label: string;
  value: string | number;
  sub: string;
  barColor: string;
  barFill: number;
  chip?: string;
  sparkValues: number[];
}) {
  return (
    <div className="h-full rounded-2xl bg-white px-6 py-5 transition-all duration-300 hover:-translate-y-0.5">
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</p>
          <div className="h-9 w-28 shrink-0 flex items-center justify-end">
            <MiniSparkline values={sparkValues} color={barColor} />
          </div>
        </div>
        <p className="text-4xl font-semibold tabular-nums text-slate-900 leading-none">{value}</p>
        <div className="flex items-center justify-between gap-4 mt-1">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, barFill))}%`, background: barColor }}
              />
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none">{sub}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatLeadLabel(lead?: string | null): string {
  const raw = (lead || '').trim();
  if (!raw || raw.toLowerCase() === 'unassigned') return 'Unassigned';
  if (raw.includes('@')) {
    return raw
      .split('@')[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function toTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatLeadFromEmail(email: string): string {
  const local = email.split('@')[0] || email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function makeDirectoryUsers(employee: DBEmployee): DBUser[] {
  const base: Omit<DBUser, 'email'> = {
    role: 'viewer',
    first_name: employee.first_name,
    last_name: employee.last_name,
    employee_id: employee.employee_id,
    company_email_add: employee.company_email_add,
    personal_email_add: employee.personal_email_add,
    position: employee.position,
    department: employee.department,
    business_unit: employee.business_unit ?? null,
    created_at: '',
    updated_at: '',
    can_view_all_projects: false,
  };

  const emails = [employee.company_email_add, employee.personal_email_add]
    .map(v => v?.toLowerCase().trim())
    .filter((v): v is string => !!v);

  return [
    { ...base, email: `id:${employee.employee_id}` },
    ...emails.map(email => ({ ...base, email })),
  ];
}

function pickName(user?: DBUser | null): string {
  if (!user) return '';
  if (user.first_name || user.last_name) {
    return toTitleCase(`${user.first_name || ''} ${user.last_name || ''}`.trim());
  }
  return '';
}

export function AnalyticsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const projectsById = useGanttStore(s => s.projectsById);
  const userRole = useGanttStore(s => s.userRole);
  const sheets = useMemo(() => Object.values(projectsById), [projectsById]);
  const [employeeInfo, setEmployeeInfo] = useState<DBEmployee | null>(null);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'progress'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [projectPage, setProjectPage] = useState(1);
  const projectPageSize = 6;

  const allTasks = useMemo(() =>
    sheets.flatMap(s => Object.values(s.tasksById).filter(t => !t.is_summary)),
    [sheets]);

  const totalProjects = sheets.length;
  const totalTasks    = allTasks.length;
  const doneTasks     = allTasks.filter(t => t.progress === 100).length;
  const inProgress    = allTasks.filter(t => t.progress > 0 && t.progress < 100).length;
  const avgCompletion = sheets.length
    ? Math.round(sheets.reduce((a, s) => a + s.project.progress, 0) / sheets.length)
    : 0;
  const activeLeadUsers = new Set(
    sheets
      .map(s => (s.project.lead || '').trim().toLowerCase())
      .filter(lead => lead && lead !== 'unassigned')
  ).size;
  const projectsWithLead = sheets.filter(s => (s.project.lead || '').trim() && (s.project.lead || '').trim().toLowerCase() !== 'unassigned').length;

  const mergeUsers = (prev: DBUser[], incoming: DBUser[]) => {
    const pick = <T,>(nextVal: T | null | undefined, prevVal: T | null | undefined) =>
      nextVal !== null && nextVal !== undefined && nextVal !== '' ? nextVal : prevVal;

    const map = new Map<string, DBUser>();
    prev.forEach(u => map.set(u.email.toLowerCase().trim(), u));
    incoming.forEach(u => {
      const key = u.email.toLowerCase().trim();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, u);
        return;
      }

      map.set(key, {
        ...existing,
        ...u,
        first_name: pick(u.first_name, existing.first_name),
        last_name: pick(u.last_name, existing.last_name),
        employee_id: pick(u.employee_id, existing.employee_id),
        company_email_add: pick(u.company_email_add, existing.company_email_add),
        personal_email_add: pick(u.personal_email_add, existing.personal_email_add),
        position: pick(u.position, existing.position),
        department: pick(u.department, existing.department),
        business_unit: pick(u.business_unit, existing.business_unit),
      });
    });
    return Array.from(map.values());
  };

  const loadEmployeeDirectory = async () => {
    try {
      const employees = await api.employees.search('');
      const mapped = employees.flatMap(makeDirectoryUsers);
      setUsers(prev => mergeUsers(prev, mapped));
    } catch (err) {
      console.error('Failed to load employee directory:', err);
    }
  };

  const hydrateLeadsFromBackend = async () => {
    try {
      const leads = Array.from(new Set(
        sheets
          .map(s => (s.project.lead || '').trim())
          .filter(Boolean)
      ));

      if (!leads.length) return;

      const employees = await Promise.all(leads.map(async lead => {
        const lower = lead.toLowerCase();
        const idMatch = lower.match(/^id:(\d+)$/) || lower.match(/^(\d+)$/);
        if (idMatch) {
          const rows = await api.employees.getById(Number(idMatch[1])).catch(() => [] as DBEmployee[]);
          return rows[0] || null;
        }

        if (lead.includes('@')) {
          const target = lead.toLowerCase().trim();
          const rows = await api.employees.search(target).catch(() => [] as DBEmployee[]);
          return rows.find(e =>
            [e.company_email_add, e.personal_email_add]
              .some(v => (v || '').toLowerCase().trim() === target)
          ) || null;
        }

        return null;
      }));

      const mapped = employees.filter((e): e is DBEmployee => !!e).flatMap(makeDirectoryUsers);
      if (mapped.length) {
        setUsers(prev => mergeUsers(prev, mapped));
      }
    } catch (err) {
      console.error('Failed to hydrate lead directory:', err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadEmployeeDirectory();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!sheets.length) return;
    hydrateLeadsFromBackend();
  }, [isAuthenticated, sheets]);

  useEffect(() => {
    if (userRole !== 'super_admin') return;
    api.users.list()
      .then(data => setUsers(prev => mergeUsers(prev, data)))
      .catch(err => console.error('Failed to fetch users list:', err));
  }, [userRole]);

  function resolveLeadName(lead?: string | null): string {
    const raw = (lead || '').trim();
    if (!raw) return 'Unassigned';

    const leadEmail = raw.toLowerCase().trim();
    const direct = users.find(u => u.email.toLowerCase().trim() === leadEmail);
    const directName = pickName(direct);
    if (directName) return directName;

    if (raw.includes('@')) {
      const local = raw.split('@')[0].toLowerCase().trim();
      const alias = users.find(u => u.email.toLowerCase().trim().split('@')[0] === local);
      const aliasName = pickName(alias);
      if (aliasName) return aliasName;
      return formatLeadFromEmail(raw);
    }

    return toTitleCase(formatLeadLabel(raw));
  }

  const now = Date.now();
  const onTrack = sheets.filter(s => {
    if (s.project.progress === 100) return false;
    const start = new Date(s.project.start_date).getTime();
    const end   = new Date(s.project.end_date).getTime();
    if (now < start) return false;
    const elapsed = end > start ? Math.min(100, ((now - start) / (end - start)) * 100) : 100;
    return s.project.progress >= elapsed - 10;
  }).length;

  const projectRows = useMemo(() =>
    sheets.map((s) => ({
      name:     s.project.name,
      lead:     resolveLeadName(s.project.lead),
      progress: s.project.progress,
      total:    Object.values(s.tasksById).filter(t => !t.is_summary).length,
      done:     Object.values(s.tasksById).filter(t => !t.is_summary && t.progress === 100).length,
    })).sort((a, b) => b.progress - a.progress),
    [sheets, users]);

  const teamRows = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    allTasks.forEach(t => {
      if (!t.assignee) return;
      const name = t.assignee.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      if (!map[name]) map[name] = { total: 0, done: 0 };
      map[name].total++;
      if (t.progress === 100) map[name].done++;
    });
    return Object.entries(map)
      .map(([name, d], i) => ({ name, ...d, rate: Math.round((d.done / d.total) * 100), color: COLORS[i % COLORS.length] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [allTasks]);

  const trend = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    allTasks.forEach(t => {
      if (!t.end_date) return;
      const d = new Date(t.end_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = { done: 0, total: 0 };
      map[key].total++;
      if (t.progress === 100) map[key].done++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-9)
      .map(([key, d]) => {
        const [y, m] = key.split('-');
        return { label: new Date(+y, +m - 1).toLocaleDateString('en-US', { month: 'short' }), ...d };
      });
  }, [allTasks]);

  const buRows = useMemo(() => {
    const map: Record<string, { n: number; sum: number }> = {};
    sheets.forEach(s => {
      const bu = s.project.business_unit || 'General';
      if (!map[bu]) map[bu] = { n: 0, sum: 0 };
      map[bu].n++;
      map[bu].sum += s.project.progress;
    });
    return Object.entries(map)
      .map(([bu, d], i) => ({ bu, n: d.n, avg: Math.round(d.sum / d.n), color: COLORS[i % COLORS.length] }))
      .sort((a, b) => b.avg - a.avg);
  }, [sheets]);

  const projectLeadLoad = useMemo(() => {
    const counts = new Map<string, number>();
    sheets.forEach(s => {
      const lead = (s.project.lead || '').trim().toLowerCase();
      if (!lead || lead === 'unassigned') return;
      counts.set(lead, (counts.get(lead) || 0) + 1);
    });
    return Array.from(counts.values()).sort((a, b) => b - a).slice(0, 8);
  }, [sheets]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.employees.search('')
      .then((employees) => setUsers(employees.flatMap(makeDirectoryUsers)))
      .catch((err) => console.error('Failed to load employee directory:', err));
  }, [isAuthenticated]);

  const taskVolumeSpark = useMemo(() => projectRows.slice(0, 8).map(p => p.total), [projectRows]);
  const completionSpark = useMemo(() => (trend.length ? trend.map(t => t.done) : [doneTasks]), [trend, doneTasks]);
  const projectProgressSpark = useMemo(() => projectRows.slice(0, 8).map(p => p.progress), [projectRows]);
  const behindSpark = useMemo(() => sheets.slice(0, 8).map(s => Math.max(0, 100 - (s.project.progress ?? 0))), [sheets]);

  const filteredProjectRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rows = term
      ? projectRows.filter(p =>
          p.name.toLowerCase().includes(term) ||
          String(p.progress).includes(term) ||
          `${p.done}/${p.total}`.includes(term)
        )
      : projectRows;

    return [...rows].sort((a, b) => {
      const aValue = sortBy === 'name' ? a.name.toLowerCase() : a.progress;
      const bValue = sortBy === 'name' ? b.name.toLowerCase() : b.progress;
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [projectRows, searchTerm, sortBy, sortOrder]);

  useEffect(() => {
    setProjectPage(1);
  }, [searchTerm, sortBy, sortOrder]);

  const totalProjectPages = Math.max(1, Math.ceil(filteredProjectRows.length / projectPageSize));
  const currentProjectPage = Math.min(projectPage, totalProjectPages);
  const paginatedProjectRows = useMemo(() => {
    const start = (currentProjectPage - 1) * projectPageSize;
    return filteredProjectRows.slice(start, start + projectPageSize);
  }, [currentProjectPage, filteredProjectRows]);

  const filteredTeamRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return teamRows;
    return teamRows.filter(t =>
      t.name.toLowerCase().includes(term) ||
      t.total.toString().includes(term) ||
      t.rate.toString().includes(term)
    );
  }, [teamRows, searchTerm]);

  const filteredBuRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return buRows;
    return buRows.filter(bu =>
      bu.bu.toLowerCase().includes(term) ||
      bu.n.toString().includes(term) ||
      bu.avg.toString().includes(term)
    );
  }, [buRows, searchTerm]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.employees.me().then(setEmployeeInfo).catch(console.error);
  }, [isAuthenticated]);

  const pageTitle = employeeInfo?.business_unit?.trim()
    ? `Workspace Dashboard — ${employeeInfo.business_unit.trim()}`
    : sheets[0]?.project.business_unit
      ? `Workspace Dashboard — ${sheets[0].project.business_unit}`
      : 'Workspace Dashboard';

  const actions = (
    <div className="flex items-center gap-2">
      <div className="relative hidden md:block">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input
          type="text"
          placeholder="Search analytics..."
          className="w-48 lg:w-56 pl-9 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:w-64 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <CustomSelect
        options={[
          { value: 'name', label: 'Name' },
          { value: 'progress', label: 'Progress' }
        ]}
        value={sortBy}
        onChange={val => setSortBy(val as any)}
        className="w-32 hidden sm:block"
      />

      <button
        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        className="h-9 w-9 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center flex-shrink-0"
        title={`Order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
      >
        <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
      </button>

      <button
        onClick={() => navigate('/')}
        className="flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap flex-shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
        <span className="hidden sm:inline">New Project</span>
        <span className="sm:hidden">New</span>
      </button>
    </div>
  );

  return (
    <DashboardShell
      title={pageTitle}
      activeTab="analytics"
      actions={actions}
      onProjectsClick={() => navigate('/?tab=projects')}
      onOverviewClick={() => navigate('/?tab=team')}
    >
      <div className="flex-1 w-full pb-20 relative">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.015]">
          <div className="absolute inset-0 flex justify-around">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="h-full w-px bg-slate-900" />
            ))}
          </div>

          <div className="absolute inset-0 py-20 flex flex-col gap-12">
            <div className="h-8 w-64 bg-slate-900 rounded-full ml-[10%] opacity-40" />
            <div className="h-8 w-96 bg-slate-900 rounded-full ml-[40%] opacity-20" />
            <div className="h-8 w-48 bg-slate-900 rounded-full ml-[25%] opacity-30" />
            <div className="h-8 w-80 bg-slate-900 rounded-full ml-[60%] opacity-15" />
            <div className="h-8 w-125 bg-slate-900 rounded-full ml-[5%] opacity-25" />
            <div className="h-8 w-32 bg-slate-900 rounded-full ml-[80%] opacity-10" />
            <div className="h-8 w-72 bg-slate-900 rounded-full ml-[35%] opacity-35" />
          </div>
        </div>

        <div className="relative z-10 animate-enter space-y-6">
          {sheets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3 rounded-2xl border border-slate-100 bg-white">
              <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">No project data yet</p>
            </div>
          ) : (
            <>
            {/* â”€â”€ Row 1: KPI tiles only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="flex items-start justify-between gap-4 mb-8">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Progress Overview</h2>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                    Graph and Overview of {totalProjects} workspace projects
                  </p>
                </div>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => navigate('/?tab=projects')}
                  className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-slate-400 hover:text-slate-600"
                >
                  Projects
                </button>
                <button
                  onClick={() => navigate('/?tab=team')}
                  className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-slate-400 hover:text-slate-600"
                >
                  Team Overview
                </button>
                <button
                  onClick={() => navigate('/analytics')}
                  className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all bg-white text-blue-600 shadow-sm"
                >
                  Analytics
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-6 lg:gap-8 items-stretch">
              <StatTile
                label="Total Tasks"
                value={totalTasks}
                sub={`${inProgress} in progress`}
                barColor="#64748b"
                barFill={Math.round(inProgress / Math.max(totalTasks, 1) * 100)}
                chip="Workload"
                sparkValues={taskVolumeSpark}
              />
              <StatTile
                label="Completed"
                value={doneTasks}
                sub={`${Math.round(doneTasks / Math.max(totalTasks, 1) * 100)}% of all tasks`}
                barColor="#10b981"
                barFill={Math.round(doneTasks / Math.max(totalTasks, 1) * 100)}
                chip="Done"
                sparkValues={completionSpark}
              />
              <StatTile
                label="Projects"
                value={totalProjects}
                sub={`${onTrack} on schedule`}
                barColor="#3b82f6"
                barFill={Math.round(onTrack / Math.max(totalProjects, 1) * 100)}
                chip="Portfolio"
                sparkValues={projectProgressSpark}
              />
              <StatTile
                label="Behind Schedule"
                value={Math.max(0, totalProjects - onTrack - sheets.filter(s => s.project.progress === 100).length)}
                sub="need attention"
                barColor="#f43f5e"
                barFill={Math.round(Math.max(0, totalProjects - onTrack - sheets.filter(s => s.project.progress === 100).length) / Math.max(totalProjects, 1) * 100)}
                chip="At Risk"
                sparkValues={behindSpark}
              />
              <StatTile
                label="Active Users"
                value={activeLeadUsers}
                sub={`${projectsWithLead} projects led`}
                barColor="#8b5cf6"
                barFill={Math.round(projectsWithLead / Math.max(totalProjects, 1) * 100)}
                chip="Leads"
                sparkValues={projectLeadLoad}
              />
            </div>

            {/* â”€â”€ Row 2: Project progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)] mt-8 px-7 py-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">Project Progress</p>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300">
                    Ranked progress across {totalProjects} workspace projects
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Active progress
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-5">
                {paginatedProjectRows.map((p, i) => (
                  <div
                    key={p.name}
                    className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-100/70 bg-slate-50/30 p-4 sm:grid-cols-[2rem_minmax(0,12rem)_minmax(0,1fr)_3.5rem] sm:items-center sm:gap-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
                  >
                    <span className="text-[10px] font-semibold text-slate-300 tabular-nums leading-none sm:text-left">
                      {String((currentProjectPage - 1) * projectPageSize + i + 1).padStart(2, '0')}
                    </span>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate leading-none">{p.name}</p>
                      <p className="text-[9px] font-medium text-slate-400 mt-1 truncate">{p.lead}</p>
                      <p className="text-[9px] font-medium text-slate-400 mt-1">{p.done}/{p.total} tasks done</p>
                    </div>

                    <div className="relative h-1 bg-slate-100 rounded-full overflow-hidden min-w-0">
                      <div
                        className={`absolute inset-y-0 left-0 h-full rounded-full transition-all duration-1000 ease-out ${p.progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                        style={{ width: `${p.progress}%` }}
                      />
                      {p.progress > 0 && p.progress < 100 && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm"
                          style={{ left: `${p.progress}%`, background: p.progress === 100 ? '#10b981' : '#2563eb' }}
                        />
                      )}
                    </div>

                    <span
                      className="text-sm font-semibold tabular-nums text-left leading-none sm:text-right"
                      style={{ color: p.progress === 100 ? '#10b981' : '#2563eb' }}
                    >
                      {p.progress}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Showing {filteredProjectRows.length === 0 ? 0 : (currentProjectPage - 1) * projectPageSize + 1}-{Math.min(currentProjectPage * projectPageSize, filteredProjectRows.length)} of {filteredProjectRows.length}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProjectPage(p => Math.max(1, p - 1))}
                    disabled={currentProjectPage === 1}
                    className="hidden sm:inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Prev
                  </button>

                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: totalProjectPages }, (_, idx) => idx + 1)
                      .slice(Math.max(0, currentProjectPage - 3), Math.min(totalProjectPages, currentProjectPage + 2))
                      .map(page => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setProjectPage(page)}
                          className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-3 text-xs font-semibold transition-all ${
                            page === currentProjectPage
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setProjectPage(p => Math.min(totalProjectPages, p + 1))}
                    disabled={currentProjectPage === totalProjectPages}
                    className="hidden sm:inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>

                  <div className="sm:hidden w-28">
                    <CustomSelect
                      value={String(currentProjectPage)}
                      onChange={(val) => setProjectPage(parseInt(val, 10) || 1)}
                      options={Array.from({ length: totalProjectPages }, (_, idx) => {
                        const page = idx + 1;
                        return { value: String(page), label: `Page ${page}` };
                      })}
                      className="w-28"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* â”€â”€ Row 3: Team + Trend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Team workload */}
              <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)] px-7 py-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch">
                  <div className="xl:w-48 shrink-0 rounded-2xl bg-slate-50/80 border border-slate-100 px-5 py-5 flex flex-col items-center justify-center gap-2.5">
                    <div className="relative">
                      <RadialRing value={avgCompletion} size={110} trackW={8} color="#3b82f6" id="team-workload" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-semibold tabular-nums text-slate-900 leading-none">{avgCompletion}</span>
                        <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 mt-0.5">% avg</span>
                      </div>
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Completion</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400 mb-5">Team Workload</p>
                    {filteredTeamRows.length === 0 ? (
                      <p className="text-xs text-slate-300 uppercase tracking-widest font-medium">No assignees found</p>
                    ) : (
                      <div className="space-y-4">
                        {filteredTeamRows.map(m => (
                          <div key={m.name} className="flex items-center gap-3.5">
                            <div className="relative shrink-0">
                              <MiniRing value={m.rate} size={34} color={m.color} />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[8px] font-semibold text-slate-700 leading-none">{m.rate}</span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate leading-none">{m.name}</p>
                              <div className="mt-1.5 h-px w-full bg-slate-100 rounded-full relative overflow-hidden">
                                <div
                                  className="absolute inset-y-0 left-0 h-full rounded-full"
                                  style={{ width: `${m.rate}%`, background: m.color, opacity: 0.7 }}
                                />
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs font-semibold text-slate-800 tabular-nums leading-none">{m.total}</p>
                              <p className="text-[9px] font-medium text-slate-400 mt-0.5">tasks</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Trend */}
              <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)] px-7 py-6">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
                  <div className="xl:w-64 shrink-0 rounded-2xl bg-slate-50/80 border border-slate-100 px-5 py-5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400 mb-4">Business Units</p>
                    {filteredBuRows.length > 0 ? (
                      <div className="space-y-4">
                        {filteredBuRows.map(d => (
                          <div key={d.bu} className="space-y-2">
                            <div className="flex items-end justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-700 truncate leading-none">{d.bu}</p>
                                <p className="text-[9px] font-medium text-slate-400 mt-0.5">
                                  {d.n} project{d.n !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <span className="text-2xl font-semibold tabular-nums text-slate-900 leading-none shrink-0">
                                {d.avg}<span className="text-xs font-medium text-slate-400">%</span>
                              </span>
                            </div>
                            <div className="h-px w-full bg-slate-100 relative rounded-full overflow-hidden">
                              <div
                                className="absolute inset-y-0 left-0 h-full rounded-full"
                                style={{ width: `${d.avg}%`, background: d.color }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-300 uppercase tracking-widest font-medium">No business unit data</p>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400 mb-5">Completion Trend</p>
                    {trend.length < 2 ? (
                      <p className="text-xs text-slate-300 uppercase tracking-widest font-medium">Not enough monthly data</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={trend} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                          <defs>
                            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.12} />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="label"
                            axisLine={false} tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Inter', fontWeight: 700 }}
                          />
                          <Tooltip content={<ChartTip />} />
                          <Area
                            type="monotone" dataKey="done" name="completed"
                            stroke="#3b82f6" strokeWidth={2}
                            fill="url(#trendGrad)" dot={false}
                            activeDot={{ fill: '#3b82f6', r: 3.5, strokeWidth: 2, stroke: '#fff' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>

            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
