'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Portal } from '@/components/primitives/Portal';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { readUserPreferences } from '@/lib/user-preferences';

// Lightweight toast surface. Two jobs: (1) make previously-silent async
// failures visible (linkTab, copy diagram, clipboard + upload errors
// that happen in the background), and (2) confirm consequential,
// otherwise-silent actions (a diagram moved to a folder, duplicated,
// deleted from a long list). NOT used for autosave (it has its own
// header pill) nor for anything already visible on screen (adding an
// element, a copy button that flips to "Copied" inline) — toasting
// those would just be noise.
//
// The "Show notifications" preference (spec/20) gates the success +
// info tones: when it's off, those become no-ops. ERROR toasts ignore
// the preference and always show, so quieting the chatter never hides
// an actual failure. The gate is read per-push (a cheap synchronous
// localStorage read) so flipping the setting takes effect immediately,
// with no subscription to manage.
//
// Provider renders a stack of toasts at the bottom-centre via a
// portal so the toasts float above every other modal / dialog
// (z-index above ConfirmDialog's z-50, see globals.css). The hook
// returns an imperative `toast.error(msg) / toast.success(msg) /
// toast.info(msg)` so call sites stay terse:
//
//   catch (e) { toast.error('Failed to add tab to that diagram'); }
//
// Toasts auto-dismiss after 4 seconds; users can click the close
// icon to drop one early. Identical messages within a short window
// deduplicate so an autosave-style loop can't drown the surface.

const AUTO_DISMISS_MS = 4_000;

type ToastTone = 'error' | 'success' | 'info';

type ToastEntry = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastApi = {
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
};

const noop: ToastApi = {
  error: () => {},
  success: () => {},
  info: () => {},
};

const ToastContext = createContext<ToastApi>(noop);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message: string, tone: ToastTone) => {
    // Errors always surface; success / info are gated on the
    // "Show notifications" preference (default on). Read fresh per
    // push so a Settings flip applies without a subscription.
    if (tone !== 'error' && readUserPreferences().notificationsEnabled === false) return;
    setToasts((prev) => {
      // Dedupe same-tone same-message toasts so a tight retry
      // loop doesn't stack visual duplicates. The existing entry
      // stays in place (its dismiss timer keeps running).
      if (prev.some((t) => t.message === message && t.tone === tone)) return prev;
      return [...prev, { id: nextId++, message, tone }];
    });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      error: (msg) => push(msg, 'error'),
      success: (msg) => push(msg, 'success'),
      info: (msg) => push(msg, 'info'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastEntry[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <Portal>
      <div
        // Bottom-centre. Sits at the top of the stacking ladder (z-toast,
        // above the modal rung) so a failure toast surfaces even when a
        // dialog is open. On mobile it's lifted clear of the zoom / dock
        // controls along the bottom edge (sm+ drops it back to bottom-4).
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[var(--z-toast)] flex flex-col items-center gap-2 px-4 sm:bottom-4"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <ToastBubble key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
        ))}
      </div>
    </Portal>
  );
}

function ToastBubble({ toast, onDismiss }: { toast: ToastEntry; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [onDismiss]);

  const palette =
    toast.tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-100'
      : toast.tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100'
        : 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-lg border px-3 py-2 shadow-sm animate-fade-in ${palette}`}
    >
      <ToneGlyph tone={toast.tone} />
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded-md p-1 text-current opacity-60 transition hover:opacity-100"
      >
        <CloseIcon size={12} strokeWidth={1.6} />
      </button>
    </div>
  );
}

function ToneGlyph({ tone }: { tone: ToastTone }) {
  if (tone === 'error') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="mt-0.5 shrink-0"
      >
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 4.5v4M8 11h0" />
      </svg>
    );
  }
  if (tone === 'success') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="mt-0.5 shrink-0"
      >
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5 8.3l2 2 4-4.6" />
      </svg>
    );
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="mt-0.5 shrink-0"
    >
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 11v-3M8 5h0" />
    </svg>
  );
}
