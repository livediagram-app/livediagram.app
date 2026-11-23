'use client';

import type { ReactNode } from 'react';
import { Glyph } from '@liveworkspace/ui';
import { useMenuItemProps } from './menu-item-props';
import { sectionTriggerClass } from './MenuFlyoutPanel';

// A menu category whose contents are too big for the menu, so the row opens them in a DIALOG
// (docs/specs/008-canvas/canvas-and-palette.md "A category that opens a dialog"). It looks like its neighbours, a
// MenuAccordionSection header or a MenuFlyoutSection row (icon, uppercase title), and differs only in the mark at
// its right: a small window, where an accordion has a chevron and a flyout an ellipsis, so the row says where its
// contents will appear before it is pressed.
export function MenuDialogSection({
  title,
  icon,
  onOpen,
  flush = false,
}: {
  title: string;
  icon: ReactNode;
  // Opens the dialog. The host closes the menu first, so the menu never stays drawn over it.
  onOpen: () => void;
  // As MenuAccordionSection's: no top hairline where the parent bands rows into groups.
  flush?: boolean;
}) {
  const { itemProps } = useMenuItemProps();
  return (
    <div
      className={flush ? '' : 'border-t border-slate-100 first:border-t-0 dark:border-slate-800'}
    >
      <button
        type="button"
        {...itemProps}
        onClick={onOpen}
        aria-haspopup="dialog"
        data-menu-section={title}
        className={sectionTriggerClass(false)}
      >
        <span className="flex items-center gap-2">
          <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>
          {title}
        </span>
        <DialogMark />
      </button>
    </div>
  );
}

// A window: a frame with a title bar.
function DialogMark() {
  return (
    <Glyph size={14} units={16}>
      <rect x="2.25" y="3.25" width="11.5" height="9.5" rx="1.75" />
      <path d="M2.25 6.5h11.5" />
    </Glyph>
  );
}
