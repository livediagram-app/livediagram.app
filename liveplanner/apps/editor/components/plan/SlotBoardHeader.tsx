'use client';

// The header of a board simplified in a Dashboard slot (docs/specs/026-plan/plan-tabs.md "A board in a slot is
// simplified"): the board's title and how many cards it shows, then its controls (Retry when its items failed to load,
// Maximise Board and the slot's own cog). The controls show while the pointer is over the board or focus is in it, and
// always on a touch screen or while one of them has its menu open, so at rest the slot is only its title and cards.
import type { ReactNode } from 'react';
import { CountBadge } from '@liveplanner/ui';
import { plural } from '@liveplanner/project';
import type { PlanPalette } from './plan-palette';

// The group the board's root carries (PlanBoardView), whose hover and focus show the controls.
export const SLOT_BOARD_GROUP = 'group/slot-board';
const REVEAL =
  'opacity-0 transition-opacity duration-micro ease-out motion-reduce:transition-none group-hover/slot-board:opacity-100 group-focus-within/slot-board:opacity-100 has-[[aria-expanded=true]]:opacity-100 [@media(hover:none)]:opacity-100';

export function SlotBoardHeader({
  title,
  count,
  palette,
  loadFailed,
  onRetry,
  controls,
}: {
  title: string;
  // The cards the board shows.
  count: number;
  palette: PlanPalette;
  loadFailed: boolean;
  onRetry: () => void;
  // Maximise Board and the slot's cog.
  controls?: ReactNode;
}) {
  return (
    <div
      data-board-header
      data-slot-board-header
      className="flex h-10 shrink-0 items-center gap-2 pl-3.5 pr-2"
      style={{ color: palette.text }}
    >
      <div className="min-w-0 truncate text-[14px] font-bold leading-tight">{title}</div>
      <CountBadge background={palette.column} color={palette.muted} label={plural(count, 'card')}>
        {count}
      </CountBadge>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {loadFailed ? (
          <button
            type="button"
            className="h-7 shrink-0 cursor-pointer rounded-md border px-2 text-[12px] font-medium"
            style={{ borderColor: palette.warning, color: palette.warning }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRetry}
          >
            Couldn&rsquo;t load items · Retry
          </button>
        ) : null}
        {controls ? (
          <div data-slot-board-controls className={`flex items-center gap-0.5 ${REVEAL}`}>
            {controls}
          </div>
        ) : null}
      </div>
    </div>
  );
}
