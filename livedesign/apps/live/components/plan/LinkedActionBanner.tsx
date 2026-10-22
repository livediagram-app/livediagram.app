'use client';

// The banner a linked card's item panel opens with (docs/specs/026-plan/linked-boards.md "On the board"): which action
// the card is, where it is, and the way to it.
import { ActionMenuIcon } from '@/components/palette/context-menu-icons';

export function LinkedActionBanner({
  tabName,
  onShowOnCanvas,
}: {
  tabName: string;
  onShowOnCanvas: () => void;
}) {
  return (
    <div
      data-testid="linked-action-banner"
      className="mb-4 flex items-center gap-2.5 rounded-lg bg-brand-50/70 px-3 py-2 text-[12.5px] text-slate-700 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-slate-200 dark:ring-brand-500/20"
    >
      <span className="text-brand-700 dark:text-brand-300" aria-hidden>
        <ActionMenuIcon />
      </span>
      <span className="min-w-0 flex-1 truncate">
        Linked to an action on <span className="font-semibold">{tabName}</span>
      </span>
      <button
        type="button"
        onClick={onShowOnCanvas}
        className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-[12px] font-semibold text-brand-700 transition hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-500/15"
      >
        Show on Canvas
      </button>
    </div>
  );
}
