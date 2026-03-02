/**
 * SupabaseStatus.tsx
 * ─────────────────────────────────────────────────────────────
 * Controlled overlay panel for Supabase connection diagnostics.
 * Hidden by default; toggled via the "Connected" button in the
 * sheet tab bar.
 * ─────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Status = 'checking' | 'connected' | 'error';

interface CheckResult {
  status: Status;
  latencyMs: number | null;
  projectUrl: string;
  error: string | null;
  envReady: {
    url: boolean;
    anonKey: boolean;
  };
}

interface SupabaseStatusProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseStatus: React.FC<SupabaseStatusProps> = ({ isOpen, onClose }) => {
  const [result, setResult] = useState<CheckResult>({
    status: 'checking',
    latencyMs: null,
    projectUrl: import.meta.env.VITE_SUPABASE_URL ?? '(not set)',
    error: null,
    envReady: {
      url: !!import.meta.env.VITE_SUPABASE_URL,
      anonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      // ⚠️  Server-only vars (SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_*) are
      // intentionally NOT checked here — they are never sent to the browser.
    },
  });

  // Run the ping once on mount (regardless of open state, so status is ready)
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const t0 = performance.now();
      try {
        const { error } = await supabase.auth.getSession();
        const latencyMs = Math.round(performance.now() - t0);
        if (cancelled) return;
        if (error) {
          setResult(prev => ({ ...prev, status: 'error', latencyMs, error: error.message }));
        } else {
          setResult(prev => ({ ...prev, status: 'connected', latencyMs, error: null }));
        }
      } catch (err: unknown) {
        const latencyMs = Math.round(performance.now() - t0);
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setResult(prev => ({ ...prev, status: 'error', latencyMs, error: msg }));
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const statusColor = {
    checking : '#a78bfa',
    connected : '#34d399',
    error     : '#f87171',
  }[result.status];

  const statusIcon = {
    checking : '⏳',
    connected : '✅',
    error     : '❌',
  }[result.status];

  const EnvRow = ({ label, ok }: { label: string; ok: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: '#94a3b8', fontSize: 12, fontFamily: 'monospace' }}>{label}</span>
      <span style={{ fontSize: 12, color: ok ? '#34d399' : '#f87171', fontWeight: 600 }}>
        {ok ? '✓ set' : '✗ missing'}
      </span>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(2px)',
          animation: 'sb-fade-in 0.15s ease',
        }}
      />

      {/* Panel */}
      <div
        id="supabase-status-panel"
        style={{
          position: 'fixed',
          bottom: 56,           // sits just above the 40px sheet tab bar + 16px gap
          right: 20,
          zIndex: 9999,
          width: 340,
          borderRadius: 16,
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${statusColor}44`,
          boxShadow: `0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px ${statusColor}22`,
          padding: '20px 22px',
          fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
          color: '#e2e8f0',
          animation: 'sb-slide-up 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 10px ${statusColor}`,
            animation: result.status === 'checking' ? 'sb-pulse 1.2s ease-in-out infinite' : 'none',
            flexShrink: 0,
          }} />
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.3, flex: 1 }}>
            Supabase Connection
          </span>
          <span style={{ fontSize: 16 }}>{statusIcon}</span>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              marginLeft: 4,
              width: 26, height: 26,
              borderRadius: 8,
              border: 'none',
              background: 'rgba(255,255,255,0.06)',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Status badge */}
        <div style={{
          background: `${statusColor}18`,
          border: `1px solid ${statusColor}33`,
          borderRadius: 10,
          padding: '9px 14px',
          marginBottom: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: statusColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9 }}>
            {result.status === 'checking' && 'Checking…'}
            {result.status === 'connected' && 'Connected'}
            {result.status === 'error' && 'Connection Failed'}
          </span>
          {result.latencyMs !== null && (
            <span style={{ fontSize: 12, color: '#64748b' }}>{result.latencyMs} ms</span>
          )}
        </div>

        {/* Project URL */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 600 }}>
            Project URL
          </div>
          <div style={{
            fontSize: 12, color: '#94a3b8', wordBreak: 'break-all',
            background: '#0f172a', padding: '7px 12px', borderRadius: 8,
            border: '1px solid #1e293b', fontFamily: 'monospace',
          }}>
            {result.projectUrl}
          </div>
        </div>

        {/* Error detail */}
        {result.error && (
          <div style={{
            background: '#3b0000', border: '1px solid #7f1d1d',
            borderRadius: 8, padding: '8px 12px', marginBottom: 14,
            fontSize: 12, color: '#fca5a5', wordBreak: 'break-word',
          }}>
            {result.error}
          </div>
        )}

        {/* Env vars */}
        <div style={{
          background: '#0f172a', border: '1px solid #1e293b',
          borderRadius: 10, padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 7,
        }}>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 600 }}>
            Environment Variables
          </div>
          <EnvRow label="VITE_SUPABASE_URL"      ok={result.envReady.url} />
          <EnvRow label="VITE_SUPABASE_ANON_KEY" ok={result.envReady.anonKey} />
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4, fontStyle: 'italic' }}>
            Server-only keys (SERVICE_ROLE_KEY, DB credentials) are hidden from the browser.
          </div>
        </div>

        {/* Animations */}
        <style>{`
          @keyframes sb-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%       { opacity: 0.35; transform: scale(0.7); }
          }
          @keyframes sb-slide-up {
            from { opacity: 0; transform: translateY(12px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes sb-fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Standalone trigger button — placed in the sheet tab bar
// ─────────────────────────────────────────────────────────────
interface DbStatusButtonProps {
  status: 'checking' | 'connected' | 'error';
  onClick: () => void;
}

export const DbStatusButton: React.FC<DbStatusButtonProps> = ({ status, onClick }) => {
  const dotColor = {
    checking : '#a78bfa',
    connected : '#34d399',
    error     : '#f87171',
  }[status];

  const label = {
    checking : 'Connecting…',
    connected : 'Connected',
    error     : 'DB Error',
  }[status];

  return (
    <button
      id="db-status-btn"
      onClick={onClick}
      title="Supabase connection details"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 10px',
        height: '100%',
        background: 'none',
        border: 'none',
        borderLeft: '1px solid #f1f5f9',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.5,
        color: '#64748b',
        textTransform: 'uppercase',
        transition: 'color 0.15s, background 0.15s',
        flexShrink: 0,
        fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.color = '#3b82f6';
        (e.currentTarget as HTMLButtonElement).style.background = '#f8faff';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
        (e.currentTarget as HTMLButtonElement).style.background = 'none';
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: dotColor,
        boxShadow: `0 0 6px ${dotColor}`,
        flexShrink: 0,
        animation: status === 'checking' ? 'sb-pulse 1.2s ease-in-out infinite' : 'none',
      }} />
      {label}
      <style>{`
        @keyframes sb-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(0.7); }
        }
      `}</style>
    </button>
  );
};

export default SupabaseStatus;
