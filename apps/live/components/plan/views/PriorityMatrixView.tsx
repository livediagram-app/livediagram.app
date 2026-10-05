'use client';

// Priority by Status (docs/specs/026-plan/plan-views.md "Priority by Status"): a grid of priority by status
// phase, each cell the cards in both, shaded by how many against the fullest cell.
import { useMemo } from 'react';
import {
  PRIORITY_LABELS,
  STATUS_PHASES,
  STATUS_PHASE_LABELS,
  priorityMatrixModel,
} from '@livediagram/items';
import { PRIORITY_COLOURS } from '../plan-palette';
import { PHASE_COLOURS, ViewFrame, viewState } from './view-frame';
import type { PlanViewProps } from './PlanViewView';

const NO_PHASES = new Map();

export function PriorityMatrixView({ plan, items, palette, fontFamily }: PlanViewProps) {
  const phases = plan?.statusPhases ?? NO_PHASES;
  const model = useMemo(() => priorityMatrixModel(items.values(), phases), [items, phases]);
  return (
    <ViewFrame
      title="Priority by Status"
      count={model.total}
      countLabel={`${model.total} ${model.total === 1 ? 'card' : 'cards'}`}
      palette={palette}
      fontFamily={fontFamily}
      state={viewState(plan, model.total > 0)}
      empty="No cards yet. Add cards to a board to see where they stand."
    >
      <div
        role="table"
        aria-label="Cards by priority and status"
        className="absolute inset-0 grid gap-1 p-3 text-[12px]"
        style={{
          gridTemplateColumns: 'minmax(0, min(120px, 25%)) repeat(3, minmax(0, 1fr))',
          gridTemplateRows: `auto repeat(${model.rows.length}, minmax(0, 1fr))`,
        }}
      >
        <span role="columnheader" />
        {STATUS_PHASES.map((p) => (
          <span
            key={p}
            role="columnheader"
            className="flex min-w-0 items-center justify-center gap-1.5 truncate pb-1 text-[11px] font-semibold"
            style={{ color: palette.muted }}
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: PHASE_COLOURS[p] }}
            />
            <span className="truncate">{STATUS_PHASE_LABELS[p]}</span>
          </span>
        ))}
        {model.rows.map((row) => {
          const label = row.priority ? PRIORITY_LABELS[row.priority] : 'No Priority';
          const tint = row.priority ? PRIORITY_COLOURS[row.priority] : palette.muted;
          return (
            <div key={row.priority ?? '-'} role="row" className="contents">
              <span
                role="rowheader"
                className="flex min-w-0 items-center gap-1.5 truncate font-medium"
                style={{ color: row.priority ? palette.text : palette.muted }}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: tint }}
                />
                <span className="truncate">{label}</span>
              </span>
              {STATUS_PHASES.map((p) => {
                const n = row.counts[p];
                const share = model.max ? n / model.max : 0;
                return (
                  <span
                    key={p}
                    role="cell"
                    aria-label={`${label}, ${STATUS_PHASE_LABELS[p]}: ${n}`}
                    className="flex min-h-0 items-center justify-center rounded-md font-semibold tabular-nums"
                    style={{
                      backgroundColor: n
                        ? `color-mix(in srgb, ${tint} ${Math.round(12 + share * 48)}%, ${palette.surface})`
                        : palette.column,
                      color: n ? palette.text : 'transparent',
                    }}
                  >
                    {n || ''}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </ViewFrame>
  );
}
