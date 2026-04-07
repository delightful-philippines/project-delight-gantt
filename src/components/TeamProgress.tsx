import React, { useMemo } from 'react';
import { ProjectSheet } from '../types';
import { DBUser } from '../lib/api';
import { UserAvatar } from './ui/UserAvatar';

interface Props {
  sheet: ProjectSheet;
  systemUsers: DBUser[];
}

export function TeamProgress({ sheet, systemUsers }: Props) {
  const stats = useMemo(() => {
    const tasks = Object.values(sheet.tasksById).filter(t => !t.is_summary);
    const byAssignee: Record<string, { 
      totalProgress: number,
      completed: number,
      pending: number,
      tasksCount: number
    }> = {};

    tasks.forEach(task => {
      const assignee = task.assignee?.trim();
      if (!assignee || assignee.toLowerCase() === 'unassigned') return;
      if (!byAssignee[assignee]) {
        byAssignee[assignee] = { totalProgress: 0, completed: 0, pending: 0, tasksCount: 0 };
      }
      const progress = Number(task.progress) || 0;
      byAssignee[assignee].tasksCount++;
      byAssignee[assignee].totalProgress += progress;
      if (progress === 100) byAssignee[assignee].completed++;
      else byAssignee[assignee].pending++;
    });

    return Object.entries(byAssignee).map(([email, data]) => {
      const user = systemUsers.find(u => u.email === email);
      const rawName = user ? `${user.first_name} ${user.last_name || ''}`.trim() : email;
      const name = rawName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      const avgProgress = Math.round(data.totalProgress / data.tasksCount);
      return { email, name, avgProgress, total: data.tasksCount, completed: data.completed, pending: data.pending };
    })
    .filter(s => s.avgProgress > 0)
    .sort((a, b) => b.avgProgress - a.avgProgress);
  }, [sheet, systemUsers]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 scroll-premium">
      <div className="w-full p-8 space-y-8 animate-fade-in">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Assignee Progress</h2>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Performance Metrics for {sheet.project.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {stats.length === 0 ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
               <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
               <p className="text-sm font-medium uppercase tracking-[0.2em]">No assignee data available</p>
            </div>
          ) : stats.map(s => (
            <div key={s.email} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group overflow-hidden relative">
              {/* Decorative background glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[40px] rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors" />
              
              <div className="flex items-center gap-4 mb-5 relative">
                <UserAvatar
                  email={s.email}
                  name={s.name}
                  size="lg"
                  activeColor="#3b82f6"
                  className="ring-4 ring-slate-50 border border-slate-100"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-slate-900 truncate tracking-tight">{s.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">{s.total} Tasks Tracked</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 relative">
                <div className="flex items-end justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Average Completion</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{s.avgProgress}</span>
                    <span className="text-xs font-bold text-slate-400 font-mono">%</span>
                  </div>
                </div>

                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${s.avgProgress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                    style={{ width: `${s.avgProgress}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/30 group-hover:bg-emerald-50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-[0.15em] leading-none">Completed</p>
                    </div>
                    <p className="text-lg font-bold text-emerald-700 tracking-tight">{s.completed}</p>
                  </div>
                  <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100/30 group-hover:bg-amber-50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <p className="text-[9px] font-bold text-amber-600 uppercase tracking-[0.15em] leading-none">In Progress</p>
                    </div>
                    <p className="text-lg font-bold text-amber-700 tracking-tight">{s.pending}</p>
                  </div>
                </div>
              </div>

              {/* Hover detail info */}
              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                 <div className="flex flex-col capitalize">
                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Recent Activity</span>
                    <span className="text-xs font-bold text-slate-500">
                       {s.completed === s.total ? 'Mission Critical Done' : 'Actively Synchronizing'}
                    </span>
                 </div>
                 <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
