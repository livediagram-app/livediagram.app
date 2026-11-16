'use client';

// The Filter widget in a narrow header (docs/specs/026-plan/board-widgets.md "The header", Work Tracker 880): when the
// zone's room cannot hold the whole Filter beside More and the zone's buttons, the Filter keeps the zone's start as one
// header-sized button, its glyph and, while its words or field chips narrow the board, how many (pressed, in the
// brand colour, as every pressed value is). Pressing it opens the whole Filter (words, chips, Add Filter, saved
// filters) in a panel under it, working exactly as in the row.
import { useState, type ReactNode } from 'react';
import type { QuickFilter } from '@liveplanner/items';
import { CountBadge } from '@liveplanner/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import type { PlanPalette } from '../plan-palette';
import { Lead, WIDGET_PILL } from './board-widget-parts';

// The panel's width: the Filter field's 288 px and room for its saved filter chips.
export const COMPACT_FILTER_PANEL_PX = 380;

// How many narrowings the Filter itself holds: its words (one) and each field chip.
export function filterNarrowings(quick: QuickFilter): number {
  return (quick.text ? 1 : 0) + (quick.filters?.length ?? 0);
}

export function compactFilterName(on: number): string {
  return on ? `Filter, ${on} on` : 'Filter';
}

export function CompactBoardFilter({
  quick,
  palette,
  children,
}: {
  quick: QuickFilter;
  palette: PlanPalette;
  // The whole Filter, drawn in the panel.
  children: ReactNode;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const on = filterNarrowings(quick);
  return (
    <>
      <button
        type="button"
        data-compact-filter=""
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        aria-label={compactFilterName(on)}
        className={`${WIDGET_PILL} cursor-pointer outline-none transition hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/10`}
        style={{
          borderColor: on ? palette.focus : palette.border,
          color: on ? palette.focus : palette.muted,
          backgroundColor: on ? `${palette.focus}1f` : undefined,
          ['--tw-ring-color' as string]: palette.focus,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setAnchor(anchor ? null : e.currentTarget);
        }}
      >
        <Lead kind="filter" color={on ? palette.focus : palette.muted} />
        {on ? (
          <CountBadge size="md" background={`${palette.focus}26`} color={palette.focus}>
            {on}
          </CountBadge>
        ) : null}
      </button>
      {anchor ? (
        <AnchoredPopover
          anchor={anchor}
          name="Filter"
          width={COMPACT_FILTER_PANEL_PX}
          preventScroll
          onClose={() => setAnchor(null)}
        >
          <div
            data-compact-filter-panel=""
            className="flex flex-wrap items-center gap-1.5 rounded-lg border p-2"
            style={{ backgroundColor: palette.surface, borderColor: palette.border }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
