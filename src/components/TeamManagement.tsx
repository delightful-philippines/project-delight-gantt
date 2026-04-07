import React, { useEffect, useState } from 'react';
import { api, DBUser } from '../lib/api';
import { useGanttStore } from '../store/useGanttStore';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from './ui/DashboardShell';
import { CustomSelect } from './ui/CustomSelect';
import { UserAvatar } from './ui/UserAvatar';
import { EmployeeSelect } from './ui/EmployeeSelect';
import { ConfirmDialog, Toast } from './ui/Dialog';


export function TeamManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<DBUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [toast, setToast] = useState<{ title: string; message?: string; variant?: 'success'|'danger'|'info'|'warning' } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<{ email: string } | null>(null);
  const { userRole, syncError } = useGanttStore(s => ({
    userRole: s.userRole,
    syncError: s.syncError
  }));

  const roleOptions = [
    { value: 'editor', label: 'Editor' },
    { value: 'super_admin', label: 'Super Admin' }
  ];

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'super_admin').length,
    editors: users.filter(u => u.role === 'editor').length,
    others: users.filter(u => u.role !== 'editor' && u.role !== 'super_admin').length,
  };

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

  if (userRole !== 'super_admin') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-8">
        <div className="text-center space-y-4 animate-enter">
          <div className="h-16 w-16 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mx-auto border border-red-100">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-xl font-medium text-slate-900">Access Denied</h2>
          <p className="text-slate-500 text-sm max-w-sm mx-auto font-medium leading-relaxed">You do not have the required permissions to access this page.</p>
          <button onClick={() => navigate("/")} className="inline-flex h-10 items-center px-8 bg-blue-600 text-white font-medium text-xs rounded-lg hover:bg-blue-700 transition-all active:scale-95">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <>
    <DashboardShell 
      title="Environment Access" 
      activeTab="team"
      noPadding={true}
    >
      <div className="flex flex-col h-full bg-white animate-fade-in overflow-hidden relative">
        {/* Subtle Background Pattern (Synced with Login) */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.01]">
          <div className="absolute inset-0 flex justify-around">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-full w-px bg-slate-900" />
            ))}
          </div>
        </div>

        <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] divide-x divide-slate-100 overflow-hidden">
          {/* Main List Area */}
          <div className="flex flex-col overflow-hidden bg-white">
            <div className="h-16 px-8 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]" />
                <div className="flex flex-col">
                  <h3 className="text-xs font-medium text-slate-900 uppercase tracking-[0.15em] leading-none mb-1">Organization Directory</h3>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">{filteredUsers.length} active identities synchronized</p>
                </div>
              </div>
              
              <div className="relative group w-80">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                  type="text" 
                  placeholder="Filter by email identifier..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50/50 border border-slate-100 rounded-xl text-sm font-medium placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto scroll-premium px-4 py-4">
              {isLoadingUsers ? (
                <div className="h-full flex flex-col items-center justify-center gap-6 text-slate-300">
                  <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium uppercase tracking-[0.4em] animate-pulse">Establishing Connection...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-200">
                  <svg className="w-20 h-20 mb-6 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  <span className="text-xs font-medium uppercase tracking-[0.2em]">No active directory matches</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map(u => (
                    <div key={u.email} className="flex items-center justify-between px-6 py-5 bg-white hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-2xl transition-all group relative overflow-hidden">
                      {/* Hover Indicator */}
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 scale-y-0 group-hover:scale-y-100 transition-transform duration-300" />

                      <div className="flex items-center gap-5 min-w-0">
                        <UserAvatar email={u.email} size="lg" className="shrink-0 border-2 border-white ring-1 ring-slate-200 shadow-sm" />
                        <div className="min-w-0 leading-tight">
                          <p className="text-sm font-medium text-slate-900 truncate tracking-tight mb-1">{u.email}</p>
                          <div className="flex items-center gap-3">
                             <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium uppercase tracking-widest leading-none border shadow-sm ${
                               u.role === 'super_admin' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                               u.role === 'editor' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                               'bg-slate-50 text-slate-600 border-slate-100'
                             }`}>
                               {u.role.replace('_', ' ')}
                             </span>
                             <span className="h-1 w-1 rounded-full bg-slate-300" />
                             <span className="text-xs text-slate-400 font-medium uppercase tracking-widest italic opacity-60">
                               {u.email.split('@')[0]}
                             </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="w-48">
                          <CustomSelect 
                            options={roleOptions}
                            value={u.role}
                            onChange={async (newRole) => {
                              try {
                                await api.users.upsert(u.email, newRole);
                                fetchUsers();
                              } catch (err) {
                                setToast({ title: 'Update Failed', message: 'Could not update role. Please try again.', variant: 'danger' });
                              }
                            }}
                            className="h-9"
                          />
                        </div>
                        <button 
                          onClick={() => setConfirmRevoke({ email: u.email })}
                          className="h-10 w-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all active:scale-95 group/delete"
                          title="Revoke Permission"
                        >
                          <svg className="w-5 h-5 group-hover/delete:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="bg-slate-50/40 flex flex-col overflow-y-auto scroll-premium">
            <div className="p-10 border-b border-slate-100 relative overflow-hidden group">
              {/* Subtle accent glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[40px] rounded-full pointer-events-none" />
              
              <div className="flex items-center gap-3 mb-8 relative z-10">
                 <div className="h-6 w-1 bg-blue-600 rounded-full" />
                 <div className="flex flex-col">
                   <h3 className="text-xs font-medium text-slate-900 uppercase tracking-[0.2em] leading-none mb-1">Access Provision</h3>
                   <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Enroll new corporate identity</p>
                 </div>
              </div>
              
              <form 
                className="space-y-6 relative z-10" 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const email = inviteEmail.toLowerCase().trim();
                  if (!email) {
                    setToast({ title: 'Input Required', message: 'Select a valid employee identifier from the directory.', variant: 'warning' });
                    return;
                  }
                  try {
                    await api.users.invite(email, inviteRole);
                    setToast({ title: 'Provisioned', message: `Full system access granted to ${email}.`, variant: 'success' });
                    fetchUsers();
                    setInviteEmail('');
                  } catch (err) {
                    setToast({ title: 'Protocol Error', message: 'The security handshake failed. Verify SMTP configuration.', variant: 'danger' });
                  }
                }}
              >
                <div className="space-y-2.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-widest px-1 blur-[0.2px]">Identity Search</label>
                  <EmployeeSelect 
                    value={inviteEmail} 
                    onChange={setInviteEmail} 
                    placeholder="Search master directory..." 
                    className="w-full"
                  />
                </div>
                <div className="space-y-2.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-widest px-1 blur-[0.2px]">Permission Tier</label>
                  <CustomSelect 
                    options={roleOptions}
                    value={inviteRole}
                    onChange={setInviteRole}
                    className="h-12"
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full py-4 bg-slate-900 text-white font-medium text-xs uppercase tracking-[0.25em] rounded-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-slate-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                  Grant Access
                </button>
              </form>
            </div>

            <div className="p-10 border-b border-slate-100">
               <h4 className="text-xs font-medium text-slate-400 uppercase tracking-[0.25em] mb-8">Node Distribution</h4>
               <div className="grid grid-cols-2 gap-4">
                 {[
                   { label: 'Total Sync', value: stats.total, color: 'text-slate-900' },
                   { label: 'Admin Root', value: stats.admins, color: 'text-blue-600' },
                   { label: 'Core Editor', value: stats.editors, color: 'text-blue-600' },
                   { label: 'Undefined', value: stats.others, color: 'text-slate-400' }
                 ].map((stat, idx) => (
                   <div key={idx} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                     <p className="text-xs font-medium text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                     <p className={`text-lg font-medium tracking-tighter ${stat.color}`}>{stat.value}</p>
                   </div>
                 ))}
               </div>
            </div>

            <div className="p-10">
               <div className="flex items-center gap-3 mb-10">
                 <div className="h-px flex-1 bg-slate-200/60" />
                 <h4 className="text-xs font-medium text-slate-400 uppercase tracking-[0.25em] px-2">Security Matrix</h4>
                 <div className="h-px flex-1 bg-slate-200/60" />
               </div>

               <div className="space-y-10">
                  {[
                    { 
                      label: 'System Admin', 
                      desc: 'Root-level infrastructure control. Full authority over user provisioning and environment variables.', 
                      color: 'bg-blue-600',
                      shadow: 'shadow-blue-500/20'
                    },
                    { 
                      label: 'Project Editor', 
                      desc: 'Synchronized read/write access to roadmap data, task hierarchies, and baseline management.', 
                      color: 'bg-blue-600', 
                      shadow: 'shadow-blue-500/20' 
                    }
                  ].map((role, idx) => (
                    <div key={idx} className="flex gap-5 group/guide">
                      <div className={`h-3 w-3 rounded-full ${role.color} shrink-0 mt-1 shadow-lg ${role.shadow} border-2 border-white ring-1 ring-slate-100 group-hover/guide:scale-125 transition-transform duration-500`} />
                      <div>
                        <p className="text-xs font-medium text-slate-900 mb-2 uppercase tracking-tight">{role.label}</p>
                        <p className="text-xs text-slate-500 font-medium leading-[1.6] tracking-tight">{role.desc}</p>
                      </div>
                    </div>
                  ))}
               </div>
               
               <div className="mt-16 p-6 bg-blue-600/5 rounded-2xl border border-blue-600/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-5 scale-150">
                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.9L10 1.554l7.834 3.346a1.2 1.2 0 0 1 .832 1.144V14a5 5 0 0 1-5 5H6.334a5 5 0 0 1-5-5V6.044a1.2 1.2 0 0 1 .832-1.144zM10 4.3v11.4a.7.7 0 0 0 .1-.1l4.5-4.5a.7.7 0 0 0-1-1L10 12.6V4.3z" clipRule="evenodd" /></svg>
                  </div>
                  <h5 className="text-xs font-medium text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Compliance Policy
                  </h5>
                  <p className="text-xs text-blue-700/60 font-medium leading-relaxed tracking-tight lowercase">
                    Access modifications are applied instantly to relevant microservices. All interactions are audited for security governance.
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>

      {/* Revoke Access Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmRevoke}
        title="Security Revocation"
        message={`Remove all system credentials for identifier ${confirmRevoke?.email}? This action prevents all future logins for this identity.`}
        confirmLabel="Revoke Access"
        variant="danger"
        onConfirm={async () => {
          try {
            await api.users.delete(confirmRevoke!.email);
            fetchUsers();
            setToast({ title: 'Access Purged', message: `Identity ${confirmRevoke!.email} has been de-provisioned.`, variant: 'success' });
          } catch (err) {
            setToast({ title: 'Protocol Failure', message: 'Failed to purge identity. Connection interrupted.', variant: 'danger' });
          }
          setConfirmRevoke(null);
        }}
        onCancel={() => setConfirmRevoke(null)}
      />

      {/* Toast Notifications */}
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
