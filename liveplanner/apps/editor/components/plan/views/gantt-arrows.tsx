'use client';

// The Gantt Chart's dependency arrows (docs/specs/026-plan/plan-views.md "Dependency arrows"): an elbow from each
// blocker's mark to the mark of each row it blocks, in the chart's muted ink, a done blocker's fainter. One SVG over
// the timeline, under the marks' pointer handling (it takes no pointer) and hidden from screen readers (the card panel
// lists the links). It follows a mark being dragged and a row being lifted.
import {
  ganttArrowPath,
  ganttArrows,
  ganttAt,
  ganttMarkEnds,
  type BlockingIndex,
  type ganttLayout,
  type GanttModel,
  type GanttRow,
  type StatusPhase,
} from '@liveplanner/items';
import type { PlanPalette } from '../plan-palette';

// A diamond is a 14 px square turned 45 degrees: about 10 px from its centre to a corner.
const DIAMOND_HALF = 10;

export function GanttArrows({
  entries,
  index,
  phases,
  view,
  axisPx,
  top,
  rowH,
  palette,
  shownOf,
  liftOf,
}: {
  entries: ReturnType<typeof ganttLayout>['entries'];
  index: BlockingIndex;
  phases: ReadonlyMap<string, StatusPhase>;
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
  const arrows = ganttArrows(entries, index, phases);
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
        const from = ganttMarkEnds(shownOf(a.from.row), x, DIAMOND_HALF);
        const to = ganttMarkEnds(shownOf(a.to.row), x, DIAMOND_HALF);
        const { d, head } = ganttArrowPath(
          { x: from.right, y: midY(a.from) },
          { x: to.left, y: midY(a.to) },
          rowH,
        );
        return (
          <g
            key={`${a.from.row.item.id}>${a.to.row.item.id}`}
            data-gantt-arrow=""
            opacity={a.done ? 0.4 : 1}
            color={palette.muted}
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
