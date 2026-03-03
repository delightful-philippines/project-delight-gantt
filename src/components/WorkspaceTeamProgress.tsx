import React, { useMemo } from 'react';
import { ProjectSheet } from '../types';
import { DBUser } from '../lib/api';
import { UserAvatar } from './ui/UserAvatar';

interface Props {
  projects: ProjectSheet[];
  systemUsers: DBUser[];
}

export function WorkspaceTeamProgress({ projects, systemUsers }: Props) {
  const stats = useMemo(() => {
    const byAssignee: Record<string, { 
      totalProgress: number,
      completed: number,
      pending: number,
      tasksCount: number,
      projects: Set<string>
    }> = {};

    projects.forEach(sheet => {
      const tasks = Object.values(sheet.tasksById).filter(t => !t.is_summary);
      tasks.forEach(task => {
        const assignee = task.assignee || 'unassigned';
        if (!byAssignee[assignee]) {
          byAssignee[assignee] = { 
            totalProgress: 0, 
            completed: 0, 
            pending: 0, 
            tasksCount: 0,
            projects: new Set()
          };
        }
        byAssignee[assignee].tasksCount++;
        byAssignee[assignee].totalProgress += task.progress;
        byAssignee[assignee].projects.add(sheet.project.id);
        if (task.progress === 100) byAssignee[assignee].completed++;
        else byAssignee[assignee].pending++;
      });
    });

    return Object.entries(byAssignee).map(([email, data]) => {
      const user = systemUsers.find(u => u.email === email);
      const name = user ? `${user.first_name} ${user.last_name || ''}`.trim() : email;
      const avgProgress = data.tasksCount > 0 ? Math.round(data.totalProgress / data.tasksCount) : 0;
      
      return {
        email,
        name: email === 'unassigned' ? 'Unassigned' : name,
        avgProgress,
        total: data.tasksCount,
        completed: data.completed,
        pending: data.pending,
        projectCount: data.projects.size
      };
    }).sort((a, b) => b.avgProgress - a.avgProgress);
  }, [projects, systemUsers]);

  return (
    <div className="w-full space-y-8 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Global Team Performance</h2>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Aggregated progress across {projects.length} workspace projects</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {stats.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm animate-enter">
             <div className="h-16 w-16 mb-4 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
             </div>
             <p className="text-xs font-bold uppercase tracking-[0.2em]">No cross-project data synchronized</p>
          </div>
        ) : stats.map(s => (
          <div key={s.email} className="card-premium cursor-pointer p-5 transition-all group overflow-hidden relative border-none!">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[40px] rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-colors" />
            
            <div className="flex items-center gap-4 mb-5 relative">
              <UserAvatar 
                email={s.email !== 'unassigned' ? s.email : undefined} 
                name={s.name}
                size="lg" 
                activeColor="#6366f1"
                className="ring-4 ring-slate-50 border border-slate-100" 
              />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate tracking-tight">{s.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{s.projectCount} Projects Joined</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 relative">
              <div className="flex items-end justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cross-App Avg.</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{s.avgProgress}</span>
                  <span className="text-xs font-bold text-slate-400 font-mono">%</span>
                </div>
              </div>
              
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inset">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full transition-all duration-1000 ease-out shadow-lg"
                  style={{ width: `${s.avgProgress}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/30 group-hover:bg-indigo-50 transition-colors text-center">
                   <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-[0.1em] mb-1">Total Tasks</p>
                   <p className="text-lg font-bold text-indigo-700 tracking-tight">{s.total}</p>
                </div>
                <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/30 group-hover:bg-emerald-50 transition-colors text-center">
                   <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-[0.1em] mb-1">Done</p>
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
               <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
