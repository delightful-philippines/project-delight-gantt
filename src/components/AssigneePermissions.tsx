import React, { useEffect, useState } from 'react';
import { api, DBUser, DBEmployee } from '../lib/api';
import { useGanttStore } from '../store/useGanttStore';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from './ui/DashboardShell';
import { UserAvatar } from './ui/UserAvatar';
import { Toast } from './ui/Dialog';

export function AssigneePermissions() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<DBUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'viewers' | 'no_viewers'>('all');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Sharing Panel State
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [foundEmployees, setFoundEmployees] = useState<DBEmployee[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [isSharing, setIsSharing] = useState(false);

  const [toast, setToast] = useState<{ title: string; message?: string; variant?: 'success'|'danger'|'info'|'warning' } | null>(null);
  const { userRole } = useGanttStore(s => ({
    userRole: s.userRole
  }));

  const fetchUsers = async () => {
    if (userRole !== 'super_admin') return;
    setIsLoadingUsers(true);
    try {
      const data = await api.users.list();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [userRole]);

  // Handle Employee Search for Sharing
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (employeeSearch.length >= 2) {
        try {
          const results = await api.employees.search(employeeSearch);
          setFoundEmployees(results.slice(0, 10));
        } catch (e) {
          console.error(e);
        }
      } else {
        setFoundEmployees([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [employeeSearch]);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = 
      filterType === 'all' ? true :
      filterType === 'viewers' ? u.can_view_all_projects :
      !u.can_view_all_projects;
    
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSelectEmail = (email: string) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const handleGrantAccess = async () => {
    if (selectedEmails.size === 0) return;
    setIsSharing(true);
    try {
      for (const email of Array.from(selectedEmails)) {
        await api.users.upsert(email, 'viewer', { can_view_all_projects: true });
      }
      setToast({ 
        title: 'Access Granted', 
        message: `Successfully shared workspace with ${selectedEmails.size} users.`, 
        variant: 'success' 
      });
      setSelectedEmails(new Set());
      setEmployeeSearch('');
      fetchUsers();
    } catch (err) {
      setToast({ title: 'Sharing Failed', message: 'Could not update permissions.', variant: 'danger' });
    } finally {
      setIsSharing(false);
    }
  };

  if (userRole !== 'super_admin') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100/50 p-8">
        <div className="text-center space-y-4 animate-enter">
          <div className="h-16 w-16 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mx-auto border border-red-100">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-xl font-medium text-slate-900">Access Denied</h2>
          <p className="text-slate-500 text-sm max-w-sm mx-auto font-medium leading-relaxed">Only Super Admins can manage assignee permissions.</p>
          <button onClick={() => navigate("/")} className="inline-flex h-10 items-center px-8 bg-blue-600 text-white font-medium text-xs rounded-lg hover:bg-blue-700 transition-all active:scale-95">Go Back</button>
        </div>
      </div>
    );
  }

  const togglePermission = async (user: DBUser) => {
    const nextVal = !user.can_view_all_projects;
    try {
      await api.users.upsert(user.email, user.role, { can_view_all_projects: nextVal });
      setToast({ 
        title: 'Permission Updated', 
        message: `${user.email} can now ${nextVal ? 'view all projects' : 'only view assigned projects'}.`, 
        variant: 'success' 
      });
      fetchUsers();
    } catch (err) {
      setToast({ title: 'Update Failed', message: 'Could not update permissions.', variant: 'danger' });
    }
  };

  return (
    <>
    <DashboardShell 
      title="Assignee Permissions" 
      activeTab="permissions"
      noPadding={true}
    >
      <div className="flex flex-row h-full bg-[#f8fafc] animate-fade-in overflow-hidden relative">
        
        {/* ── Left Sidebar (List of Identities) ── */}
        <div className="w-[60%] flex flex-col border-r border-slate-200/60 bg-white">
          <div className="h-16 px-8 border-b border-slate-200/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-[0.15em]">Directory List</h3>
            </div>
            
            <div className="flex items-center gap-3">
              <select 
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value as any); setCurrentPage(1); }}
                className="text-[10px] font-bold uppercase tracking-widest text-slate-500 outline-none cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-all hover:border-slate-300"
              >
                <option value="all">All Access</option>
                <option value="viewers">View All Enabled</option>
                <option value="no_viewers">Restricted Only</option>
              </select>

              <div className="relative group">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                  type="text" 
                  placeholder="Quick search..." 
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-48 pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scroll-premium p-8">
            <div className="space-y-3">
              {isLoadingUsers ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-300">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Loading...</span>
                </div>
              ) : paginatedUsers.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-300">
                  <p className="text-xs font-medium uppercase tracking-widest">No matching records</p>
                </div>
              ) : paginatedUsers.map(u => (
                <div key={u.email} className="flex items-center justify-between px-4 py-4 bg-white border border-slate-100 rounded-xl transition-all hover:border-blue-200/60 hover:shadow-sm group">
                  <div className="flex items-center gap-4">
                    <UserAvatar email={u.email} size="md" className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 tracking-tight truncate">
                        {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email}
                      </p>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest truncate">{u.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest leading-none">Global View</span>
                      <button 
                        onClick={() => togglePermission(u)}
                        className={`relative h-5 w-9 rounded-full transition-colors flex items-center shrink-0 ${u.can_view_all_projects ? 'bg-blue-600' : 'bg-slate-200'}`}
                      >
                        <div className={`h-3 w-3 rounded-full bg-white transition-transform mx-1 ${u.can_view_all_projects ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-16 px-8 border-t border-slate-200/60 flex items-center justify-between bg-white shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">
               Showing {(currentPage-1)*pageSize + 1}-{Math.min(currentPage*pageSize, filteredUsers.length)} of {filteredUsers.length}
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button 
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Column (Sharing Panel) ── */}
        <div className="flex-1 flex flex-col bg-[#f8fafc]">
          <div className="h-16 px-8 border-b border-slate-200/60 flex items-center shrink-0">
             <h3 className="text-xs font-bold text-slate-900 uppercase tracking-[0.15em] flex items-center gap-2">
               <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
               Share Space Access
             </h3>
          </div>

          <div className="p-8 space-y-8 overflow-y-auto scroll-premium">
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Search Employee</span>
                <div className="relative group">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input 
                    type="text" 
                    placeholder="Find member in directory..." 
                    value={employeeSearch}
                    onChange={e => setEmployeeSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                  />
                </div>
              </div>

              {foundEmployees.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                  {foundEmployees.map(emp => (
                    <button 
                      key={emp.employee_id}
                      onClick={() => toggleSelectEmail(emp.company_email_add)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${selectedEmails.has(emp.company_email_add) ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar email={emp.company_email_add} size="sm" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{emp.first_name} {emp.last_name}</p>
                          <p className="text-[10px] font-medium text-slate-400">{emp.company_email_add}</p>
                        </div>
                      </div>
                      {selectedEmails.has(emp.company_email_add) && (
                        <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {selectedEmails.size > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap gap-2">
                    {Array.from(selectedEmails).map(email => (
                      <div key={email} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold">
                        {email}
                        <button onClick={() => toggleSelectEmail(email)} className="hover:text-indigo-900"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                    ))}
                  </div>
                  <button 
                    disabled={isSharing}
                    onClick={handleGrantAccess}
                    className="w-full h-11 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSharing ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Grant Global Access'}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shared Viewers</span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                   {users.filter(u => u.can_view_all_projects).length} Global Identities
                </span>
              </div>
              <div className="space-y-2">
                 {users.filter(u => u.can_view_all_projects).slice(0, 15).map((u: DBUser) => (
                   <div key={u.email} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl group hover:border-indigo-200 transition-colors">
                     <div className="flex items-center gap-3">
                       <UserAvatar email={u.email} size="sm" />
                       <div className="min-w-0">
                         <p className="text-[11px] font-bold text-slate-800 truncate">{u.first_name} {u.last_name}</p>
                         <p className="text-[9px] font-medium text-slate-400 truncate">{u.email}</p>
                       </div>
                     </div>
                     <button 
                        onClick={() => togglePermission(u)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all"
                        title="Revoke Global Access"
                      >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                   </div>
                 ))}
                  {users.filter(u => u.can_view_all_projects).length === 0 && (
                    <div className="py-8 text-center bg-white border border-dashed border-slate-200 rounded-xl">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">No shared viewers</p>
                    </div>
                  )}
                  {users.filter(u => u.can_view_all_projects).length > 15 && (
                    <p className="text-[10px] text-center text-slate-400 font-medium pt-2">Use sidebar to see all identities</p>
                  )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </DashboardShell>

    <Toast
      isOpen={!!toast}
      title={toast?.title ?? ''}
      message={toast?.message}
      variant={toast?.variant ?? 'info'}
      onClose={() => setToast(null)}
    />
    </>
  );
}
