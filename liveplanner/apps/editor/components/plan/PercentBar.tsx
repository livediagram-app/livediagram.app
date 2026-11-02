'use client';

// A share drawn as a bar (docs/specs/026-plan/item-types.md "Percent"): one drawing for every place a Percent field,
// or a worked-out share shown as one (a Children Done; formulas and rollups after), appears. `PercentBar` is the track
// and its fill; `PercentChip` the card face's pill (the bar and "40%", in the board's palette, as exports draw it:
// svg-render-plan-card.ts); `PercentReading` the panel's read-only bar and number (a Viewer's Percent, a Calculated
// field shown as a Percent).
import { PLAN_PERCENT_BAR, planPercentInks } from '@liveplanner/project';
import { percentText } from '@liveplanner/items';
import type { CSSProperties } from 'react';
import { MetaPill } from './plan-card-parts';
import type { PlanPalette } from './plan-palette';

type Inks = { fill: string; track: string };

// The track, with the share filled from its start. Without `inks` it takes the app's own colours (a quiet slate track,
// the brand fill), as the panel draws it; a card face hands in its palette's. `faded` draws the empty track of a field
// with no value.
export function PercentBar({
  value,
  inks,
  className = 'h-1.5 w-full',
  style,
}: {
  value: number | undefined;
  inks?: Inks;
  className?: string;
  style?: CSSProperties;
}) {
  const share = value ?? 0;
  return (
    <span
      aria-hidden
      className={`relative block shrink-0 overflow-hidden rounded-full ${inks ? '' : 'bg-slate-200 dark:bg-slate-700'} ${className}`}
      style={{ ...(inks ? { backgroundColor: inks.track } : {}), ...style }}
    >
      {share > 0 ? (
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${inks ? '' : 'bg-brand-600 dark:bg-brand-400'}`}
          style={{ width: `${share}%`, ...(inks ? { backgroundColor: inks.fill } : {}) }}
        />
      ) : null}
    </span>
  );
}

// The card face's chip: a short thin bar and the share, named "{Field}: 40%" for assistive technology.
export function PercentChip({
  name,
  value,
  palette,
}: {
  name: string;
  value: number;
  palette: PlanPalette;
}) {
  const text = percentText(value);
  return (
    <MetaPill palette={palette} label={`${name}: ${text}`}>
      <PercentBar
        value={value}
        inks={planPercentInks(palette)}
        className=""
        style={{ width: PLAN_PERCENT_BAR.width, height: PLAN_PERCENT_BAR.height }}
      />
      <span className="font-semibold" style={{ color: palette.text }}>
        {text}
      </span>
    </MetaPill>
  );
}

// The panel's read-only share: the bar across the row and the number after it.
export function PercentReading({ id, value }: { id?: string; value: number }) {
  return (
    <output id={id} className="flex min-h-7 flex-1 items-center gap-2.5">
      <PercentBar value={value} className="h-1.5 min-w-12 flex-1" />
      <span className="w-10 shrink-0 text-right text-[13px] font-medium tabular-nums text-slate-700 dark:text-slate-200">
        {percentText(value)}
      </span>
    </output>
  );
}
