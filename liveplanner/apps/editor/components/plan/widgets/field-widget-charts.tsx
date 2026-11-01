'use client';

// The small pictures field widgets lead with (docs/specs/026-plan/board-widgets.md "What each view reads"): a ring, a
// split bar, a row of bars and a row of stars, each CSS so they stay crisp at any zoom and cost nothing to draw. Sized
// for the 28px header pill.
import type { PlanPalette } from '../plan-palette';

export type Segment = { key: string; share: number; color: string };

// An 18px ring split into segments (shares of 1), the rest the board's border colour, with the board's surface in the
// middle: Completion's ring, with any number of parts.
export function Ring({
  segments,
  palette,
}: {
  segments: readonly Segment[];
  palette: PlanPalette;
}) {
  let at = 0;
  const stops: string[] = [];
  for (const s of segments) {
    const end = at + s.share * 360;
    stops.push(`${s.color} ${at}deg ${end}deg`);
    at = end;
  }
  stops.push(`${palette.border} ${at}deg 360deg`);
  return (
    <span
      aria-hidden
      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${stops.join(', ')})` }}
    >
      <span
        className="h-[11px] w-[11px] rounded-full"
        style={{ backgroundColor: palette.surface }}
      />
    </span>
  );
}

// One bar split into segments in their colours, on the board's column colour.
export function SplitBar({
  segments,
  palette,
  width = 56,
}: {
  segments: readonly Segment[];
  palette: PlanPalette;
  width?: number;
}) {
  return (
    <span
      aria-hidden
      className="flex h-2 shrink-0 overflow-hidden rounded-full"
      style={{ width, backgroundColor: palette.column }}
    >
      {segments.map((s) => (
        <span
          key={s.key}
          className="h-full"
          style={{ width: `${s.share * 100}%`, backgroundColor: s.color }}
        />
      ))}
    </span>
  );
}

// A row of thin bars, each as tall as its count against the tallest (a floor of 2px so an empty one still shows),
// in one colour or each its own.
export function MiniBars({
  counts,
  color,
  colors,
  palette,
}: {
  counts: readonly number[];
  color: string;
  colors?: readonly (string | undefined)[];
  palette: PlanPalette;
}) {
  const most = Math.max(1, ...counts);
  return (
    <span aria-hidden className="flex h-4 shrink-0 items-end gap-[2px]">
      {counts.map((n, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: `${Math.max(2, Math.round((n / most) * 16))}px`,
            backgroundColor: n > 0 ? (colors?.[i] ?? color) : palette.border,
          }}
        />
      ))}
    </span>
  );
}

// Five stars filled to `value` of `scale` (a scale past five reads as a share of five), the unfilled part the border.
export function Stars({
  value,
  scale,
  color,
  palette,
}: {
  value: number;
  scale: number;
  color: string;
  palette: PlanPalette;
}) {
  const share = scale > 0 ? Math.max(0, Math.min(1, value / scale)) : 0;
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 text-[12px] leading-none tracking-[-1px]"
    >
      <span style={{ color: palette.border }}>★★★★★</span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap"
        style={{ width: `${share * 100}%`, color }}
      >
        ★★★★★
      </span>
    </span>
  );
}
