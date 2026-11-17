'use client';

// The Gantt Chart's dependency arrows (docs/specs/026-plan/plan-views.md "Dependency arrows"): an elbow from each
// blocker's mark to the mark of each row it blocks, in the chart's muted ink, a done blocker's fainter, and in the clash
// amber where the blocked mark starts before its open blocker is due ("Dependency clashes"). One SVG over
// the timeline, under the marks' pointer handling (it takes no pointer) and hidden from screen readers (the card panel
// lists the links). It follows a mark being dragged and a row being lifted.
import {
  ganttArrowPath,
  ganttAt,
  ganttClashDays,
  ganttMarkEnds,
  type GanttArrow,
  type GanttModel,
  type GanttRow,
} from '@liveplanner/items';
import type { PlanPalette } from '../plan-palette';
import { CLASH_AMBER } from './view-frame';

// A diamond is a 14 px square turned 45 degrees: about 10 px from its centre to a corner.
const DIAMOND_HALF = 10;

export function GanttArrows({
  arrows,
  view,
  axisPx,
  top,
  rowH,
  palette,
  shownOf,
  liftOf,
}: {
  // The chart's arrows (ganttArrows over its laid-out rows).
  arrows: readonly GanttArrow[];
  view: Pick<GanttModel, 'from' | 'to'>;
  // The timeline's width in px.
  axisPx: number;
  // The rows' offset from the track's top (the axis strip).
  top: number;
  rowH: number;
  palette: PlanPalette;
  // A row as drawn: a dragged mark's preview dates.
  shownOf: (row: GanttRow) => GanttRow;
  liftOf: (id: string) => number | undefined;
}) {
  if (!arrows.length) return null;
  const x = (day: number) => ganttAt(view, day) * axisPx;
  const midY = (at: { row: GanttRow; top: number }) =>
    top + at.top + rowH / 2 + (liftOf(at.row.item.id) ?? 0);
  return (
    <svg
      aria-hidden
      data-gantt-arrows=""
      className="pointer-events-none absolute inset-0 z-10 overflow-visible"
      width="100%"
      height="100%"
    >
      {arrows.map((a) => {
        const fromRow = shownOf(a.from.row);
        const toRow = shownOf(a.to.row);
        const from = ganttMarkEnds(fromRow, x, DIAMOND_HALF);
        const to = ganttMarkEnds(toRow, x, DIAMOND_HALF);
        // Worked out from the rows as shown, so a drag shows a clash come and go.
        const clash = ganttClashDays({ ...fromRow, isDone: a.done }, toRow) !== null;
        const { d, head } = ganttArrowPath(
          { x: from.right, y: midY(a.from) },
          { x: to.left, y: midY(a.to) },
          rowH,
        );
        return (
          <g
            key={`${a.from.row.item.id}>${a.to.row.item.id}`}
            data-gantt-arrow=""
            data-clash={clash ? '' : undefined}
            opacity={a.done ? 0.4 : 1}
            color={clash ? CLASH_AMBER : palette.muted}
          >
            <path
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            <path d={head} fill="currentColor" />
          </g>
        );
      })}
    </svg>
  );
}
