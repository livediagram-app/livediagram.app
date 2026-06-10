'use client';

import { useEffect, useRef } from 'react';
import { Portal } from './Portal';

// Branded confirmation modal. Visual sibling of DeleteAccountDialog
// (same fly-up animation, same border/shadow stack, same button
// rhythm) but generalised: title + body + a single yes/no choice.
// Drives every "are you sure?" gesture in the live app via the
// useConfirm hook so we don't fall back to the OS-default
// window.confirm chrome (which feels out of place against the rest
// of the editor's UI).
//
// Pure presentation: open/close + confirm/cancel are all the
// caller's concern. The hook in hooks/useConfirm.tsx owns the
// imperative `confirm() => Promise<boolean>` adapter so call sites
// stay declarative ("if (!await confirm({...})) return;").

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Danger variant paints the confirm button rose; neutral keeps it
  // brand-blue. Default is `danger` because every current caller is
  // a destructive flow, and forgetting to set it would understate
  // the consequences.
  variant?: 'danger' | 'neutral';
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button on open so Enter immediately commits
  // and Esc cancels via the keydown handler below. Matches the
  // muscle-memory of window.confirm without the chrome.
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmTone =
    variant === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-500'
      : 'bg-brand-500 text-white hover:bg-brand-600 focus-visible:outline-brand-500';

  return (
    <Portal>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm dark:bg-slate-950/60"
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="flex w-[26rem] max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
        >
          <div className="border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
            <h2
              id="confirm-dialog-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-50"
            >
              {title}
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
              {message}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 ${confirmTone}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
