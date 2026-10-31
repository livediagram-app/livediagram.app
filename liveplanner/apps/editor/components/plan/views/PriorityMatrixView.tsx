'use client';

// Priority by Status (docs/specs/026-plan/plan-views.md "Priority by Status"): a grid of priority by status
// phase, each cell the cards in both, shaded by how many against the fullest cell. The cells share the view's
// area and their counts grow with them (view-layout matrixLayout).
import { useMemo } from 'react';
import {
  PRIORITY_LABELS,
  STATUS_PHASES,
  STATUS_PHASE_LABELS,
  priorityMatrixModel,
  cardsInStatuses,
} from '@liveplanner/items';
import { PRIORITY_COLOURS } from '../plan-palette';
import { PHASE_COLOURS, ViewFrame, viewState } from './view-frame';
import { matrixLayout } from './view-layout';
import type { PlanViewProps } from './PlanViewView';

const NO_PHASES = new Map();
// The Statuses setting leaves nothing (docs/specs/026-plan/plan-views.md "Statuses").
const NO_MATCH = 'No cards in the chosen statuses.';

export function PriorityMatrixView({
  plan,
  items,
  palette,
  fontFamily,
  width,
  height,
  settings,
}: PlanViewProps) {
  const phases = plan?.statusPhases ?? NO_PHASES;
  // Only the cards in the chosen statuses, when the view names some.
  const statuses = settings.statuses;
  const counted = useMemo(() => cardsInStatuses(items, statuses), [items, statuses]);
  const model = useMemo(() => priorityMatrixModel(counted.values(), phases), [counted, phases]);
  const layout = matrixLayout(width, height, model.rows.length);
  return (
    <ViewFrame
      title="Priority by Status"
      count={model.total}
      countLabel={`${model.total} ${model.total === 1 ? 'card' : 'cards'}`}
      palette={palette}
      fontFamily={fontFamily}
      state={viewState(plan, model.total > 0)}
      empty={
        settings.statuses ? NO_MATCH : 'No cards yet. Add cards to a board to see where they stand.'
      }
    >
      <div
        role="table"
        aria-label="Cards by priority and status"
        className="absolute inset-0 grid p-3"
        style={{
          gap: layout.gap,
          fontSize: layout.labelFont,
          gridTemplateColumns: `minmax(0, ${layout.labelColumn}px) repeat(3, minmax(0, 1fr))`,
          gridTemplateRows: `auto repeat(${model.rows.length}, minmax(0, 1fr))`,
        }}
      >
        {/* The header row: a table's column headers sit in a row, as its cells do, and the corner names the
            priority column for a screen reader (it draws nothing). */}
        <div role="row" className="contents">
          <span role="columnheader" className="min-w-0">
            <span className="sr-only">Priority</span>
          </span>
          {STATUS_PHASES.map((p) => (
            <span
              key={p}
              role="columnheader"
              className="flex min-w-0 items-center justify-center gap-1.5 truncate pb-1 font-semibold"
              style={{ color: palette.muted, fontSize: layout.labelFont - 1 }}
            >
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: PHASE_COLOURS[p] }}
              />
              <span className="truncate">{STATUS_PHASE_LABELS[p]}</span>
            </span>
          ))}
        </div>
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
                    className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-md font-semibold tabular-nums"
                    style={{
                      fontSize: layout.countFont,
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
