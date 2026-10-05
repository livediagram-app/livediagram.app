'use client';

// The Status Breakdown (docs/specs/026-plan/plan-views.md "Status Breakdown"): a donut of every live card by
// status, its middle the total, beside a legend of each status's name, colour and count. The donut is a
// conic gradient, so it needs no SVG.
import { useMemo } from 'react';
import { statusMixModel } from '@livediagram/items';
import { ViewFrame, viewState } from './view-frame';
import type { PlanViewProps } from './PlanViewView';

// Status colours in turn, distinct from each other on either surface; No status is the muted ink.
export const STATUS_COLOURS = [
  '#3b82f6',
  '#f59e0b',
  '#8b5cf6',
  '#16a34a',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#0ea5e9',
  '#a855f7',
  '#84cc16',
] as const;
const NO_NAMES = new Map<string, string>();

export function StatusMixView({ plan, items, palette, fontFamily, width, height }: PlanViewProps) {
  const model = useMemo(
    () => statusMixModel(items.values(), plan?.statusNames ?? NO_NAMES),
    [items, plan?.statusNames],
  );
  const colours = model.slices.map((s, i) =>
    s.status === null ? palette.muted : STATUS_COLOURS[i % STATUS_COLOURS.length]!,
  );
  // Each slice from where the ones before it end.
  const ends = model.slices.map((_, i) =>
    model.slices
      .slice(0, i + 1)
      .reduce((sum, s) => sum + (s.count / Math.max(1, model.total)) * 360, 0),
  );
  const stops = model.slices.map((_, i) => `${colours[i]} ${ends[i - 1] ?? 0}deg ${ends[i]}deg`);
  // The donut fills the height it has, and gives the legend at least half the width.
  const size = Math.max(48, Math.min(height - 72, width / 2 - 24, 260));
  return (
    <ViewFrame
      title="Status Breakdown"
      count={model.total}
      countLabel={`${model.total} ${model.total === 1 ? 'card' : 'cards'}`}
      palette={palette}
      fontFamily={fontFamily}
      state={viewState(plan, model.total > 0)}
      empty="No cards yet. Add cards to a board to see where they stand."
    >
      <div className="absolute inset-0 flex items-center gap-5 px-4 py-3">
        <div
          role="img"
          aria-label={model.slices.map((s) => `${s.label} ${s.count}`).join(', ')}
          className="relative flex shrink-0 items-center justify-center rounded-full"
          style={{
            width: size,
            height: size,
            background: `conic-gradient(${stops.join(', ')})`,
          }}
        >
          <span
            className="flex flex-col items-center justify-center rounded-full"
            style={{ width: size * 0.62, height: size * 0.62, backgroundColor: palette.surface }}
          >
            <strong className="text-[22px] font-semibold tabular-nums leading-none">
              <span className="text-optical-centre">{model.total}</span>
            </strong>
            <span className="mt-1 text-[11px]" style={{ color: palette.muted }}>
              <span className="text-optical-centre">{model.total === 1 ? 'card' : 'cards'}</span>
            </span>
          </span>
        </div>
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden text-[12px]">
          {model.slices.map((s, i) => (
            <li key={s.status ?? '-'} className="flex min-w-0 shrink-0 items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: colours[i] }}
              />
              <span
                className="min-w-0 flex-1 truncate"
                style={{ color: s.status === null ? palette.muted : palette.text }}
              >
                {s.label}
              </span>
              <span
                className="shrink-0 font-semibold tabular-nums"
                style={{ color: palette.muted }}
              >
                {s.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ViewFrame>
  );
}
