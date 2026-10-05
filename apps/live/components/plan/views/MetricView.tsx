'use client';

// A metric (docs/specs/025-plan/plan-views.md "Metrics"): a board widget free on the canvas,
// drawn as in a header, over every live card. It narrows nothing and offers no set-up.
import { useMemo } from 'react';
import { ITEM_TYPES, metricBoard, type MetricKind } from '@livediagram/items';
import { BOARD_WIDGET_INFO } from '../board-widget-catalogue';
import { BoardWidgetView, type WidgetContext } from '../widgets/BoardWidgetView';
import type { PlanViewProps } from './PlanViewView';

const noop = () => {};
const NO_QUICK = {};
const NO_PHASES = new Map();

export function MetricView({
  kind,
  plan,
  items,
  palette,
  fontFamily,
}: PlanViewProps & { kind: MetricKind }) {
  const types = plan?.types ?? ITEM_TYPES;
  const phases = plan?.statusPhases ?? NO_PHASES;
  const board = useMemo(() => metricBoard(items.values(), phases, types), [items, phases, types]);
  const openItem = plan?.openItem ?? noop;
  const ctx: WidgetContext = {
    setup: board.setup,
    projection: board.projection,
    items: board.items,
    types,
    palette,
    quick: NO_QUICK,
    onQuick: noop,
    canFilterMine: null,
    votesLeft: null,
    trayOpen: false,
    onToggleTray: noop,
    now: new Date(),
    canEdit: false,
    onSetup: noop,
    onOpenItem: openItem,
  };
  const label = BOARD_WIDGET_INFO[kind].label;
  return (
    <div
      className="absolute inset-0 flex flex-col justify-center gap-1 overflow-hidden rounded-xl border px-3 py-1.5"
      style={{
        borderColor: palette.border,
        backgroundColor: palette.surface,
        color: palette.text,
        ...(fontFamily ? { fontFamily } : null),
      }}
      role="group"
      aria-label={`${label}, every card`}
    >
      <span
        className="truncate text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: palette.muted }}
      >
        {label}
      </span>
      {plan?.status === 'loading' ? (
        <span className="text-[12px]" style={{ color: palette.muted }}>
          Loading cards…
        </span>
      ) : (
        // A press on the widget's own buttons stays with it in Plan mode; elsewhere it moves the element.
        <div
          className="flex min-w-0 items-center overflow-hidden"
          onPointerDown={
            plan?.planInput
              ? (e) => {
                  if ((e.target as HTMLElement).closest('button')) e.stopPropagation();
                }
              : undefined
          }
        >
          <BoardWidgetView kind={kind} ctx={ctx} />
        </div>
      )}
    </div>
  );
}
