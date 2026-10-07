'use client';

// A Gantt row's mark (docs/specs/026-plan/plan-views.md "Gantt Chart"): a bar from start to due filled to
// the share of its children done, a diamond for a lone date, or nothing for no dates (the row is drawn on instead,
// gantt-draw.tsx); with the drag handles (gantt-drag.tsx) when the dates may be dragged.
import { ganttAt, type GanttRow } from '@livediagram/items';
import type { PlanPalette } from '../plan-palette';
import { OVERDUE_RED, PHASE_COLOURS } from './view-frame';
import { GanttBarGrab, GanttHandle, type GanttDragApi } from './gantt-drag';

export function Mark({
  row,
  model,
  colour,
  palette,
  drag,
}: {
  row: GanttRow;
  model: { from: number; to: number };
  colour: string;
  palette: PlanPalette;
  // Present when the dates may be dragged.
  drag?: GanttDragApi;
}) {
  if (row.mark === 'none' || row.from === undefined || row.to === undefined) return null;
  const edge = row.overdue ? OVERDUE_RED : colour;
  const left = ganttAt(model, row.from) * 100;
  if (row.mark !== 'bar') {
    // A diamond on the day: filled for a due date, hollow for a start.
    const centre = (ganttAt(model, row.from) + ganttAt(model, row.from + 1)) * 50;
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
        {drag ? (
          <GanttHandle
            row={row}
            edge="mark"
            at={centre}
            colour={edge}
            surface={palette.surface}
            drag={drag}
          />
        ) : null}
      </>
    );
  }
  const width = (ganttAt(model, row.to + 1) - ganttAt(model, row.from)) * 100;
  const share = row.total ? row.done / row.total : row.isDone ? 1 : 0;
  return (
    <>
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
      {drag ? (
        <>
          <GanttBarGrab row={row} left={left} width={width} drag={drag} />
          <GanttHandle
            row={row}
            edge="from"
            at={left}
            colour={edge}
            surface={palette.surface}
            drag={drag}
          />
          <GanttHandle
            row={row}
            edge="to"
            at={left + width}
            colour={edge}
            surface={palette.surface}
            drag={drag}
          />
        </>
      ) : null}
    </>
  );
}
