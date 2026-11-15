'use client';

// When the board's filter hides every card (docs/specs/026-plan/board-widgets.md "When the filter hides every card"):
// the filter is shared, so someone opening the board may not know a teammate's filter is why its columns are empty. A
// no-match empty state in place of the first column's first card (empty-states.md "In place of one item") says so, in
// the board's own colours, with Show All for whoever may change the filter; a Viewer reads it without the button.
import type { QuickFilter } from '@liveplanner/items';
import { Button, CompactEmptyState, lucideGlyph, noMatchTitle } from '@liveplanner/ui';
import { lucideFunnel } from '@liveworkspace/icons/lucide';
import { pluralGrouped } from '@liveplanner/project';
import type { PlanPalette } from './plan-palette';

const FunnelIcon = /* @__PURE__ */ lucideGlyph(lucideFunnel, 16);

// How many narrowings beside the words: Only Mine, a person, a type, a priority, a due window, each field chip.
export function narrowingCount(quick: QuickFilter): number {
  return (
    (quick.mine ? 1 : 0) +
    (quick.person ? 1 : 0) +
    (quick.type ? 1 : 0) +
    (quick.priority ? 1 : 0) +
    (quick.due ? 1 : 0) +
    (quick.filters?.length ?? 0)
  );
}

export function FilterEmptyHint({
  quick,
  total,
  palette,
  onShowAll,
}: {
  // The filter as it applies to this viewer.
  quick: QuickFilter;
  // How many cards the board holds before the filter.
  total: number;
  palette: PlanPalette;
  // Clears the board's filter for everyone; absent for a Viewer.
  onShowAll?: (() => void) | undefined;
}) {
  return (
    <div
      data-filter-empty=""
      className="rounded-[var(--plan-card-r,12px)] border border-dashed"
      style={{ borderColor: palette.cardBorder, backgroundColor: palette.card }}
    >
      <CompactEmptyState
        role="status"
        size="small"
        ink={{ text: palette.text, muted: palette.muted }}
        icon={<FunnelIcon />}
        title={noMatchTitle('cards', quick.text ?? '', narrowingCount(quick))}
        description={
          total === 1
            ? 'The board’s filter hides its one card.'
            : `The board’s filter hides all ${pluralGrouped(total, 'card')}.`
        }
        action={
          onShowAll ? (
            <Button type="button" variant="secondary" size="xs" onClick={onShowAll}>
              Show All
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
