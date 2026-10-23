'use client';

// A small toast stack for the Explorer: what a change did, a refusal said in words, and Undo for a delete
// (liveplanner's toasts: bottom of the page, newest last, a few seconds each).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type Tone = 'info' | 'success' | 'error';
type Toast = { id: number; tone: Tone; text: string; action?: { label: string; run: () => void } };

export type ToastApi = {
  show: (text: string, options?: { tone?: Tone; action?: Toast['action'] }) => void;
  error: (text: string) => void;
};

const TOAST_MS = 5000;
const MAX_TOASTS = 3;

const NOOP: ToastApi = { show: () => {}, error: () => {} };
const ToastContext = createContext<ToastApi>(NOOP);

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback<ToastApi['show']>(
    (text, options = {}) => {
      const id = next.current++;
      setToasts((all) => [
        ...all.slice(-(MAX_TOASTS - 1)),
        { id, tone: options.tone ?? 'info', text, action: options.action },
      ]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const all = timers.current;
    return () => {
      for (const timer of all.values()) clearTimeout(timer);
      all.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ show, error: (text) => show(text, { tone: 'error' }) }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex max-w-md animate-fade-in items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${
                t.tone === 'error'
                  ? 'bg-rose-500'
                  : t.tone === 'success'
                    ? 'bg-emerald-500'
                    : 'bg-brand-500'
              }`}
            />
            <span className="min-w-0 flex-1">{t.text}</span>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded px-1.5 py-0.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
