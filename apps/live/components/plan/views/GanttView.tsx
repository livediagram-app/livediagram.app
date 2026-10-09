'use client';

// The Gantt Chart (docs/specs/026-plan/plan-views.md "Gantt Chart"): a row per card of its card types (Project
// by default)
// on a time axis, its bar from start to due date filled to the share of its children done, a diamond for a
// lone date, and a line for today. Divs and CSS, so it stays crisp at any zoom. To someone who may edit, a
// bar's ends and a diamond drag their dates (gantt-drag.tsx), and the names column resizes
// (gantt-names-resize.tsx). Rows may sit in swimlanes, laid out top down in one pass (ganttLayout), in the chart's
// own row order when it has one; a row's grip drags it to a new place (useGanttRowReorder).
import { useMemo, useRef, useState } from 'react';
import { IDENTITY_FILL, identityVars } from '@livediagram/ui';
import {
  ITEM_TYPES,
  ganttAt,
  ganttLanes,
  ganttLayout,
  ganttModel,
  ganttOrderRows,
  ganttShownTypes,
  ganttNamesWidth,
  itemColourOf,
  itemTitle,
  typeIn,
  type GanttRow,
} from '@livediagram/items';
import { accentOn } from '../plan-palette';
import { OVERDUE_RED, ViewFrame, openProps, viewState } from './view-frame';
import type { PlanViewProps } from './PlanViewView';
import { track } from '@/lib/telemetry';
import { ganttPreviewLabel, useGanttDrag } from './gantt-drag';
import { useGanttWindow } from './useGanttWindow';
import { GanttDrawRow } from './gantt-draw';
import { GanttScaleControls } from './GanttScaleControls';
import { Mark } from './gantt-mark';
import { GANTT_PILL_MIN_COLUMN_PX, GanttLaneHead, GanttNameRow, rowStatus } from './gantt-rows';
import { GanttNamesResizer } from './gantt-names-resize';
import { useGanttRowReorder } from './useGanttRowReorder';

const ROW_H = 30;
// A swimlane's header row.
const LANE_H = 24;
const AXIS_H = 22;
const TICK_LABEL_PX = 52;
const NO_PHASES = new Map();

// The names column by default: at most 220 px, and never more than a third of the chart.
const DEFAULT_NAMES_PX = (chartPx: number) => Math.min(220, Math.floor(chartPx / 3));

export function GanttView({
  plan,
  items,
  palette,
  fontFamily,
  width,
  elementId,
  settings,
}: PlanViewProps) {
  const phases = plan?.statusPhases ?? NO_PHASES;
  const types = plan?.types ?? ITEM_TYPES;
  const now = new Date();
  const dayKey = now.toDateString();
  // The card types the chart draws: its own (else Project), of those offering Start and Due (plan-views.md
  // "Card types").
  const accepted = ganttShownTypes(settings, types);
  const acceptedKey = accepted.join(',');
  // Recomputed when the cards, the phases, the accepted types or the day change.
  const model = useMemo(
    () => ganttModel(items.values(), phases, new Date(dayKey), acceptedKey.split(',')),
    [items, phases, dayKey, acceptedKey],
  );
  // A card's own Colour draws its bar and diamond, else its card type's colour (docs/specs/026-plan/items.md
  // "Colour"); either is lifted on a dark surface like a type accent.
  const colourOf = (row: GanttRow) => {
    const own = itemColourOf(row.item);
    return accentOn(own ?? typeIn(types, row.item.type).color, palette);
  };
  const n = model.rows.length;
  // The chart's own row order first (plan-views.md "Row order"), the rest in date order.
  const rowOrder = settings.rowOrder;
  const ordered = useMemo(() => ganttOrderRows(model.rows, rowOrder), [model.rows, rowOrder]);
  // The names column: the chart's saved width (a drag's preview while one is in flight), else the default.
  const [namesPreview, setNamesPreview] = useState<number | null>(null);
  const saved = settings.namesWidth;
  const namesPx =
    namesPreview ?? (saved !== undefined ? ganttNamesWidth(saved, width) : DEFAULT_NAMES_PX(width));
  // Swimlanes (the element's own setting) and the lanes this person has collapsed.
  const lanes = useMemo(
    () =>
      ganttLanes(
        ordered,
        settings.swimlaneBy,
        settings.swimlaneField,
        items,
        types,
        plan?.statusNames,
      ),
    [ordered, settings.swimlaneBy, settings.swimlaneField, items, types, plan?.statusNames],
  );
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const layout = ganttLayout(lanes, collapsed, ROW_H, LANE_H);
  const toggleLane = (key: string) =>
    setCollapsed((was) => {
      const next = new Set(was);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // Every tick keeps its gridline; labels thin out so each has room (about TICK_LABEL_PX).
  const axisPx = Math.max(1, width - namesPx);
  const trackRef = useRef<HTMLDivElement>(null);
  const editable = !!plan?.canEdit && !!plan?.planInput;
  // The viewer's own scale and window over the timeline (useGanttWindow).
  const timeline = useGanttWindow({
    model,
    trackRef,
    interactive: !!plan?.planInput,
    ready: viewState(plan, n > 0) === 'ready',
  });
  const view = timeline.view;
  const labelEvery = Math.max(1, Math.ceil((view.ticks.length * TICK_LABEL_PX) / axisPx));
  const today = (ganttAt(view, model.today) + ganttAt(view, model.today + 1)) * 50;
  const drag = useGanttDrag({
    model: view,
    trackRef,
    onCommit: (itemId, patch) => {
      plan?.patchItem(itemId, patch);
      track('Plan', 'Changed', 'GanttDates');
    },
    onBegin: timeline.pin,
  });
  const { preview } = drag;
  // Reordering rows: every row's id as shown, and each row's lane (its rows' ids, in order).
  const rowIds = lanes.flatMap((l) => l.rows.map((r) => r.item.id));
  const laneOf = (id: string) =>
    lanes.find((l) => l.rows.some((r) => r.item.id === id))?.rows.map((r) => r.item.id) ?? [];
  const reorder = useGanttRowReorder({
    rowIds,
    rowH: ROW_H,
    onCommit: (order) => {
      plan?.updateView(elementId, { ...settings, rowOrder: order });
      track('Plan', 'Changed', 'GanttRowOrder');
    },
  });
  const lifted = reorder.drag;
  const topOf = (id: string) => {
    const at = layout.entries.find((e) => e.kind === 'row' && e.row.item.id === id);
    return at ? at.top : null;
  };
  // Where the dragged row would drop: a line above the lane's row at its target place (below it, moving down).
  const dropLine = (() => {
    if (!lifted || lifted.to === lifted.from) return null;
    const top = topOf(lifted.laneIds[lifted.to]!);
    if (top === null) return null;
    return AXIS_H + top + (lifted.to > lifted.from ? ROW_H : 0) - 1;
  })();
  const rowReorder = (row: GanttRow) =>
    editable
      ? {
          onGripDown: (el: HTMLElement | null) =>
            reorder.begin(row.item.id, laneOf(row.item.id), el),
          onMove: (by: -1 | 1) => {
            const lane = laneOf(row.item.id);
            const to = reorder.move(row.item.id, lane, by);
            if (to !== null)
              plan?.announce(
                `Moved #${row.item.key} ${itemTitle(row.item)} to position ${to + 1} of ${lane.length}`,
              );
          },
        }
      : undefined;
  const liftOf = (id: string) => (lifted?.itemId === id ? lifted.dy : undefined);
  return (
    <ViewFrame
      title="Gantt Chart"
      count={n}
      countLabel={`${n} ${n === 1 ? 'card' : 'cards'}`}
      palette={palette}
      fontFamily={fontFamily}
      state={viewState(plan, n > 0)}
      empty="No cards of these types yet."
      aside={
        plan?.planInput ? <GanttScaleControls timeline={timeline} palette={palette} /> : undefined
      }
    >
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `${namesPx}px minmax(0, 1fr)` }}
      >
        <div className="relative min-w-0 border-r" style={{ borderColor: palette.border }}>
          <div className="border-b" style={{ height: AXIS_H, borderColor: palette.border }} />
          {layout.entries.map((e) =>
            e.kind === 'lane' ? (
              <GanttLaneHead
                key={`lane:${e.lane.key}`}
                lane={e.lane}
                count={e.count}
                collapsed={e.collapsed}
                types={types}
                palette={palette}
                top={AXIS_H + e.top}
                height={LANE_H}
                onToggle={() => toggleLane(e.lane.key)}
              />
            ) : (
              <GanttNameRow
                key={e.row.item.id}
                row={e.row}
                status={rowStatus(e.row, phases, plan?.statusNames)}
                narrow={namesPx < GANTT_PILL_MIN_COLUMN_PX}
                plan={plan}
                palette={palette}
                top={AXIS_H + e.top}
                height={ROW_H}
                reorder={rowReorder(e.row)}
                lift={liftOf(e.row.item.id)}
              />
            ),
          )}
          {dropLine !== null ? <DropLine top={dropLine} colour={palette.focus} /> : null}
        </div>
        <div
          ref={trackRef}
          data-own-wheel-x={plan?.planInput ? '' : undefined}
          className={`relative min-w-0 overflow-hidden ${plan?.planInput ? 'touch-none' : ''}`}
        >
          {/* The axis: a label and a gridline per tick. */}
          {view.ticks.map((t, i) => {
            const at = ganttAt(view, t.day) * 100;
            return (
              <div key={t.day}>
                {i % labelEvery === 0 ? (
                  <span
                    className="absolute whitespace-nowrap pl-1 text-[10px] tabular-nums"
                    style={{ left: `${at}%`, top: 4, color: palette.muted }}
                  >
                    {t.label}
                  </span>
                ) : null}
                <span
                  aria-hidden
                  className="absolute bottom-0 w-px"
                  style={{ left: `${at}%`, top: AXIS_H, backgroundColor: palette.border }}
                />
              </div>
            );
          })}
          {/* The axis strip: shows the timeline pans (a drag anywhere on it does, useGanttWindow). */}
          <div
            className={`absolute inset-x-0 border-b ${plan?.planInput ? 'cursor-grab active:cursor-grabbing' : ''}`}
            style={{ top: 0, height: AXIS_H, borderColor: palette.border }}
          />
          {/* A swimlane's header band across the timeline. */}
          {layout.entries.map((e) =>
            e.kind === 'lane' ? (
              <div
                key={`band:${e.lane.key}`}
                aria-hidden
                className="absolute inset-x-0"
                style={{ top: AXIS_H + e.top, height: LANE_H, backgroundColor: palette.column }}
              />
            ) : null,
          )}
          {layout.entries.map((e) => {
            if (e.kind !== 'row') return null;
            const row: GanttRow = e.row;
            const dragged = preview?.itemId === row.item.id;
            const shown = dragged ? { ...row, from: preview.from, to: preview.to } : row;
            const lift = liftOf(row.item.id);
            return (
              <div
                key={row.item.id}
                className={`group absolute inset-x-0 cursor-pointer ${lift !== undefined ? 'z-20' : ''}`}
                style={{
                  top: AXIS_H + e.top,
                  height: ROW_H,
                  ...(lift !== undefined ? { transform: `translateY(${lift}px)` } : {}),
                }}
                {...openProps(plan, row.item.id)}
              >
                {editable && row.mark === 'none' ? (
                  <GanttDrawRow
                    row={row}
                    view={view}
                    trackRef={trackRef}
                    colour={colourOf(row)}
                    onCommit={(itemId, patch) => {
                      plan?.patchItem(itemId, patch);
                      track('Plan', 'Changed', 'GanttDrawn');
                    }}
                    onBegin={timeline.pin}
                  />
                ) : null}
                <Mark
                  row={shown}
                  model={view}
                  colour={colourOf(row)}
                  palette={palette}
                  {...(editable ? { drag } : {})}
                />
                {dragged ? (
                  // The day the dragged end lands on above it, or a moved bar's two days above its middle.
                  <span
                    className={`pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow ${IDENTITY_FILL}`}
                    style={{
                      ...identityVars(colourOf(row)),
                      left: `${
                        preview.whole
                          ? (ganttAt(view, preview.from) + ganttAt(view, preview.to + 1)) * 50
                          : (ganttAt(view, preview.day) + ganttAt(view, preview.day + 1)) * 50
                      }%`,
                      top: -14,
                    }}
                  >
                    {ganttPreviewLabel(preview)}
                  </span>
                ) : null}
              </div>
            );
          })}
          {dropLine !== null ? <DropLine top={dropLine} colour={palette.focus} /> : null}
          {/* Today. */}
          <span
            aria-hidden
            className="absolute bottom-0 w-0.5"
            style={{ left: `${today}%`, top: AXIS_H - 4, backgroundColor: OVERDUE_RED }}
          />
          <span
            className="absolute rounded px-1 text-[9px] font-semibold uppercase"
            style={{
              left: `${today}%`,
              bottom: 4,
              transform: 'translateX(-50%)',
              backgroundColor: OVERDUE_RED,
              color: '#ffffff',
            }}
          >
            Today
          </span>
        </div>
        {editable ? (
          <GanttNamesResizer
            width={namesPx}
            chartPx={width}
            palette={palette}
            onPreview={setNamesPreview}
            onCommit={(next) => {
              plan?.updateView(elementId, { ...settings, namesWidth: next });
              track('Plan', 'Changed', 'GanttNamesWidth');
            }}
          />
        ) : null}
      </div>
    </ViewFrame>
  );
}

// The gap a dragged row would drop into, across its column.
function DropLine({ top, colour }: { top: number; colour: string }) {
  return (
    <span
      aria-hidden
      data-gantt-drop-line
      className="pointer-events-none absolute inset-x-0 z-30 h-0.5 rounded-full"
      style={{ top, backgroundColor: colour }}
    />
  );
}
