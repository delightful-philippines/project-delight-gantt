import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Navigate } from 'react-router-dom';

export function LoginPage() {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 font-sans flex items-center justify-center p-6">
      
      {/* ── Background Patterns (Gantt-inspired) ── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.03]">
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

      <div className="relative z-10 w-full max-w-[1100px] flex flex-col lg:flex-row items-center gap-16 lg:gap-24 animate-enter">
        
        {/* ── Left Side: Brand & Intro ── */}
        <div className="flex-1 text-center lg:text-left max-w-xl">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-sm mb-10">
            <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-[0.2em]">Infrastructure Portal</span>
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-medium tracking-tight text-slate-900 mb-8 leading-[1.05]">
            Unified Project <br />
            <span className="text-blue-600">Delight Gantt.</span>
          </h1>
          
          <p className="text-lg text-slate-500 font-medium leading-relaxed mb-12">
            The standard for high-fidelity roadmap synchronization. Engineered for Brigada Group teams to visualize, track, and execute with precision.
          </p>
          
          <div className="flex items-center justify-center lg:justify-start gap-3 text-slate-400">
             <div className="flex -space-x-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
                    <div className="h-full w-full bg-slate-200" />
                  </div>
                ))}
             </div>
             <span className="text-xs font-medium uppercase tracking-widest ml-1">Trusted by 100+ Leads</span>
          </div>
        </div>

        {/* ── Right Side: Access Card ── */}
        <div className="w-full max-w-md shrink-0">
           <div className="bg-white rounded-2xl p-8 lg:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-200/60 relative group overflow-hidden">
              <div className="mb-12">
                <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center text-blue-600 mb-6 border border-slate-100 transition-transform group-hover:scale-110 duration-500">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <h2 className="text-2xl font-medium text-slate-900 tracking-tight">System Login</h2>
                <p className="text-sm text-slate-400 font-medium tracking-tight">Use your corporate account to verify access.</p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleLogin}
                  className="w-full h-14 flex justify-center items-center gap-4 rounded-xl bg-slate-900 text-white font-medium text-sm uppercase tracking-widest transition-all hover:bg-slate-800 hover:scale-[1.01] active:scale-[0.98] shadow-xl shadow-slate-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                    <path fill="#f25022" d="M22,22H11V11h11V22z"/>
                    <path fill="#7fba00" d="M37,22H26V11h11V22z"/>
                    <path fill="#00a4ef" d="M22,37H11V26h11V37z"/>
                    <path fill="#ffb900" d="M37,37H26V26h11V37z"/>
                  </svg>
                  Login with Microsoft
                </button>
                
                <div className="pt-8 flex flex-col items-center gap-6">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-300 uppercase tracking-widest italic">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    End-to-End Encrypted
                  </div>
                  
                  <div className="h-px w-12 bg-slate-100" />
                  
                  <p className="text-xs font-medium text-slate-400 text-center uppercase tracking-tight leading-loose px-4">
                    Authorized use is subject to data governance policies. <br />
                    BFF Architecture v1.4.2
                  </p>
                </div>
              </div>
           </div>
        </div>
        
      </div>

      {/* ── Footer ── */}
      <div className="absolute bottom-10 left-10 hidden lg:flex items-center gap-3">
         <span className="text-xs font-medium text-slate-300 uppercase tracking-widest border-r border-slate-200 pr-3">Corporate Internal</span>
         <span className="text-xs font-medium text-slate-300 uppercase tracking-widest">© 2026 Brigada Group</span>
      </div>
    </div>
  );

}


