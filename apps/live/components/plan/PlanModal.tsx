'use client';

// The item panel's shell (docs/specs/026-plan/blueprints/plan-board.md "Presentation and UX"):
// PlanModal, a centred modal over the editor with a header, a scrolling body and a footer, rising
// from the bottom with a grab handle on a phone, through the shared Dialog. With the row and field
// styles the Plan forms share.
import type { ReactNode } from 'react';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@livediagram/ui';

type ShellProps = {
  label: string;
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

function ShellParts({ onClose, header, children, footer }: ShellProps) {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="min-w-0 flex-1">{header}</div>
        <DialogCloseButton compact onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
      {footer ? (
        <div className="border-t border-slate-200 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {footer}
        </div>
      ) : null}
    </>
  );
}

export function PlanModal(props: ShellProps) {
  return (
    <Dialog
      open
      onClose={props.onClose}
      ariaLabel={props.label}
      size="lg"
      phoneSheet
      className="max-h-[min(44rem,calc(100dvh-2rem))] overflow-hidden"
    >
      <ShellParts {...props} />
    </Dialog>
  );
}

// A labelled row of the sheet.
export function SheetRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
