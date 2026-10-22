'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { readUserPreferences } from '@/lib/user-preferences';
import { ToastStack, type ToastAnswers } from '@/components/toast/ToastStack';
import {
  pushToast,
  retireToasts,
  upsertActionToast,
  type ToastActionSpec,
  type ToastEntry,
  type ToastOffer,
  type ToastTone,
} from '@/components/toast/toast-queue';

export type {
  ToastAction,
  ToastActionSpec,
  ToastOffer,
  ToastTone,
} from '@/components/toast/toast-queue';

// The toast surface (docs/specs/004-interface-design/toasts.md). Two jobs: (1) make otherwise-silent
// failures visible (a background save, a copy, an upload), and (2) confirm consequential, otherwise
// silent actions (a project moved, duplicated, deleted with an Undo). Never for autosave (its own
// header pill) nor for what is already on screen (an element appearing, a copy button turning into
// "Copied"): toasting those is noise.
//
// The imperative API keeps call sites terse:
//
//   catch (e) { toast.error("Couldn't add the tab. Try again."); }
//
// The In-Editor Notifications preference (docs/specs/007-editor/user-preferences.md) gates info, success,
// offers and action toasts: when it is off they are no-ops. Warnings and errors ignore it, so quieting
// the chatter never hides a problem. Read fresh per push (a cheap synchronous localStorage read), so a
// Settings flip applies at once with no subscription. The stack, its placement, timing and exit live in
// components/toast; the queue's writes (dedupe, upsert, the four-toast limit) in toast-queue.ts.

type ToastApi = {
  info: (message: string) => void;
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
  offer: (offer: ToastOffer) => void;
  action: (spec: ToastActionSpec) => void;
  // Close the action toast upserted under `key` (an Undo that has run), if it is still up.
  dismissAction: (key: string) => void;
};

const noop: ToastApi = {
  info: () => {},
  success: () => {},
  warning: () => {},
  error: () => {},
  offer: () => {},
  action: () => {},
  dismissAction: () => {},
};

const ToastContext = createContext<ToastApi>(noop);

let nextId = 1;

const quieted = () => readUserPreferences().notificationsEnabled === false;
const ALWAYS_SHOWN: ReadonlySet<ToastTone> = new Set(['warning', 'error']);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const push = useCallback((message: string, tone: ToastTone, offer?: ToastOffer) => {
    if (!ALWAYS_SHOWN.has(tone) && quieted()) return;
    setToasts((prev) => pushToast(prev, { message, tone, offer }, nextId++));
  }, []);

  const upsertAction = useCallback((spec: ToastActionSpec) => {
    if (quieted()) return;
    setToasts((prev) => upsertActionToast(prev, spec, nextId++));
  }, []);

  const retire = useCallback((match: (t: ToastEntry) => boolean) => {
    setToasts((prev) => retireToasts(prev, match));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      info: (msg) => push(msg, 'info'),
      success: (msg) => push(msg, 'success'),
      warning: (msg) => push(msg, 'warning'),
      error: (msg) => push(msg, 'error'),
      offer: (offer) => push(offer.message, 'info', offer),
      action: upsertAction,
      dismissAction: (key) => retire((t) => t.key === key),
    }),
    [push, upsertAction, retire],
  );

  const on = useMemo<ToastAnswers>(() => {
    // An offer is answered once: the toast leaves first, then its callback runs.
    const answer = (entry: ToastEntry, confirm: boolean) => {
      if (entry.leaving) return;
      retire((t) => t.id === entry.id);
      if (!entry.offer) return;
      if (confirm) entry.offer.onConfirm();
      else entry.offer.onDecline();
    };
    return {
      answer,
      close: (entry) => answer(entry, false),
      expire: (id) => retire((t) => t.id === id),
      remove: (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    };
  }, [retire]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} on={on} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
