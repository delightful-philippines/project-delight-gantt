import { createPortal } from 'react-dom';
import { useEffect } from 'react';

// ── Types ──────────────────────────────────────────────────────

export type DialogVariant = 'danger' | 'warning' | 'success' | 'info';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface ToastProps {
  isOpen: boolean;
  title: string;
  message?: string;
  variant?: DialogVariant;
  onClose: () => void;
}

// ── Icon helper ────────────────────────────────────────────────

function DialogIcon({ variant }: { variant: DialogVariant }) {
  const cfg: Record<DialogVariant, { bg: string; color: string; path: string }> = {
    danger: {
      bg: 'bg-red-50',
      color: 'text-red-600',
      path: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    },
    warning: {
      bg: 'bg-amber-50',
      color: 'text-amber-600',
      path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    },
    success: {
      bg: 'bg-emerald-50',
      color: 'text-emerald-600',
      path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    info: {
      bg: 'bg-blue-50',
      color: 'text-blue-600',
      path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
  };
  const { bg, color, path } = cfg[variant];
  return (
    <div className={`h-12 w-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
      <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
      </svg>
    </div>
  );
}

// ── ConfirmDialog ──────────────────────────────────────────────

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const confirmColors: Record<DialogVariant, string> = {
    danger:  'bg-red-600 hover:bg-red-700 focus:ring-red-500/20',
    warning: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500/20',
    success: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/20',
    info:    'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/20',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl animate-enter overflow-hidden">
        <div className="p-6">
          <div className="flex gap-4">
            <DialogIcon variant={variant} />
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-medium text-slate-900 tracking-tight mb-1">{title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-xl hover:bg-slate-50 transition-all active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 text-white font-medium text-xs rounded-xl transition-all active:scale-95 focus:ring-4 ${confirmColors[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Toast (corner notification) ─────────────────────────────

export function Toast({
  isOpen,
  title,
  message,
  variant = 'info',
  onClose,
}: ToastProps) {
  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const accentColors: Record<DialogVariant, { bar: string; icon: string; title: string }> = {
    danger:  { bar: 'bg-red-500',     icon: 'text-red-500',     title: 'text-slate-800' },
    warning: { bar: 'bg-amber-400',   icon: 'text-amber-500',   title: 'text-slate-800' },
    success: { bar: 'bg-emerald-500', icon: 'text-emerald-500', title: 'text-slate-800' },
    info:    { bar: 'bg-blue-500',    icon: 'text-blue-500',    title: 'text-slate-800' },
  };

  const iconPaths: Record<DialogVariant, string> = {
    danger:  'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    info:    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  };

  const { bar, icon, title: titleColor } = accentColors[variant];

  return createPortal(
    <div
      className="fixed bottom-6 right-6 z-[99999] w-full max-w-sm animate-enter"
      role="alert"
    >
      <div className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden flex">
        {/* Accent bar */}
        <div className={`w-1 shrink-0 ${bar}`} />
        <div className="flex-1 p-4 flex items-start gap-3">
          {/* Icon */}
          <svg className={`w-5 h-5 shrink-0 mt-0.5 ${icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPaths[variant]} />
          </svg>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium tracking-tight ${titleColor}`}>{title}</p>
            {message && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{message}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
