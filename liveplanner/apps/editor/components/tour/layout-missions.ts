// The Dashboards track's missions, Layout View (docs/specs/026-plan/plan-tour.md "Dashboards: Layout View"): checked
// against the dashboard's layout as it was when the tour started, so each is done by the person's own change.

import type { DashboardLayout } from '@liveplanner/project';
import type { Mission } from './missions';

// What the checks compare: the layout as it started, and as it is now.
export type LayoutCtx = { start: DashboardLayout; now: DashboardLayout };

const DIVIDER = '[data-dashboard] [role="separator"][aria-orientation="vertical"]';
const ROW_EDGE = '[data-dashboard] [role="separator"][aria-orientation="horizontal"]';
export const LAYOUT_VIEW_REVEAL = '[data-dashboard-slot]:not([data-slot-empty])';

const spans = (l: DashboardLayout) =>
  l.rows.map((r) => r.slots.map((s) => `${s.id}:${s.span}`).join(',')).join('|');
const heights = (l: DashboardLayout) => l.rows.map((r) => `${r.id}:${r.height}`).join('|');
const slotCount = (l: DashboardLayout) => l.rows.reduce((n, r) => n + r.slots.length, 0);
export const emptyCount = (l: DashboardLayout) =>
  l.rows.reduce((n, r) => n + r.slots.filter((s) => !s.content).length, 0);

// The missions for this dashboard, fixed at the start: on a phone (`condensed`, its rows stacked, no dividers or
// edges) only Fill a Slot; otherwise resize two slots (or add one beside, with no row of two), change a row's height
// (unless every row fills the page), and fill a slot when one is empty.
export function layoutMissions(start: DashboardLayout, condensed: boolean): Mission<LayoutCtx>[] {
  const fill: Mission<LayoutCtx> = {
    id: 'fill-slot',
    title: 'Fill a Slot',
    why: 'Pick what an empty slot shows, from **Add to Slot**.',
    points: ['[data-slot-empty] [aria-haspopup="dialog"]'],
    lesson: 'A slot shows a tab, a board, a metric, a chart or a note, live from your plan.',
    hints: [
      { text: 'Press Add to Slot in an empty slot and pick anything.' },
      { text: 'This one.', ring: () => '[data-slot-empty] [aria-haspopup="dialog"]' },
    ],
    done: (c) => emptyCount(c.now) < emptyCount(c.start),
  };
  const hasEmpty = emptyCount(start) > 0;
  if (condensed) return hasEmpty ? [fill] : [];
  const pairs = start.rows.some((r) => r.slots.length >= 2);
  const resize: Mission<LayoutCtx> = {
    id: 'resize-slots',
    onPage: true,
    title: 'Resize Two Slots',
    why: 'Drag the bar between two slots, and watch the spans snap.',
    lesson: 'Slots snap to twelfths, and a row’s spans always add up to twelve.',
    hints: [
      {
        text: 'Hover between two slots for the bar, then drag it. Or focus it and use the arrow keys.',
      },
      { text: 'This bar.', ring: () => DIVIDER },
    ],
    done: (c) => spans(c.now) !== spans(c.start),
  };
  const add: Mission<LayoutCtx> = {
    id: 'add-slot',
    title: 'Add a Slot Beside',
    why: 'Give a row a second slot, from a slot’s **cog**.',
    points: [`${LAYOUT_VIEW_REVEAL} [aria-label="Slot Settings"]`],
    lesson: 'A row holds up to four slots, side by side.',
    hints: [
      { text: 'Open a slot’s cog, then Add a Slot › Add Slot to the Right.' },
      { text: 'This cog.', ring: () => `${LAYOUT_VIEW_REVEAL} [aria-label="Slot Settings"]` },
    ],
    done: (c) => slotCount(c.now) > slotCount(c.start),
  };
  const row: Mission<LayoutCtx> = {
    id: 'row-height',
    onPage: true,
    title: 'Change a Row’s Height',
    why: 'Drag a row’s bottom edge up or down.',
    lesson: 'Rows can be as tall as their work needs: a tall one suits a board or a Gantt.',
    hints: [
      {
        text: 'Hover a row’s bottom edge for the handle, then drag it. Or focus it and use the arrow keys.',
      },
      { text: 'This edge.', ring: () => ROW_EDGE },
    ],
    done: (c) => heights(c.now) !== heights(c.start),
  };
  const resizable = start.rows.some((r) => !r.fill);
  return [pairs ? resize : add, ...(resizable ? [row] : []), ...(hasEmpty ? [fill] : [])];
}
