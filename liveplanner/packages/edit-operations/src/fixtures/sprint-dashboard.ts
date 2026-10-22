// A Sprint 14 Dashboard tab, the kind of tab edit operations change: four metric views, a workload chart, a
// calendar, and a bar chart of a Sheet's cells. Every suite starts from a fresh copy.

import type { Element, PlanViewRef, Tab } from '@liveplanner/project';

const view = (
  id: string,
  planView: string,
  x: number,
  y: number,
  width: number,
  height: number,
  label?: string,
): Element => ({
  id,
  type: 'shape',
  shape: 'plan-view',
  x,
  y,
  width,
  height,
  textSize: 'md',
  planView: { view: planView } as PlanViewRef,
  ...(label ? { label } : {}),
});

export function sprintDashboard(): Tab {
  return {
    id: 'main',
    name: 'Sprint 14',
    kind: 'dashboard',
    elements: [
      view('m1', 'metric:count', 0, 0, 240, 120, 'Cards'),
      view('m2', 'metric:progress', 260, 0, 240, 120, 'Progress'),
      view('m3', 'metric:stale', 520, 0, 240, 120),
      view('m4', 'metric:unassigned', 780, 0, 240, 120),
      view('w1', 'workload', 0, 140, 500, 360, 'Workload'),
      view('c1', 'calendar', 520, 140, 500, 360, 'Due dates'),
      {
        id: 'b1',
        type: 'shape',
        shape: 'bar-chart',
        x: 0,
        y: 520,
        width: 500,
        height: 300,
        label: 'Budget',
        textSize: 'md',
        chartSource: {
          sheetId: 'sheet-1',
          range: { r1: 'row1', c1: 'col1', r2: 'row4', c2: 'col2' },
        },
      },
    ],
  };
}

// A new plan view, as an `add` sends it.
export const newView = (id: string, planView: string): Record<string, unknown> => ({
  id,
  type: 'shape',
  shape: 'plan-view',
  x: 0,
  y: 840,
  width: 500,
  height: 360,
  planView: { view: planView },
});

// Deterministic ids for elements added without one: `id-1`, `id-2`, …
export function fixedIds(): () => string {
  let next = 0;
  return () => `id-${++next}`;
}
