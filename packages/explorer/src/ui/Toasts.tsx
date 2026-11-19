'use client';

// The Explorer's toasts: the one shared toast (@liveworkspace/ui/toast, liveworkspace/docs/specs/016-notifications/
// toasts.md), with the Explorer's short API kept for its callers: what a change did, a refusal said in words, and Undo
// for a move to the Trash. Every toast can be closed, and one with an action (Undo) stays TOAST_ANSWER_MS.
//
// One stack per page: inside an editor (the Explorer panel) this provider hands its toasts to the editor's, so they
// share its stack, its notification list and its In-Editor Notifications setting. On its own page
// (liveworkspace.app/explorer) it is the page's, and every Explorer page shares one notification list.

import { useMemo, type ReactNode } from 'react';
import {
  TOAST_ANSWER_TIMEOUT_MS,
  ToastProvider as SharedToastProvider,
  useToast as useSharedToast,
  type ToastTone,
} from '@liveworkspace/ui/toast';

type Tone = ToastTone;

export type ToastApi = {
  show: (
    text: string,
    options?: { tone?: Tone; action?: { label: string; run: () => void } },
  ) => void;
  error: (text: string) => void;
};

export const TOAST_ANSWER_MS = TOAST_ANSWER_TIMEOUT_MS;

/** The Explorer's notification list, one for all its pages. */
const explorerScope = () => 'explorer';

export function useToast(): ToastApi {
  const toast = useSharedToast();
  return useMemo<ToastApi>(
    () => ({
      show: (text, options = {}) =>
        toast[options.tone ?? 'info'](text, {
          action: options.action
            ? { label: options.action.label, onSelect: options.action.run }
            : undefined,
        }),
      error: (text) => toast.error(text),
    }),
    [toast],
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return <SharedToastProvider historyScope={explorerScope}>{children}</SharedToastProvider>;
}
