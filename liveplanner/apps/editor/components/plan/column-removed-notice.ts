'use client';

// Remove Column's notice (docs/specs/026-plan/plan-board.md "A column's own settings", Work Tracker 1048): a column
// taken off a board takes its cards off it too, which reads as if they were deleted. When it held cards, a toast says
// where they are now, with Undo putting the column back; an empty column goes silently.
import { useCallback } from 'react';
import type { PlanColumn } from '@liveplanner/items';
import { useToast } from '@/hooks/ui/useToast';
import { usePlan } from './PlanContext';

// The boards (by title) that still show `status` once one board titled `title` stops: every board naming it, less
// one entry for the board it left.
export function boardsStillShowing(
  boards: readonly { title: string; statuses: readonly string[] }[],
  status: string,
  title: string,
): string[] {
  const out: string[] = [];
  let skipped = false;
  for (const b of boards) {
    if (!b.statuses.includes(status)) continue;
    if (!skipped && b.title === title) {
      skipped = true;
      continue;
    }
    out.push(b.title);
  }
  return out;
}

// The notice's words, or null for a column that held no cards.
export function columnRemovedCopy(
  name: string,
  cards: number,
  elsewhere: readonly string[],
): string | null {
  if (cards <= 0) return null;
  const lead = `${name} is off this board.`;
  const one = cards === 1;
  const its = one ? 'Its card' : `Its ${cards} cards`;
  if (elsewhere.length === 0)
    return `${lead} ${its} ${one ? 'is' : 'are'} on no board now: find ${one ? 'it' : 'them'} with Search.`;
  const more = elsewhere.length - 1;
  const where =
    more === 0
      ? elsewhere[0]
      : `${elsewhere[0]} and ${more} more ${more === 1 ? 'board' : 'boards'}`;
  return `${lead} ${its} ${one ? 'is' : 'are'} still on ${where}.`;
}

// Tells of a removed column's cards, with Undo calling `restore` (and closing the toast).
export function useColumnRemovedNotice(): (input: {
  column: PlanColumn;
  boardTitle: string;
  cards: number;
  restore: (() => void) | undefined;
}) => void {
  const toast = useToast();
  const plan = usePlan();
  const boards = plan?.statusBoards;
  return useCallback(
    ({ column, boardTitle, cards, restore }) => {
      const message = columnRemovedCopy(
        column.name,
        cards,
        boardsStillShowing(boards ?? [], column.status, boardTitle),
      );
      if (!message) return;
      const key = `column-removed:${column.id}`;
      toast.action({
        key,
        message,
        actions: restore
          ? [
              {
                label: 'Undo',
                ariaLabel: `Undo removing ${column.name}`,
                onSelect: () => {
                  restore();
                  toast.dismissAction(key);
                },
              },
            ]
          : [],
      });
    },
    [toast, boards],
  );
}
