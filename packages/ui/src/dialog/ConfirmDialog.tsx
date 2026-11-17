'use client';

import { useEffect, useId, useRef } from 'react';
import { Button } from '../Button';
import { Dialog } from './Dialog';
import { useDialogInline } from './dialog-slot';
import { DialogFooter } from './DialogFooter';

// The one "are you sure?" modal: a title, a message and a single yes/no choice, so nothing falls back to the
// OS-default window.confirm chrome. Every editor's (through workbench's useConfirm, which adds the editor's modal
// guard) and the Explorer's, so a confirm reads the same wherever it is asked.
//
// Pure presentation: open/close + confirm/cancel are all the caller's concern. Workbench's hooks/ui/useConfirm owns
// the imperative `confirm() => Promise<boolean>` adapter so call sites stay declarative
// ("if (!await confirm({...})) return;").

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  // Focus the confirm button on open so Enter immediately commits
  // and Esc cancels via the keydown handler below. Matches the
  // muscle-memory of window.confirm without the chrome.
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
  }, [open]);

  return (
    <Dialog open={open} onClose={onCancel} titleId={titleId}>
      <ConfirmBody titleId={titleId} title={title} message={message} />
      <DialogFooter>
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          ref={confirmRef}
          // The dialog's primary action, a delete included: a delete is never painted red or yellow.
          variant="primary"
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// The question. Asked inside Tools (dialog-slot.ts), under the back bar that already heads it, it sits closer to it.
function ConfirmBody({
  titleId,
  title,
  message,
}: {
  titleId: string;
  title: string;
  message: string;
}) {
  const inline = useDialogInline();
  return (
    <div
      className={`border-b border-slate-100 dark:border-slate-800 ${inline ? 'px-4 pb-4 pt-1' : 'px-6 pb-4 pt-6'}`}
    >
      <h2
        id={titleId}
        className={`font-semibold text-slate-900 dark:text-slate-50 ${inline ? 'text-base' : 'text-lg'}`}
      >
        {title}
      </h2>
      <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
        {message}
      </p>
    </div>
  );
}
