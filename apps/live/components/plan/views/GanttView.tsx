'use client';

// The Project Gantt Chart (docs/specs/025-plan/plan-views.md "Project Gantt Chart"): a row per Project card
// on a time axis, its bar from start to due date filled to the share of its children done, a diamond for a
// lone date, and a line for today. Divs and CSS, so it stays crisp at any zoom.
import { useMemo } from 'react';
import {
  ITEM_TYPES,
  ganttAt,
  ganttModel,
  itemTitle,
  typeIn,
  type GanttRow,
} from '@livediagram/items';
import { accentOn, type PlanPalette } from '../plan-palette';
import { OVERDUE_RED, PHASE_COLOURS, ViewFrame, openProps, viewState } from './view-frame';
import type { PlanViewProps } from './PlanViewView';

const ROW_H = 30;
const AXIS_H = 22;
const TICK_LABEL_PX = 52;
const NO_PHASES = new Map();

// The name column: at most 220 px, and never more than a third of the chart.
const GRID = { gridTemplateColumns: 'minmax(0, min(220px, 33%)) minmax(0, 1fr)' };

// A quiet way to a project's missing start: it opens the card, where Start sits before Due.
function AddStart({
  plan,
  row,
  palette,
}: {
  plan: PlanViewProps['plan'];
  row: GanttRow;
  palette: PlanPalette;
}) {
  if (!plan?.canEdit) return null;
  return (
    <button
      type="button"
      className="cursor-pointer whitespace-nowrap rounded px-1 text-[10px] underline-offset-2 transition hover:underline"
      style={{ color: palette.muted }}
      aria-label={`Add a start date to #${row.item.key} ${itemTitle(row.item)}`}
      {...openProps(plan, row.item.id)}
    >
      Add a start date
    </button>
  );
}

function Mark({
  row,
  model,
  colour,
  palette,
  plan,
}: {
  row: GanttRow;
  model: { from: number; to: number };
  colour: string;
  palette: PlanPalette;
  plan: PlanViewProps['plan'];
}) {
  if (row.mark === 'none' || row.from === undefined || row.to === undefined)
    return (
      <span
        className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[11px]"
        style={{ color: palette.muted }}
      >
        <span className="italic">No dates</span>
        <AddStart plan={plan} row={row} palette={palette} />
      </span>
    );
  const edge = row.overdue ? OVERDUE_RED : colour;
  const left = ganttAt(model, row.from) * 100;
  if (row.mark !== 'bar') {
    // A diamond on the day: filled for a due date, hollow for a start.
    const centre = (ganttAt(model, row.from) + ganttAt(model, row.from + 1)) * 50;
    // A due date alone offers its start, on whichever side of the diamond has room.
    const leftSide = centre > 60;
    return (
      <>
        <span
          aria-hidden
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2"
          style={{
            left: `${centre}%`,
            borderColor: edge,
            backgroundColor: row.mark === 'due' ? edge : palette.surface,
          }}
        />
        {row.mark === 'due' ? (
          <span
            className="absolute top-1/2 -translate-y-1/2"
            style={
              leftSide
                ? { right: `calc(${100 - centre}% + 10px)` }
                : { left: `calc(${centre}% + 10px)` }
            }
          >
            <AddStart plan={plan} row={row} palette={palette} />
          </span>
        ) : null}
      </>
    );
  }
  const width = (ganttAt(model, row.to + 1) - ganttAt(model, row.from)) * 100;
  const share = row.total ? row.done / row.total : row.isDone ? 1 : 0;
  return (
    <span
      aria-hidden
      className="absolute top-1/2 h-3.5 -translate-y-1/2 overflow-hidden rounded-full border"
      style={{
        left: `${left}%`,
        width: `max(${width}%, 6px)`,
        borderColor: edge,
        backgroundColor: `color-mix(in srgb, ${colour} 28%, ${palette.surface})`,
      }}
    >
      <span
        className="absolute inset-y-0 left-0"
        style={{
          width: `${share * 100}%`,
          backgroundColor: row.isDone ? PHASE_COLOURS.done : colour,
        }}
      />
    </span>
  );
}

export function GanttView({ plan, items, palette, fontFamily, width }: PlanViewProps) {
  const phases = plan?.statusPhases ?? NO_PHASES;
  const types = plan?.types ?? ITEM_TYPES;
  const now = new Date();
  const dayKey = now.toDateString();
  // Recomputed when the cards, the phases or the day change.
  const model = useMemo(
    () => ganttModel(items.values(), phases, new Date(dayKey)),
    [items, phases, dayKey],
  );
  const colour = accentOn(typeIn(types, 'project').color, palette);
  const n = model.rows.length;
  // Every tick keeps its gridline; labels thin out so each has room (about TICK_LABEL_PX).
  const axisPx = Math.max(1, width - Math.min(220, width / 3));
  const labelEvery = Math.max(1, Math.ceil((model.ticks.length * TICK_LABEL_PX) / axisPx));
  const today = (ganttAt(model, model.today) + ganttAt(model, model.today + 1)) * 50;
  return (
    <ViewFrame
      title="Project Gantt Chart"
      count={n}
      countLabel={`${n} ${n === 1 ? 'project' : 'projects'}`}
      palette={palette}
      fontFamily={fontFamily}
      state={viewState(plan, n > 0)}
      empty="No projects yet. Add a Project card to a board to see it here."
    >
      <div className="absolute inset-0 grid" style={GRID}>
        <div className="min-w-0 border-r" style={{ borderColor: palette.border }}>
          <div className="border-b" style={{ height: AXIS_H, borderColor: palette.border }} />
          {model.rows.map((row) => {
            const kids = row.total ? `${row.done}/${row.total}` : '';
            return (
              <button
                key={row.item.id}
                type="button"
                className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 px-3 text-left text-[12px] transition hover:bg-black/5 dark:hover:bg-white/10"
                style={{ height: ROW_H }}
                aria-label={`#${row.item.key} ${itemTitle(row.item)}${kids ? `, ${row.done} of ${row.total} done` : ''}`}
                {...openProps(plan, row.item.id)}
              >
                <span className="shrink-0 tabular-nums" style={{ color: palette.muted }}>
                  #{row.item.key}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{itemTitle(row.item)}</span>
                {kids ? (
                  <span
                    className="shrink-0 tabular-nums text-[11px]"
                    style={{ color: palette.muted }}
                  >
                    {kids}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="relative min-w-0 overflow-hidden">
          {/* The axis: a label and a gridline per tick. */}
          {model.ticks.map((t, i) => {
            const at = ganttAt(model, t.day) * 100;
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
          <div
            className="absolute inset-x-0 border-b"
            style={{ top: 0, height: AXIS_H, borderColor: palette.border }}
          />
          {model.rows.map((row, i) => (
            <div
              key={row.item.id}
              className="absolute inset-x-0 cursor-pointer"
              style={{ top: AXIS_H + i * ROW_H, height: ROW_H }}
              {...openProps(plan, row.item.id)}
            >
              <Mark row={row} model={model} colour={colour} palette={palette} plan={plan} />
            </div>
          ))}
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
      </div>
    </ViewFrame>
  );
}
