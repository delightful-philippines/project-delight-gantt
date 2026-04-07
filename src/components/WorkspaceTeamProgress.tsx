import React, { useEffect, useRef, useState, useMemo } from 'react';
import api from '../lib/api';
import { ProjectSheet } from '../types';
import { DBUser } from '../lib/api';
import { UserAvatar } from './ui/UserAvatar';

interface Props {
  projects: ProjectSheet[];
  systemUsers: DBUser[];
}

export function WorkspaceTeamProgress({ projects, systemUsers }: Props) {
  const invalidText = (value?: string | null) => {
    const v = (value || '').trim().toLowerCase();
    return !v || ['null', 'undefined', 'none', 'n/a', 'na'].includes(v);
  };

  const normalize = (value?: string | null) => (value || '').toLowerCase().trim();
  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const usersByEmail = useMemo(() => {
    const map = new Map<string, DBUser>();
    systemUsers.forEach(u => {
      [u.email, u.company_email_add, u.personal_email_add].forEach(e => {
        const key = normalize(e);
        if (key) map.set(key, u);
      });
    });
    return map;
  }, [systemUsers]);

  const usersByEmployeeId = useMemo(() => {
    const map = new Map<number, DBUser>();
    systemUsers.forEach(u => {
      if (u.employee_id != null) map.set(u.employee_id, u);
    });
    return map;
  }, [systemUsers]);

  const resolveUserFromLead = (leadRaw: string) => {
    const lead = leadRaw.trim();
    if (!lead) return undefined;

    const idMatch = lead.toLowerCase().match(/^id:(\d+)$/) || lead.match(/^(\d+)$/);
    if (idMatch) {
      return usersByEmployeeId.get(Number(idMatch[1]));
    }

    if (isEmail(lead)) {
      return usersByEmail.get(normalize(lead));
    }
    return undefined;
  };

  const stats = useMemo(() => {
    const byLead: Record<string, {
      totalProjectProgress: number;
      projectCount: number;
      totalTasks: number;
      completedTasks: number;
      pendingTasks: number;
    }> = {};

    projects.forEach(sheet => {
      const lead = sheet.project.lead?.trim();
      if (!lead || lead.toLowerCase() === 'unassigned' || invalidText(lead)) return;

      if (!byLead[lead]) {
        byLead[lead] = { totalProjectProgress: 0, projectCount: 0, totalTasks: 0, completedTasks: 0, pendingTasks: 0 };
      }

      byLead[lead].totalProjectProgress += Number(sheet.project.progress) || 0;
      byLead[lead].projectCount++;

      Object.values(sheet.tasksById).filter(t => !t.is_summary).forEach(task => {
        const p = Number(task.progress) || 0;
        byLead[lead].totalTasks++;
        if (p === 100) byLead[lead].completedTasks++;
        else byLead[lead].pendingTasks++;
      });
    });

    return Object.entries(byLead).map(([lead, data]) => {
      const user = resolveUserFromLead(lead);
      const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
      const name = !invalidText(fullName) ? fullName : 'Unknown Employee';
      const email = normalize(user?.email || user?.company_email_add || user?.personal_email_add || (isEmail(lead) ? lead : ''));
      const avgProgress = data.projectCount > 0 ? Math.round(data.totalProjectProgress / data.projectCount) : 0;

      return {
        key: lead,
        name,
        email,
        unresolvedLead: !user ? lead : '',
        avgProgress,
        total: data.totalTasks,
        completed: data.completedTasks,
        pending: data.pendingTasks,
        projectCount: data.projectCount,
        businessUnit: user?.business_unit?.trim() || 'Not set',
        department: user?.department?.trim() || 'Not set',
        position: user?.position?.trim() || 'Not set',
      };
    })
      .filter(s => s.avgProgress > 0)
      .sort((a, b) => b.avgProgress - a.avgProgress);
  }, [projects, usersByEmail, usersByEmployeeId]);

  // ── PMS state ─────────────────────────────────────────────
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [pmsTarget, setPmsTarget] = useState<{
    key: string; name: string; email: string; employeeId?: number | null;
    position?: string; businessUnit?: string;
  } | null>(null);
  const [pmsYear, setPmsYear] = useState<number>(new Date().getFullYear());
  const [pmsQuarter, setPmsQuarter] = useState<1 | 2 | 3 | 4>(
    Math.ceil((new Date().getMonth() + 1) / 3) as 1 | 2 | 3 | 4
  );
  const [pmsLoading, setPmsLoading] = useState(false);
  const [pmsError, setPmsError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuKey) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuKey(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuKey]);

  const handleGeneratePms = async () => {
    if (!pmsTarget) return;
    setPmsLoading(true);
    setPmsError(null);
    try {
      const blob = await api.ai.generatePms({
        employeeEmail: pmsTarget.email,
        employeeId: pmsTarget.employeeId ?? null,
        employeeName: pmsTarget.name,
        employeePosition: pmsTarget.position ?? null,
        employeeBusinessUnit: pmsTarget.businessUnit ?? null,
        year: pmsYear,
        quarter: pmsQuarter,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = pmsTarget.name.replace(/\s+/g, '');
      a.href = url;
      a.download = `PMS_${pmsYear}_Q${pmsQuarter}_${safeName}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setPmsTarget(null);
    } catch (err: any) {
      setPmsError(err.message || 'Generation failed.');
    } finally {
      setPmsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Global Team Performance</h2>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Aggregated progress across {projects.length} workspace projects</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {stats.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 rounded-3xl border border-dashed border-slate-200 animate-enter">
            <div className="h-16 w-16 mb-4 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em]">No cross-project data synchronized</p>
          </div>
        ) : stats.map(s => (
          <div key={s.key} className="card-premium p-5 transition-all group overflow-hidden relative border-none!">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[40px] rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors" />

            {/* 3-dot menu */}
            <div className="absolute top-3 right-3 z-10" ref={openMenuKey === s.key ? menuRef : undefined}>
              <button
                onClick={(e) => { e.stopPropagation(); setOpenMenuKey(openMenuKey === s.key ? null : s.key); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Options"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                </svg>
              </button>
              {openMenuKey === s.key && (
                <div className="absolute right-0 top-8 w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
                  <button
                    onClick={() => {
                      setOpenMenuKey(null);
                      setPmsError(null);
                      setPmsTarget({
                        key: s.key,
                        name: s.name,
                        email: s.email,
                        employeeId: systemUsers.find(u =>
                          [u.email, u.company_email_add, u.personal_email_add]
                            .some(e => e?.toLowerCase() === s.email?.toLowerCase())
                        )?.employee_id ?? null,
                        position: s.position !== 'Not set' ? s.position : undefined,
                        businessUnit: s.businessUnit !== 'Not set' ? s.businessUnit : undefined,
                      });
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Generate PMS
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mb-5 relative">
              <UserAvatar
                email={s.email || undefined}
                name={s.name}
                size="lg"
                activeColor="#6366f1"
                className="ring-4 ring-slate-50 border border-slate-100"
              />
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-slate-900 truncate tracking-tight">{s.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{s.projectCount} Projects Joined</p>
                </div>
                {s.unresolvedLead && (
                  <p className="text-[10px] text-amber-600 mt-1 truncate">Unresolved lead: {s.unresolvedLead}</p>
                )}
              </div>
            </div>

            <div className="mb-4 space-y-1">
              <p className="text-[10px] text-slate-500 truncate"><span className="font-semibold text-slate-600">BU:</span> {s.businessUnit}</p>
              <p className="text-[10px] text-slate-500 truncate"><span className="font-semibold text-slate-600">Dept:</span> {s.department}</p>
              <p className="text-[10px] text-slate-500 truncate"><span className="font-semibold text-slate-600">Position:</span> {s.position}</p>
            </div>

            <div className="space-y-4 relative">
              <div className="flex items-end justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cross-App Avg.</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{s.avgProgress}</span>
                  <span className="text-xs font-bold text-slate-400 font-mono">%</span>
                </div>
              </div>

              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${s.avgProgress}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/30 group-hover:bg-blue-50 transition-colors text-center">
                  <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-1">Total Tasks</p>
                  <p className="text-lg font-bold text-blue-700 tracking-tight">{s.total}</p>
                </div>
                <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/30 group-hover:bg-emerald-50 transition-colors text-center">
                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Done</p>
                  <p className="text-lg font-bold text-emerald-700 tracking-tight">{s.completed}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest ">Global Integrity</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`h-1 w-1 rounded-full ${s.pending === 0 ? 'bg-emerald-500' : 'bg-blue-400'}`} />
                  <span className="text-[10px] font-bold text-slate-500">
                    {s.pending === 0 ? 'Fully Synchronized' : `${s.pending} active nodes`}
                  </span>
                </div>
              </div>
              <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* PMS Generation Modal */}
      {pmsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-slate-800">Generate PMS Report</h3>
              <button
                onClick={() => { if (!pmsLoading) setPmsTarget(null); }}
                className="h-7 w-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-3 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-500">Employee</p>
              <p className="text-sm font-semibold text-slate-800">{pmsTarget.name}</p>
              {pmsTarget.position && <p className="text-xs text-slate-500">{pmsTarget.position}</p>}
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Performance Year</label>
                <input
                  type="number"
                  value={pmsYear}
                  onChange={e => setPmsYear(Number(e.target.value))}
                  min={2020}
                  max={2099}
                  disabled={pmsLoading}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Quarter</label>
                <div className="grid grid-cols-4 gap-2">
                  {([1, 2, 3, 4] as const).map(q => (
                    <button
                      key={q}
                      onClick={() => setPmsQuarter(q)}
                      disabled={pmsLoading}
                      className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                        pmsQuarter === q
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                      } disabled:opacity-50`}
                    >
                      Q{q}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {['Jan–Mar','Apr–Jun','Jul–Sep','Oct–Dec'][pmsQuarter - 1]}
                </p>
              </div>
            </div>

            {pmsError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-xs text-red-600">{pmsError}</p>
              </div>
            )}

            <button
              onClick={handleGeneratePms}
              disabled={pmsLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {pmsLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Generating...
                </>
              ) : 'Generate & Download'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
