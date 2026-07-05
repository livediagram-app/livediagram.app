import { forwardRef, type MouseEvent } from 'react';

// The row / card ⋯ menu trigger: the identical h-7 slate button (and
// its three-dot glyph) that the Explorer rows, cards, and team panes
// each hand-rolled. forwardRef because every caller anchors its portal
// menu to this button. `tuck` adds the card variant's corner-tuck
// margins (DiagramCard / FolderCard headers).
export const EllipsisTriggerButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    onClick: (e: MouseEvent<HTMLButtonElement>) => void;
    expanded?: boolean;
    tuck?: boolean;
  }
>(function EllipsisTriggerButton({ label, onClick, expanded, tuck = false }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      className={`${
        tuck ? '-mr-1 -mt-0.5 shrink-0 ' : ''
      }inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <circle cx="3" cy="7" r="1.25" fill="currentColor" />
        <circle cx="7" cy="7" r="1.25" fill="currentColor" />
        <circle cx="11" cy="7" r="1.25" fill="currentColor" />
      </svg>
    </button>
  );
});
