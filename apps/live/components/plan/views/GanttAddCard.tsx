'use client';

// Add Card on a Gantt chart (docs/specs/026-plan/plan-views.md "Gantt Chart"): for someone who may add cards, a row
// under the last card in the names column, opening the Add a Card menu of the card types the chart draws (those with a Start and a Due). The new
// card starts today and is due a week on, so its bar shows at once, and opens to be named.
import { useState } from 'react';
import { newItemId, typeIn, type ItemTypeDef } from '@livediagram/items';
import { mayCreateCardType } from '../may-create-card-type';
import { lucideGlyph } from '@livediagram/ui';
import { lucidePlus } from '@livediagram/icons/lucide';
import { AddCardPopover } from '../AddCardPopover';
import { newCardStatus } from '../new-card-status';
import type { PlanContextValue } from '../PlanContext';
import type { PlanPalette } from '../plan-palette';

const PlusGlyph = lucideGlyph(lucidePlus, 14);
// How long a new card's bar runs, in days.
export const GANTT_NEW_CARD_DAYS = 7;

const day = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// A new card's dates: today, and a week on.
export function ganttNewCardDates(now: Date): { start: string; due: string } {
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate() + GANTT_NEW_CARD_DAYS);
  return { start: day(now), due: day(due) };
}

export function GanttAddCard({
  plan,
  types: all,
  shown,
  palette,
  top,
  height,
  viewId,
}: {
  plan: PlanContextValue;
  // The chart, for Add New Card Type (a new type with Start and Due, added to the chart).
  viewId: string;
  types: readonly ItemTypeDef[];
  // The card types the chart draws, comma-joined ids.
  shown: string;
  palette: PlanPalette;
  // Its place in the names column: under the last row (pinned to the column's foot when that is lower).
  top: number;
  height: number;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const ids = shown.split(',');
  const types = all.filter((t) => ids.includes(t.id));
  // Add New Card Type, as a board's Add a Card menu offers it (an Editor's, while the catalogue has room).
  const createType = mayCreateCardType(plan) ? () => plan.createTypeForView(viewId) : undefined;
  if (!plan.canEditCards || (types.length === 0 && !createType)) return null;
  return (
    <>
      {/* Under the last row, or pinned to the column's foot once the rows run past it (the chart clips its rows, so
          Add Card stays in reach), over the rows on the surface's own colour. */}
      <div
        data-gantt-add-card
        className="absolute inset-x-0 z-10"
        style={{
          top: `min(${top}px, calc(100% - ${height}px))`,
          height,
          backgroundColor: palette.surface,
        }}
      >
        {/* Full strength muted text (no fade), so the label keeps its 4.5:1 contrast on the surface. */}
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={!!anchor}
          onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-full w-full cursor-pointer items-center gap-1.5 px-3 text-left text-[12px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
          style={{ color: palette.muted }}
        >
          <PlusGlyph />
          Add Card
        </button>
      </div>
      {anchor ? (
        <AddCardPopover
          anchor={anchor}
          types={types}
          {...(createType ? { onCreateType: createType } : {})}
          onClose={() => setAnchor(null)}
          onAdd={({ type, fields }) => {
            const id = newItemId();
            void plan.addItem({
              id,
              type,
              fields: { ...fields, ...ganttNewCardDates(new Date()) },
              status: newCardStatus(typeIn(plan.types, type), plan.statusNames),
              after: null,
            });
            setAnchor(null);
            plan.openNewItem(id);
          }}
        />
      ) : null}
    </>
  );
}
