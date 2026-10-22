'use client';

// A metric (docs/specs/026-plan/plan-views.md "Metrics"): a board widget free on the canvas,
// drawn as in a header, over every live card. It narrows nothing and offers no set-up.
import { useMemo } from 'react';
import { useToday } from '@/hooks/ui/useToday';
import { ITEM_TYPES, metricBoard, type MetricKind } from '@liveplanner/items';
import { BoardWidgetView, type WidgetContext } from '../widgets/BoardWidgetView';
import type { PlanViewProps } from './PlanViewView';
import { MetricTile } from './MetricTile';
import { BOARD_WIDGET_INFO, metricModel, metricTier } from '@liveplanner/plan-art';

const noop = () => {};
const NO_QUICK = {};
const NO_PHASES = new Map();

export function MetricView({
  kind,
  plan,
  items,
  palette,
  fontFamily,
  width,
  height,
}: PlanViewProps & { kind: MetricKind }) {
  const types = plan?.types ?? ITEM_TYPES;
  const phases = plan?.statusPhases ?? NO_PHASES;
  const board = useMemo(() => metricBoard(items.values(), phases, types), [items, phases, types]);
  const openItem = plan?.openItem ?? noop;
  // One clock for the day: the tile's model and the widget read the same now, which moves on at midnight so a due or
  // overdue count rolls over (useToday).
  const now = useToday();
  const ctx: WidgetContext = {
    setup: board.setup,
    projection: board.projection,
    items: board.items,
    types,
    palette,
    quick: NO_QUICK,
    onQuick: noop,
    canFilterMine: null,
    trayOpen: false,
    onToggleTray: noop,
    now,
    canEdit: false,
    onSetup: noop,
    onOpenItem: openItem,
  };
  const label = BOARD_WIDGET_INFO[kind].label;
  // With room (a Dashboard slot, or sized up on the canvas), a tile; at its small canvas size, the header widget.
  const tier = metricTier(width, height);
  const model = useMemo(() => metricModel(kind, board, types, now), [kind, board, types, now]);
  if (tier !== 'pill')
    return (
      <div
        className="absolute inset-0"
        onPointerDown={
          plan
            ? (e) => {
                if ((e.target as HTMLElement).closest('button')) e.stopPropagation();
              }
            : undefined
        }
      >
        <MetricTile
          kind={kind}
          label={label}
          model={model}
          tier={tier}
          width={width}
          height={height}
          palette={palette}
          fontFamily={fontFamily}
          loading={plan?.status === 'loading'}
          onOpenItem={plan?.openItem}
        />
      </div>
    );
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
            plan
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
