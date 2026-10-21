'use client';

// A Dashboard layout drawn small (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): its rows and slots to scale, as
// Start Planning's Dashboards offer them (start/StartPlanning.tsx).
import { DASHBOARD_SPANS } from '@livediagram/document';
import type { PlanPalette } from './plan-palette';

const W = 120;
const H = 72;
const PAD = 4;
const GAP = 4;

// A layout drawn small: rows at their relative heights, slots at their spans.
export function DashboardLayoutPicture({
  rows,
  palette,
}: {
  rows: readonly (readonly [number, readonly number[]])[];
  palette: PlanPalette;
}) {
  const total = rows.reduce((sum, [h]) => sum + h, 0);
  const usableH = H - PAD * 2 - GAP * (rows.length - 1);
  const heights = rows.map(([h]) => (h / total) * usableH);
  // Each row's top: the rows above it and their gaps.
  const tops = heights.map((_, r) => PAD + heights.slice(0, r).reduce((a, b) => a + b + GAP, 0));
  const rects = rows.flatMap(([, spans], r) => {
    const usableW = W - PAD * 2 - GAP * (spans.length - 1);
    const widths = spans.map((span) => (span / DASHBOARD_SPANS) * usableW);
    return widths.map((w, i) => {
      const x = PAD + widths.slice(0, i).reduce((a, b) => a + b + GAP, 0);
      const lit = (r + i) % 3 === 0;
      return (
        <rect
          key={`${r}-${i}`}
          x={x}
          y={tops[r]}
          width={w}
          height={heights[r]}
          rx={3}
          fill={lit ? palette.focus : palette.column}
          fillOpacity={lit ? 0.22 : 1}
          stroke={palette.border}
        />
      );
    });
  });
  return (
    <span
      aria-hidden
      className="flex h-16 w-full items-center justify-center rounded-lg border sm:h-24"
      style={{ backgroundColor: palette.card, borderColor: palette.border }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full p-1.5">
        {rects}
      </svg>
    </span>
  );
}
