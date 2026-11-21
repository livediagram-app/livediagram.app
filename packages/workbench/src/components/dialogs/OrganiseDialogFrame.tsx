'use client';

// The tab menu's organise modals' frame (each product's docs/specs/006-*/tab-folders.md "Membership UX", and Add to
// Another File where a product has it): a centred dialog, header (title, a line under it, close) over a scrolling
// body, the same in every editor.
import type { ReactNode } from 'react';
import { DialogCloseButton, useEscape } from '@liveworkspace/ui';
import { Dialog } from './Dialog';

export function OrganiseDialogFrame({
  title,
  sub,
  onClose,
  escapeHeld = false,
  children,
}: {
  title: string;
  sub: string;
  onClose: () => void;
  // Something inside holds Escape (a popover, an inline editor): it takes the press, and the dialog stays.
  escapeHeld?: boolean;
  children: ReactNode;
}) {
  // Capture-phase Esc so this wins over the editor's global shortcuts; the Dialog shell's own (bubble-phase) Esc is
  // suppressed via closeOnEscape.
  useEscape(onClose, { capture: true, stopPropagation: true, enabled: !escapeHeld });
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={title}
      size="lg"
      closeOnEscape={false}
      className="max-h-[80vh]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-5 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
        </div>
        <div className="-mt-1 flex shrink-0 items-center">
          <DialogCloseButton onClick={onClose} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </Dialog>
  );
}
