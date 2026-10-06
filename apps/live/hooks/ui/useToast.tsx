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
import { buttonClassName, CloseIcon, Glyph, ButtonContent, Portal } from '@livediagram/ui';
import { readUserPreferences } from '@/lib/user-preferences';

// Lightweight toast surface. Two jobs: (1) make previously-silent async
// failures visible (linkTab, copy document, clipboard + upload errors
// that happen in the background), and (2) confirm consequential,
// otherwise-silent actions (a document moved to a folder, duplicated,
// deleted from a long list). NOT used for autosave (it has its own
// header pill) nor for anything already visible on screen (adding an
// element, a copy button that flips to "Copied" inline) — toasting
// those would just be noise.
//
// The "Show notifications" preference (docs/specs/007-editor/user-preferences.md) gates the success +
// info tones: when it's off, those become no-ops. ERROR toasts ignore
// the preference and always show, so quieting the chatter never hides
// an actual failure. The gate is read per-push (a cheap synchronous
// localStorage read) so flipping the setting takes effect immediately,
// with no subscription to manage.
//
// Provider renders a stack of toasts at the bottom-centre via a
// portal so the toasts float above every other modal / dialog
// (z-index above ConfirmDialog's z-[var(--z-modal)], see globals.css). The hook
// returns an imperative `toast.error(msg) / toast.success(msg) /
// toast.info(msg)` so call sites stay terse:
//
//   catch (e) { toast.error('Failed to add tab to that document'); }
//
// Toasts auto-dismiss after 4 seconds; users can click the close
// icon to drop one early. Identical messages within a short window
// deduplicate so an autosave-style loop can't drown the surface.

const AUTO_DISMISS_MS = 4_000;

type ToastTone = 'error' | 'success' | 'info';

// An offer (docs/specs/007-editor/power-user-mode.md): an info toast that asks something, so it
// carries two answers and waits for one: no timeout (WCAG 2.2.1). Closing it
// is the decline.
export type ToastOffer = {
  message: string;
  confirmLabel: string;
  declineLabel: string;
  onConfirm: () => void;
  onDecline: () => void;
};

// An action toast (docs/specs/024-agents/agent-changesets.md "In the editor"): an info toast with
// buttons that names a change and offers to act on it. Upserted in place by `key`, so a burst
// updates one toast; no timeout (WCAG 2.2.1): it stays until dismissed or replaced.
export type ToastAction = {
  label: string;
  ariaLabel?: string;
  onSelect: () => void;
  disabled?: boolean;
};
export type ToastActionSpec = { key: string; message: string; actions: ToastAction[] };

type ToastEntry = {
  id: number;
  message: string;
  tone: ToastTone;
  offer?: ToastOffer;
  key?: string;
  actions?: ToastAction[];
};

type ToastApi = {
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  offer: (offer: ToastOffer) => void;
  action: (spec: ToastActionSpec) => void;
};

const noop: ToastApi = {
  error: () => {},
  success: () => {},
  info: () => {},
  offer: () => {},
  action: () => {},
};

const ToastContext = createContext<ToastApi>(noop);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message: string, tone: ToastTone, offer?: ToastOffer) => {
    // Errors always surface; success / info are gated on the
    // "Show notifications" preference (default on). Read fresh per
    // push so a Settings flip applies without a subscription.
    if (tone !== 'error' && readUserPreferences().notificationsEnabled === false) return;
    setToasts((prev) => {
      // Dedupe same-tone same-message toasts so a tight retry
      // loop doesn't stack visual duplicates. The existing entry
      // stays in place (its dismiss timer keeps running).
      if (prev.some((t) => t.message === message && t.tone === tone)) return prev;
      return [...prev, { id: nextId++, message, tone, offer }];
    });
  }, []);

  // Info tone, so the "Show notifications" preference silences it like any other.
  const upsertAction = useCallback((spec: ToastActionSpec) => {
    if (readUserPreferences().notificationsEnabled === false) return;
    setToasts((prev) => {
      const entry = {
        message: spec.message,
        tone: 'info' as const,
        key: spec.key,
        actions: spec.actions,
      };
      const at = prev.findIndex((t) => t.key === spec.key);
      if (at === -1) return [...prev, { id: nextId++, ...entry }];
      const next = prev.slice();
      next[at] = { ...prev[at]!, ...entry };
      return next;
    });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      error: (msg) => push(msg, 'error'),
      success: (msg) => push(msg, 'success'),
      info: (msg) => push(msg, 'info'),
      offer: (offer) => push(offer.message, 'info', offer),
      action: upsertAction,
    }),
    [push, upsertAction],
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
  const offer = toast.offer;
  const waits = offer !== undefined || toast.actions !== undefined;
  useEffect(() => {
    if (waits) return;
    const id = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [onDismiss, waits]);
  const answer = (confirm: boolean) => {
    onDismiss();
    if (!offer) return;
    if (confirm) offer.onConfirm();
    else offer.onDecline();
  };

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
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-sm leading-snug">{toast.message}</p>
        {offer ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => answer(true)}
              className={buttonClassName({ size: 'xs' })}
            >
              <ButtonContent>{offer.confirmLabel}</ButtonContent>
            </button>
            <button
              type="button"
              onClick={() => answer(false)}
              className={buttonClassName({ size: 'xs', variant: 'secondary' })}
            >
              <ButtonContent>{offer.declineLabel}</ButtonContent>
            </button>
          </div>
        ) : null}
        {toast.actions && toast.actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {toast.actions.map((action, i) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onSelect}
                disabled={action.disabled}
                aria-label={action.ariaLabel}
                className={buttonClassName({
                  size: 'xs',
                  variant: i === 0 ? 'secondary' : 'primary',
                })}
              >
                <ButtonContent>{action.label}</ButtonContent>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => answer(false)}
        aria-label="Dismiss"
        className="rounded-md p-1 text-current opacity-60 transition hover:opacity-100"
      >
        <CloseIcon size={12} />
      </button>
    </div>
  );
}

function ToneGlyph({ tone }: { tone: ToastTone }) {
  if (tone === 'error') {
    return (
      <Glyph size={16} units={16} className="mt-0.5 shrink-0">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 4.5v4M8 11h0" />
      </Glyph>
    );
  }
  if (tone === 'success') {
    return (
      <Glyph size={16} units={16} className="mt-0.5 shrink-0">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5 8.3l2 2 4-4.6" />
      </Glyph>
    );
  }
  return (
    <Glyph size={16} units={16} className="mt-0.5 shrink-0">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 11v-3M8 5h0" />
    </Glyph>
  );
}
