import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProjectDraft } from '../types';
import { api, DBEmployee, DBUser } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { DashboardShell } from './ui/DashboardShell';
import { CustomSelect } from './ui/CustomSelect';
import { UserAvatar } from './ui/UserAvatar';
import { UserSelect } from './ui/UserSelect';
import { useGanttStore } from '../store/useGanttStore';
import { CustomDatePicker } from './ui/CustomDatePicker';
import { ConfirmDialog } from './ui/Dialog';
import { WorkspaceTeamProgress } from './WorkspaceTeamProgress';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuthStore();
  
  const {
    projectsById,
    initialize,
    isLoading,
    isInitialized,
    syncError,
    createProject,
    deleteProject,
    editProject,
    userRole
  } = useGanttStore((s) => ({
    projectsById: s.projectsById,
    initialize: s.initialize,
    isLoading: s.isLoading,
    isInitialized: s.isInitialized,
    syncError: s.syncError,
    createProject: s.createProject,
    deleteProject: s.deleteProject,
    editProject: s.editProject,
    userRole: s.userRole
  }));

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'progress'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [employeeInfo, setEmployeeInfo] = useState<DBEmployee | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'projects' | 'team'>('projects');
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'team') setActiveMainTab('team');
    else if (tab === 'projects') setActiveMainTab('projects');
  }, [searchParams]);

  const handleTabChange = (tab: 'projects' | 'team') => {
    setActiveMainTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (userRole === 'super_admin' || userRole === 'editor') {
      api.employees.search('').then(data => {
        const mappedUsers = data.map((e: any) => ({
          email: e.company_email_add,
          first_name: e.first_name,
          last_name: e.last_name,
          role: 'viewer' as const,
          created_at: '',
          updated_at: ''
        }));
        setUsers(mappedUsers);
      }).catch(console.error);
    }
  }, [userRole]);

  useEffect(() => {
    if (isAuthenticated) {
      api.employees.me().then(setEmployeeInfo).catch(console.error);
    }
  }, [isAuthenticated]);

  const [showModal, setShowModal] = useState<{ type: 'create' | 'edit', projectId?: string } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [draft, setDraft] = useState<ProjectDraft>({
    name: '',
    start_date: new Date().toISOString().slice(0, 10),
    description: '',
    lead: ''
  });

  // Project list is now managed by App.tsx calling initialize()

  const handleSave = () => {
    if (!draft.name.trim()) return;
    if (showModal?.type === 'create') {
      createProject(draft);
    } else if (showModal?.type === 'edit' && showModal.projectId) {
      editProject(showModal.projectId, draft);
    }
    setShowModal(null);
    setDraft({ 
      name: '', 
      start_date: new Date().toISOString().slice(0, 10), 
      description: '',
      lead: ''
    });
  };

  const handleLogout = () => {
    logout();
  };

  const userName = user?.name || 'User';

  const projects = Object.values(projectsById);

  const filteredProjects = projects
    .filter(p => p.project.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                p.project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.project.lead?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      let valA: any, valB: any;
      if (sortBy === 'name') {
        valA = a.project.name.toLowerCase();
        valB = b.project.name.toLowerCase();
      } else if (sortBy === 'date') {
        valA = a.project.start_date;
        valB = b.project.start_date;
      } else {
        valA = a.project.progress || 0;
        valB = b.project.progress || 0;
      }
      
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const actions = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-[280px]">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder="Search projects by name, lead, or description..." 
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <CustomSelect 
          options={[
            { value: 'name', label: 'Sort by Name' },
            { value: 'date', label: 'Sort by Date' },
            { value: 'progress', label: 'Sort by Progress' }
          ]}
          value={sortBy}
          onChange={val => setSortBy(val as any)}
          className="w-44"
        />

        <button 
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
          title={`Order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
        >
          <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
        </button>
      </div>

      <button 
        onClick={() => setShowModal({ type: 'create' })}
        className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-medium text-white transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
        New Project
      </button>

      <div className="h-10 border-l border-slate-200 mx-2 hidden sm:block" />

      <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
        <button 
          onClick={() => handleTabChange('projects')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeMainTab === 'projects' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Projects
        </button>
        <button 
          onClick={() => handleTabChange('team')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeMainTab === 'team' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Team Overview
        </button>
      </div>
    </div>
  );

  const pageTitle = employeeInfo?.business_unit
    ? `Workspace Dashboard — ${employeeInfo.business_unit}`
    : 'Workspace Dashboard';

  return (
    <>
      <DashboardShell 
        title={pageTitle}
        activeTab={activeMainTab === 'projects' ? 'dashboard' : 'overview'}
        actions={actions}
        onOverviewClick={() => handleTabChange('team')}
        onProjectsClick={() => handleTabChange('projects')}
      >
        <div className="flex-1 w-full pb-20 relative">
          {/* ── Background Patterns (Gantt-inspired, synced with Login) ── */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.015]">
            {/* Vertical Grid Lines */}
            <div className="absolute inset-0 flex justify-around">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="h-full w-px bg-slate-900" />
              ))}
            </div>
            
            {/* Faded Horizontal Task Bars */}
            <div className="absolute inset-0 py-20 flex flex-col gap-12">
               <div className="h-8 w-64 bg-slate-900 rounded-full ml-[10%] opacity-40" />
               <div className="h-8 w-96 bg-slate-900 rounded-full ml-[40%] opacity-20" />
               <div className="h-8 w-48 bg-slate-900 rounded-full ml-[25%] opacity-30" />
               <div className="h-8 w-80 bg-slate-900 rounded-full ml-[60%] opacity-15" />
               <div className="h-8 w-[500px] bg-slate-900 rounded-full ml-[5%] opacity-25" />
               <div className="h-8 w-32 bg-slate-900 rounded-full ml-[80%] opacity-10" />
               <div className="h-8 w-72 bg-slate-900 rounded-full ml-[35%] opacity-35" />
            </div>
          </div>
          
          
          <div className="relative z-10">
          {activeMainTab === 'team' ? (
            <WorkspaceTeamProgress projects={projects} systemUsers={users} />
          ) : filteredProjects.length === 0 && !isLoading ? (
            <div className="mt-8 flex flex-col items-center justify-center p-20 bg-white border border-slate-100 rounded-xl animate-enter">
              <div className="h-24 w-24 mb-6 flex items-center justify-center rounded-xl bg-slate-50 text-slate-300">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <h3 className="text-lg font-medium text-slate-800">No Projects Found</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-sm text-center font-medium">Create your first project to start tracking your timeline and team progress.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
              {filteredProjects.map((sheet) => {
                const progress = sheet.project.progress ?? 0;
                return (
                  <div 
                    key={sheet.project.id} 
                    onClick={() => navigate(`/project/${sheet.project.id}`)}
                    className="group card-premium cursor-pointer flex flex-col p-6"
                  >
                    <div className="flex justify-between items-start mb-5">
                      <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-all duration-300">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      </div>
                      
                       <div className="relative" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={(e) => {
                            setActiveMenuId(activeMenuId === sheet.project.id ? null : sheet.project.id);
                          }}
                          className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all ${activeMenuId === sheet.project.id ? 'bg-slate-100 text-blue-600 scale-110' : 'text-slate-300 hover:bg-slate-50 hover:text-slate-600'}`}
                        >
                          <svg className="w-5 h-5 font-medium" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                        </button>

                        {activeMenuId === sheet.project.id && (
                          <>
                            <div className="fixed inset-0 z-[100]" onClick={() => setActiveMenuId(null)} />
                            <div className="absolute right-0 top-full mt-2 z-[110] w-40 bg-white border border-slate-200 rounded-lg py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                              <button 
                                onClick={() => {
                                  setDraft({
                                    name: sheet.project.name,
                                    start_date: sheet.project.start_date,
                                    description: sheet.project.description || '',
                                    lead: sheet.project.lead || ''
                                  });
                                  setShowModal({ type: 'edit', projectId: sheet.project.id });
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 text-left transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                Edit Details
                              </button>
                              { (sheet.project.lead === user?.email || userRole === 'super_admin') && (
                                <>
                                  <div className="h-px bg-slate-100 mx-1 my-1" />
                                  <button 
                                    onClick={() => {
                                      setConfirmDelete({ id: sheet.project.id, name: sheet.project.name });
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50 text-left transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    Delete Project
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-medium tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors duration-300">{sheet.project.name}</h3>
                    <p className="text-xs text-slate-400 mt-1.5 font-medium line-clamp-2 leading-relaxed overflow-hidden" title={sheet.project.description}>
                      {sheet.project.description || "Project goal and objectives not specified."}
                    </p>
                    
                    {/* Progress Section */}
                    <div className="mt-8">
                      <div className="flex justify-between items-center mb-2.5">
                         <span className="text-xs font-medium uppercase tracking-widest text-slate-400">Completion</span>
                         <span className="text-xs font-medium text-slate-800">{progress}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex shrink-0">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ease-out ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3 max-w-[65%]">
                        {editingLeadId === sheet.project.id ? (
                          <UserSelect 
                            users={users}
                            value={sheet.project.lead || ''}
                            onChange={val => {
                              editProject(sheet.project.id, { 
                                name: sheet.project.name,
                                start_date: sheet.project.start_date,
                                lead: val 
                              });
                              setEditingLeadId(null);
                            }}
                            className="w-full text-left"
                            placeholder="Select lead..."
                          />
                        ) : (
                          <div 
                            className="flex items-center gap-2 truncate group/lead p-1 -m-1 rounded-full transition-all" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLeadId(sheet.project.id);
                            }}
                          >
                             <UserAvatar email={sheet.project.lead || undefined} size="sm" />
                             <span className="text-xs font-medium text-slate-600 truncate group-hover/lead:text-blue-600 transition-colors tracking-tight">
                               {(() => {
                                 const leadEmail = sheet.project.lead;
                                 if (!leadEmail) return 'Assign Lead';
                                 const leadUser = users.find(u => u.email === leadEmail);
                                  if (leadUser?.first_name || leadUser?.last_name) {
                                    const full = `${leadUser.first_name || ''} ${leadUser.last_name || ''}`.trim();
                                    return full.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                                  }
                                 return leadEmail;
                               })()}
                             </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                         <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-100 shrink-0">
                           <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                           <span className="text-xs font-medium text-slate-600 tracking-tight">{sheet.project.start_date}</span>
                         </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </DashboardShell>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Project"
        message={`Are you sure you want to permanently delete "${confirmDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Yes, Delete"
        variant="danger"
        onConfirm={() => {
          if (confirmDelete) deleteProject(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900-[0.6] backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-enter border border-slate-200/80">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[17px] font-semibold tracking-tight text-slate-800">
                {showModal.type === 'create' ? 'Create New Project' : 'Edit Project Details'}
              </h3>
              <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600 p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 grid gap-5">
              <label className="grid gap-1.5 focus-within:text-blue-500 transition-colors">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Project Name</span>
                <input 
                  className="input-premium" 
                  value={draft.name} 
                  onChange={e => setDraft({...draft, name: e.target.value})}
                  placeholder="e.g. Q4 Marketing Campaign"
                  autoFocus
                />
              </label>
              
              <div className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Project Lead</span>
                <UserSelect 
                  users={users}
                  value={draft.lead || ''} 
                  onChange={val => setDraft({...draft, lead: val})}
                  placeholder="Select a Lead"
                />
              </div>

              <div className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kickoff Date</span>
                <CustomDatePicker 
                  value={draft.start_date} 
                  onChange={val => setDraft({...draft, start_date: val})}
                />
              </div>

              <label className="grid gap-1.5 focus-within:text-blue-500 transition-colors">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Brief Description <span className="font-normal normal-case text-slate-300">(optional)</span></span>
                <textarea 
                  className="input-premium h-auto py-3 resize-none" 
                  rows={3}
                  value={draft.description} 
                  onChange={e => setDraft({...draft, description: e.target.value})}
                  placeholder="What is the main objective?"
                />
              </label>
            </div>

            <div className="px-6 py-5 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setShowModal(null)}
                className="btn-premium btn-secondary h-10 px-5"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={!draft.name.trim() || !draft.start_date}
                className="btn-premium btn-primary h-10 px-5 disabled:opacity-50"
              >
                {showModal.type === 'create' ? 'Create Project' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
