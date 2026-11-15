'use client';

// A pane header's quiet action: a glyph named by its label and tooltip, a wash on hover, no frame. Words would crowd
// the section's name out of a narrow pane. The panel's header row and the Inbox's header doors (InboxHost.headerActions)
// share it.
import type { ReactNode } from 'react';
import { Tooltip } from '@liveworkspace/ui';

export const HEADER_ICON_BUTTON =
  'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-500 pointer-coarse:size-11 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white [&_svg]:size-4';

export function HeaderIconButton({
  label,
  onClick,
  children,
  dataId,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  // A stable hook for tests and tours (`data-header-action`).
  dataId?: string;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={HEADER_ICON_BUTTON}
        {...(dataId ? { 'data-header-action': dataId } : {})}
      >
        {children}
      </button>
    </Tooltip>
  );
}
