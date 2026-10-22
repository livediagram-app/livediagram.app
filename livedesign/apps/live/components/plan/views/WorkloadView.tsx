'use client';

// Cards by Field (docs/specs/026-plan/plan-views.md "Cards by Field", once Workload by Person): a bar per value of
// the field it groups by (Assignee unless set: a person, a priority, a type, a state, a label, a custom field's
// value), and the empty group last, as long as their cards against the most, split Not Started, In Progress and
// Done. The rows share the view's height and the bars thicken, and labels grow, where there is room.
import { useMemo } from 'react';
import { plural } from '@livepages/document';
import {
  STATUS_PHASES,
  STATUS_PHASE_LABELS,
  breakdownGroupingOf,
  breakdownTitle,
  breakdownModel,
  cardsInStatuses,
} from '@livepages/items';
import { PersonDisc } from '../PersonDisc';
import { PHASE_COLOURS, PhaseLegend, ViewFrame, viewState } from './view-frame';
import { workloadLayout } from './view-layout';
import type { PlanViewProps } from './PlanViewView';

const NO_PHASES = new Map();
// The Statuses setting leaves nothing (docs/specs/026-plan/plan-views.md "Statuses").
const NO_MATCH = 'No cards in the chosen statuses.';

export function WorkloadView({
  plan,
  items,
  palette,
  fontFamily,
  width,
  height,
  settings,
}: PlanViewProps) {
  const phases = plan?.statusPhases ?? NO_PHASES;
  const { by, field } = breakdownGroupingOf(settings);
  const types = plan?.types;
  const statusNames = plan?.statusNames;
  // Only the cards in the chosen statuses, when the view names some.
  const statuses = settings.statuses;
  const counted = useMemo(() => cardsInStatuses(items, statuses), [items, statuses]);
  const model = useMemo(
    () => breakdownModel(counted.values(), phases, { by, field }, types, statusNames, plan?.items),
    [counted, phases, by, field, types, statusNames, plan?.items],
  );
  const layout = workloadLayout(width, height, model.rows.length);
  return (
    <ViewFrame
      title={breakdownTitle({ by, field }, types)}
      count={model.total}
      countLabel={`${model.total} ${model.total === 1 ? 'card' : 'cards'}`}
      palette={palette}
      fontFamily={fontFamily}
      state={viewState(plan, model.total > 0)}
      empty={
        settings.statuses ? NO_MATCH : 'No cards yet. Add cards to a board to see how they split.'
      }
    >
      <div className="absolute inset-0 flex flex-col gap-1 p-3">
        <div className="flex shrink-0 justify-end" style={{ minHeight: 20 }}>
          <PhaseLegend palette={palette} />
        </div>
        {/* Centred only while every row fits: centring an overflowing list would push its top rows above the
            scroll origin, out of reach. */}
        <ul
          className={`flex min-h-0 flex-1 flex-col ${layout.scrolls ? 'overflow-y-auto' : 'justify-center overflow-hidden'}`}
        >
          {model.rows.map((row) => {
            const name = row.label;
            const spoken = STATUS_PHASES.map(
              (p) => `${row.counts[p]} ${STATUS_PHASE_LABELS[p].toLowerCase()}`,
            ).join(', ');
            return (
              <li
                key={row.key}
                className="grid shrink-0 items-center gap-3"
                style={{
                  gridTemplateColumns: `minmax(0, ${layout.labelColumn}px) minmax(0, 1fr)`,
                  height: layout.rowHeight,
                  fontSize: layout.font,
                }}
                aria-label={`${name}: ${plural(row.total, 'card')}, ${spoken}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {row.person ? (
                    <PersonDisc person={row.person} />
                  ) : by === 'assignee' ? (
                    <span
                      aria-hidden
                      className="h-5 w-5 shrink-0 rounded-full border border-dashed"
                      style={{ borderColor: palette.muted }}
                    />
                  ) : null}
                  <span
                    className="min-w-0 truncate"
                    style={{ color: row.empty ? palette.muted : palette.text }}
                  >
                    {name}
                  </span>
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    data-bar
                    className="flex min-w-0 overflow-hidden rounded"
                    style={{ width: `${(row.total / model.max) * 100}%`, height: layout.bar }}
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
                    className="shrink-0 font-semibold tabular-nums"
                    style={{ color: palette.muted, fontSize: layout.countFont }}
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
