'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@livediagram/ui';
import { Dialog } from './Dialog';

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

  return (
    <Dialog open={open} onClose={onCancel} titleId="confirm-dialog-title">
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
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          ref={confirmRef}
          variant={variant === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
