'use client';

// A flow chart's Range (docs/specs/026-plan/plan-views.md "Flow charts"), as its cog's Settings and its element menu's
// View flyout both list it: an option list of the four ranges ending today, ticked on the one shown.
import { FLOW_RANGES, type FlowRange } from '@liveplanner/items';
import { OptionRows } from '../OptionRows';
import { PlanTypeGlyph } from '../plan-type-glyph';
import { InfoNote } from '@/components/palette/plan-menu-parts';

export function FlowRangeOptions({
  selected,
  onPick,
}: {
  selected: FlowRange;
  onPick: (days: FlowRange) => void;
}) {
  return (
    <>
      <InfoNote>The days this chart reads, ending today.</InfoNote>
      <OptionRows
        kind="single"
        label="Range"
        className="mx-3 my-1.5"
        selected={String(selected)}
        rows={FLOW_RANGES.map((days) => ({
          id: String(days),
          label: `Last ${days} Days`,
          icon: <PlanTypeGlyph glyph="calendar" size={16} />,
        }))}
        onPick={(id) => {
          const days = FLOW_RANGES.find((d) => String(d) === id);
          if (days !== undefined && days !== selected) onPick(days);
        }}
      />
    </>
  );
}
