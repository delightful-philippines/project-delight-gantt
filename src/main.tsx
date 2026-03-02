import React, { useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useGanttStore } from "./store/useGanttStore";
import "./styles.css";

// ── Lazy Components ───────────────────────────────────────────
const LoginPage = lazy(() => import("./components/LoginPage").then(m => ({ default: m.LoginPage })));
const ProjectsPage = lazy(() => import("./components/ProjectsPage").then(m => ({ default: m.ProjectsPage })));
const GanttApp = lazy(() => import("./components/GanttApp").then(m => ({ default: m.GanttApp })));

// ── Shared Loading Fallback ───────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-slate-500 font-medium">Loading...</p>
    </div>
  </div>
);


// ── App Wrapper ─────────────────────────────────────────────
function App() {
  const { checkSession, isLoading, isAuthenticated } = useAuthStore();
  const initializeGantt = useGanttStore(s => s.initialize);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (isAuthenticated) {
      initializeGantt();
    }
  }, [isAuthenticated, initializeGantt]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return <AppRouter />;
}

// ── Protected Route Wrapper ──────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// ── Application Router ───────────────────────────────────────
function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected Routes */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/project/:projectId" 
            element={
              <ProtectedRoute>
                <GanttApp />
              </ProtectedRoute>
            } 
          />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}


const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
