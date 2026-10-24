'use client';

// A small toast stack for the Explorer: what a change did, a refusal said in words, and Undo for a delete
// (liveplanner's toasts: bottom of the page, newest last, a few seconds each). A toast that offers an answer (Undo)
// stays TOAST_ANSWER_MS, long enough to reach for it, and its clock stops while it is hovered or focused.

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
export const TOAST_ANSWER_MS = 10_000;
const MAX_TOASTS = 3;

const NOOP: ToastApi = { show: () => {}, error: () => {} };
const ToastContext = createContext<ToastApi>(NOOP);

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  // Each toast's clock: the timer while it runs, and how long it has left (kept while paused).
  const timers = useRef(
    new Map<number, { timer: ReturnType<typeof setTimeout> | null; left: number; since: number }>(),
  );

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.filter((t) => t.id !== id));
    const clock = timers.current.get(id);
    if (clock?.timer) clearTimeout(clock.timer);
    timers.current.delete(id);
  }, []);

  const run = useCallback(
    (id: number, left: number) => {
      timers.current.set(id, {
        timer: setTimeout(() => dismiss(id), left),
        left,
        since: Date.now(),
      });
    },
    [dismiss],
  );

  // Hovered or focused: the clock stops; it goes on from where it was when they leave.
  const pause = useCallback((id: number) => {
    const clock = timers.current.get(id);
    if (!clock?.timer) return;
    clearTimeout(clock.timer);
    clock.timer = null;
    clock.left = Math.max(0, clock.left - (Date.now() - clock.since));
  }, []);
  const resume = useCallback(
    (id: number) => {
      const clock = timers.current.get(id);
      if (clock && !clock.timer) run(id, clock.left);
    },
    [run],
  );

  const show = useCallback<ToastApi['show']>(
    (text, options = {}) => {
      const id = next.current++;
      setToasts((all) => {
        // The oldest beyond MAX_TOASTS leave with their clocks.
        const kept = all.slice(-(MAX_TOASTS - 1));
        for (const gone of all.slice(0, all.length - kept.length)) {
          const clock = timers.current.get(gone.id);
          if (clock?.timer) clearTimeout(clock.timer);
          timers.current.delete(gone.id);
        }
        return [...kept, { id, tone: options.tone ?? 'info', text, action: options.action }];
      });
      run(id, options.action ? TOAST_ANSWER_MS : TOAST_MS);
    },
    [run],
  );

  useEffect(() => {
    const all = timers.current;
    return () => {
      for (const clock of all.values()) if (clock.timer) clearTimeout(clock.timer);
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
        // A guest's sign-in banner stands at the foot of the page; the toasts stand above it. Both stand on a host's
        // bottom bar, as tall as its `--explorer-floor` (README.md "Styling").
        className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+var(--explorer-floor,0px))] z-50 flex flex-col items-center gap-2 px-4 [body:has([data-sign-in-banner])_&]:bottom-[calc(10rem+var(--explorer-floor,0px))] sm:[body:has([data-sign-in-banner])_&]:bottom-[calc(7rem+var(--explorer-floor,0px))]"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => resume(t.id)}
            onFocus={() => pause(t.id)}
            onBlur={() => resume(t.id)}
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
