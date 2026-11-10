import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const STYLE: Record<ToastKind, { icon: typeof Info; iconClass: string; ring: string; prefix: string }> = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-600',
    ring: 'ring-emerald-600/15',
    prefix: 'Success: ',
  },
  error: {
    icon: AlertTriangle,
    iconClass: 'text-rose-600',
    ring: 'ring-rose-600/15',
    prefix: 'Error: ',
  },
  info: {
    icon: Info,
    iconClass: 'text-cyan-700',
    ring: 'ring-cyan-600/15',
    prefix: 'Notice: ',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++nextId.current;
    setItems((current) => [...current, { id, kind, message }].slice(-3));
    timers.current.push(window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000));
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message),
  }), [push]);

  useEffect(() => () => {
    for (const timer of timers.current) window.clearTimeout(timer);
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:items-end">
        {items.map((item) => {
          const style = STYLE[item.kind];
          const Icon = style.icon;
          return (
            <div
              key={item.id}
              role={item.kind === 'error' ? 'alert' : 'status'}
              className={`ds-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-[0_18px_40px_-20px_rgba(7,20,39,0.55)] ring-1 ring-inset ${style.ring}`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} aria-hidden />
              <p className="min-w-0 flex-1 leading-snug">
                <span className="sr-only">{style.prefix}</span>
                {item.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
