'use client';

// The two shells the Plan panels open in (docs/specs/025-plan/blueprints/plan-board.md "Presentation
// and UX"), sharing one header, scrolling body and footer:
// - PlanSheet, board set-up's: 380px on the right of the editor, a bottom sheet on a phone. Not
//   modal, so the board stays workable beside it and shows each change; Escape closes it while focus
//   is inside.
// - PlanModal, the item panel's: a centred modal over the editor, rising from the bottom with a grab
//   handle on a phone, through the shared Dialog.
import { useEffect, useRef, type ReactNode } from 'react';
import { Dialog } from '@/components/dialogs/Dialog';
import { Portal } from '@/components/primitives/Portal';
import { CloseIcon } from '@livediagram/ui';

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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <CloseIcon size={14} />
        </button>
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

export function PlanSheet({ label, onClose, header, children, footer }: ShellProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <Portal>
      <aside
        ref={ref}
        tabIndex={-1}
        role="complementary"
        aria-label={label}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        className="fixed inset-x-0 bottom-0 z-[var(--z-overlay)] flex h-[85vh] animate-fade-in flex-col rounded-t-xl border border-slate-200 bg-white text-slate-800 shadow-xl shadow-slate-900/10 outline-none sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-20 sm:h-auto sm:w-[380px] sm:rounded-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40 motion-reduce:animate-none"
      >
        <ShellParts label={label} onClose={onClose} header={header} footer={footer}>
          {children}
        </ShellParts>
      </aside>
    </Portal>
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

export const FIELD_CLASS =
  'w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
