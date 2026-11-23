'use client';

// The Plan forms' shell (docs/specs/026-plan/blueprints/plan-board.md "Presentation and UX"):
// PlanModal, a centred modal over the editor with the dialog hero header (the caller's art and
// title), a scrolling body and a footer, rising from the bottom with a grab handle on a phone,
// through the shared Dialog. With the row and field styles the Plan forms share.
import { useId, type ReactNode } from 'react';
import { HeroDialogHeader, type HeroArt } from '@liveworkspace/ui/dialog-hero';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';

type ShellProps = {
  // The hero header's art, the caller's own (<Dialog>HeroArt.tsx beside it).
  art: HeroArt;
  // The dialog's name: the header's title, and what the panel is labelled by.
  title: string;
  // One line under the title.
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

function ShellParts({
  art,
  title,
  subtitle,
  onClose,
  children,
  footer,
  titleId,
}: ShellProps & { titleId: string }) {
  return (
    <>
      <HeroDialogHeader
        art={art}
        titleId={titleId}
        title={title}
        subtitle={subtitle}
        onClose={onClose}
        underHandle
      />
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
  const titleId = useId();
  return (
    <Dialog
      open
      onClose={props.onClose}
      titleId={titleId}
      size="lg"
      phoneSheet
      className="max-h-[min(44rem,calc(100dvh-2rem))] overflow-hidden"
    >
      <ShellParts {...props} titleId={titleId} />
    </Dialog>
  );
}

// A labelled row of the sheet.
export function SheetRow({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  // Extra classes for the row (a grid placement, say), after its own bottom margin.
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className ? `mb-3 ${className}` : 'mb-3'}>
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
