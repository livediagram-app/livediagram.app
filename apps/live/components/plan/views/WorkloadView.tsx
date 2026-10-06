'use client';

// Workload by Person (docs/specs/026-plan/plan-views.md "Workload by Person"): a bar per assignee, and
// Unassigned, as long as their cards against the busiest, split Not Started, In Progress and Done.
import { useMemo } from 'react';
import { STATUS_PHASES, STATUS_PHASE_LABELS, workloadModel } from '@livediagram/items';
import { PersonDisc } from '../PersonDisc';
import { PHASE_COLOURS, PhaseLegend, ViewFrame, viewState } from './view-frame';
import type { PlanViewProps } from './PlanViewView';

const NO_PHASES = new Map();

export function WorkloadView({ plan, items, palette, fontFamily }: PlanViewProps) {
  const phases = plan?.statusPhases ?? NO_PHASES;
  const model = useMemo(() => workloadModel(items.values(), phases), [items, phases]);
  return (
    <ViewFrame
      title="Workload by Person"
      count={model.total}
      countLabel={`${model.total} ${model.total === 1 ? 'card' : 'cards'}`}
      palette={palette}
      fontFamily={fontFamily}
      state={viewState(plan, model.total > 0)}
      empty="No cards yet. Add cards to a board to see who has what."
    >
      <div className="absolute inset-0 flex flex-col gap-2 px-3 py-2.5">
        <PhaseLegend palette={palette} />
        <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
          {model.rows.map((row) => {
            const name = row.person?.name ?? 'Unassigned';
            const spoken = STATUS_PHASES.map(
              (p) => `${row.counts[p]} ${STATUS_PHASE_LABELS[p].toLowerCase()}`,
            ).join(', ');
            return (
              <li
                key={row.person?.id ?? '-'}
                className="grid shrink-0 items-center gap-2 text-[12px]"
                style={{ gridTemplateColumns: 'minmax(0, min(160px, 30%)) minmax(0, 1fr)' }}
                aria-label={`${name}: ${row.total} cards, ${spoken}`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {row.person ? (
                    <PersonDisc person={row.person} />
                  ) : (
                    <span
                      aria-hidden
                      className="h-5 w-5 shrink-0 rounded-full border border-dashed"
                      style={{ borderColor: palette.muted }}
                    />
                  )}
                  <span
                    className="min-w-0 truncate"
                    style={{ color: row.person ? palette.text : palette.muted }}
                  >
                    {name}
                  </span>
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="flex h-4 min-w-0 overflow-hidden rounded"
                    style={{ width: `${(row.total / model.max) * 100}%` }}
                  >
                    {STATUS_PHASES.map((p) =>
                      row.counts[p] ? (
                        <span
                          key={p}
                          style={{
                            flexGrow: row.counts[p],
                            flexBasis: 0,
                            backgroundColor: PHASE_COLOURS[p],
                          }}
                        />
                      ) : null,
                    )}
                  </span>
                  <span
                    className="shrink-0 text-[11px] font-semibold tabular-nums"
                    style={{ color: palette.muted }}
                  >
                    {row.total}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </ViewFrame>
  );
}
