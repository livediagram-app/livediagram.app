'use client';

// A step's fields on a phone (docs/specs/026-plan/automations.md "The rule builder on a phone"): a sheet stacked over
// the rule drawer, its own grab handle, the step's tile and name as its title beside the close, its fields scrolling
// inside, and Done at its foot. Every way out (swipe, the dim, Escape, the browser's Back, close, Done) slides it down
// first. A refused save opens it on the step at fault, with the refusal's words at the top of its fields.

import { useId, type ReactNode } from 'react';
import { Button, DialogCloseButton, useDialogDismiss } from '@liveplanner/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';

function DoneButton({ onDone }: { onDone: () => void }) {
  const dismiss = useDialogDismiss();
  return (
    <Button variant="primary" size="md" className="h-11 w-full" onClick={() => dismiss(onDone)}>
      Done
    </Button>
  );
}

export function StepDrawer({
  title,
  tile,
  onClose,
  fault = null,
  children,
}: {
  title: string;
  tile: ReactNode;
  onClose: () => void;
  // A refused save's words for this step: its card, behind the drawer, can't be seen.
  fault?: string | null;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <Dialog
      open
      onClose={onClose}
      titleId={titleId}
      size="lg"
      phoneSheet
      closeOnBack
      initialFocus="container"
      className="max-h-[85dvh] overflow-hidden"
    >
      <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-100 px-4 pb-3 dark:border-slate-800">
        {tile}
        <h2
          id={titleId}
          className="min-w-0 flex-1 truncate text-[16px] font-semibold text-slate-900 dark:text-slate-50"
        >
          {title}
        </h2>
        <DialogCloseButton onClick={onClose} />
      </div>
      <section
        aria-label={`${title} step`}
        data-step-panel=""
        data-step-drawer=""
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {fault ? (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300"
          >
            {fault}
          </p>
        ) : null}
        {children}
      </section>
      <div className="shrink-0 border-t border-slate-100 px-4 pb-3 pt-3 dark:border-slate-800">
        <DoneButton onDone={onClose} />
      </div>
    </Dialog>
  );
}
