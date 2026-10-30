'use client';

// A column's head on a board simplified in a Dashboard slot (docs/specs/026-plan/plan-tabs.md "A board in a slot is
// simplified"): its colour dot, name and count (against its WIP limit, warning-coloured over it), then the column's +
// for someone who may add cards. No cog: the column is set up on the board's own tab.
import type { ReactNode } from 'react';
import type { ProjectedColumn } from '@liveplanner/items';
import { CountBadge } from '@liveplanner/ui';
import { plural } from '@liveplanner/project';
import type { PlanPalette } from './plan-palette';
import { COLUMN_ATTR } from './column-move-flip';

export function SlotColumnHeader({
  col,
  palette,
  add,
  onFrame,
}: {
  col: ProjectedColumn & { count: number; overLimit: boolean };
  palette: PlanPalette;
  // The column's Add a Card + (AddCardButton `compact`), or nothing for someone who may not add.
  add?: ReactNode;
  // A tap on the head (a phone): the view frames this column, given the head.
  onFrame?: ((header: HTMLElement) => void) | undefined;
}) {
  const { column } = col;
  return (
    <div
      {...{ [COLUMN_ATTR]: column.id }}
      data-slot-column-head
      className="sticky top-0 z-[1] flex h-9 items-center gap-1.5 rounded-t-lg pl-2.5 pr-1.5"
      style={{ backgroundColor: palette.column }}
      onClick={
        onFrame
          ? (e) => {
              if ((e.target as HTMLElement).closest('button, [role="menu"]')) return;
              onFrame(e.currentTarget);
            }
          : undefined
      }
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: column.color ?? palette.muted }}
      />
      <span className="min-w-0 truncate text-[12px] font-semibold">{column.name}</span>
      <CountBadge
        background={col.overLimit ? palette.warningBg : palette.surface}
        color={col.overLimit ? palette.warning : palette.muted}
        label={
          column.wipLimit
            ? `${col.count} of a WIP limit of ${column.wipLimit}${col.overLimit ? ', over the limit' : ''}`
            : plural(col.count, 'item')
        }
      >
        {column.wipLimit ? `${col.count} / ${column.wipLimit}` : col.count}
      </CountBadge>
      {add ? <span className="ml-auto flex shrink-0">{add}</span> : null}
    </div>
  );
}
