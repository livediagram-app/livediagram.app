// The Plan templates (docs/specs/026-plan/plan-templates.md): each makes one or more template tabs, every
// tab a board with the set-up its use wants, the plan views under it and a rail of notes and facilitation
// tools beside it ("Layout of a template tab"). A template holds only the set-up: it comes with no cards.
//
// Pure: takes a centre (cx, cy), returns fresh Element[] per tab.

import {
  createShape,
  createSticky,
  type Element,
  type ShapeElement,
  type StickyElement,
} from '@livediagram/document';
import {
  CARD_FIELDS,
  PLAN_CHART_SIZE,
  PLAN_METRIC_SIZE,
  presetSetup,
  type PlanBoardSetup,
  type PlanViewId,
  type PlanVisualisation,
} from '@livediagram/items';
import {
  PLAN_TEMPLATE_KINDS,
  PLAN_TEMPLATE_TABS,
  type BoardSpec,
  type PlanTabSpec,
  type PlanTemplateKind,
  type RailItem,
} from './plan-template-catalogue';

export { PLAN_TEMPLATE_KINDS, PLAN_TEMPLATE_TABS, type PlanTemplateKind };

// Every element a template tab holds is a box: a shape (board, view, tool) or a sticky.
type Box = ShapeElement | StickyElement;

// Spacing (plan-templates.md "Layout of a template tab").
const GAP = 40;
const CHART_GAP = 24;
const METRIC_GAP = 20;
const RAIL_W = 280;
const RAIL_GAP = 24;
const GANTT_H = 440;
// A dashboard tab's width: two charts side by side at their starting width.
const DASHBOARD_W = PLAN_CHART_SIZE.width * 2 + CHART_GAP;

// The set-up a board starts with: its preset's, with the spec's set-up over it and its title.
// Card fields are kept in their canonical order, as a stored set-up keeps them.
export function boardSetup(spec: BoardSpec): PlanBoardSetup {
  const setup = {
    ...presetSetup(spec.preset),
    ...structuredClone(spec.setup ?? {}),
    title: spec.title,
  };
  // A spec may take its preset's done column away (`doneColumnId: undefined`): drop the key.
  if (setup.doneColumnId === undefined) delete setup.doneColumnId;
  return { ...setup, cardFields: CARD_FIELDS.filter((f) => setup.cardFields.includes(f)) };
}

function board(spec: BoardSpec, x: number, y: number): Box {
  return {
    ...createShape('plan-board', x, y),
    width: spec.width,
    height: spec.height,
    planBoard: boardSetup(spec),
  };
}

function view(
  viewId: PlanViewId,
  x: number,
  y: number,
  width: number,
  height: number,
  types?: readonly string[],
): Box {
  return {
    ...createShape('plan-view', x, y),
    width,
    height,
    planView: { view: viewId, ...(types ? { types: [...types] } : {}) },
  };
}

// Metrics in a row, wrapping at `width`; returns the elements and the height they take.
function metricRow(spec: PlanTabSpec, y: number, width: number): [Box[], number] {
  const metrics = spec.metrics ?? [];
  if (metrics.length === 0) return [[], 0];
  const { width: w, height: h } = PLAN_METRIC_SIZE;
  const perRow = Math.max(1, Math.floor((width + METRIC_GAP) / (w + METRIC_GAP)));
  const out = metrics.map((m, i) =>
    view(
      `metric:${m}`,
      (i % perRow) * (w + METRIC_GAP),
      y + Math.floor(i / perRow) * (h + METRIC_GAP),
      w,
      h,
    ),
  );
  const rows = Math.ceil(metrics.length / perRow);
  return [out, rows * h + (rows - 1) * METRIC_GAP + GAP];
}

// Charts two to a row; the Gantt, and a chart left over at the end, take the full width. The Gantt draws
// `ganttTypes` when given.
function chartGrid(
  charts: readonly PlanVisualisation[],
  y: number,
  width: number,
  ganttTypes?: readonly string[],
): Box[] {
  const out: Box[] = [];
  const half = (width - CHART_GAP) / 2;
  let i = 0;
  while (i < charts.length) {
    const chart = charts[i]!;
    const next = charts[i + 1];
    if (chart === 'gantt' || next === undefined || next === 'gantt') {
      const h = chart === 'gantt' ? GANTT_H : PLAN_CHART_SIZE.height;
      out.push(view(chart, 0, y, width, h, chart === 'gantt' ? ganttTypes : undefined));
      y += h + CHART_GAP;
      i += 1;
      continue;
    }
    out.push(view(chart, 0, y, half, PLAN_CHART_SIZE.height));
    out.push(view(next, half + CHART_GAP, y, half, PLAN_CHART_SIZE.height));
    y += PLAN_CHART_SIZE.height + CHART_GAP;
    i += 2;
  }
  return out;
}

// A sticky tall enough for its lines at the small text size (about 36 characters a line, 18px each),
// with room under them to write.
function stickyHeight(text: string): number {
  const lines = text
    .split('\n')
    .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 36)), 0);
  return Math.max(160, 56 + lines * 18);
}

function railItem(item: RailItem, x: number, y: number): Box {
  switch (item.kind) {
    case 'sticky':
      return {
        ...createSticky(x, y),
        width: RAIL_W,
        height: stickyHeight(item.text),
        label: item.text,
        textSize: 'sm',
      };
    case 'timer':
      return {
        ...createShape('session-button', x, y),
        width: RAIL_W,
        height: 96,
        session: { tool: 'timer', minutes: item.minutes },
      };
    case 'vote':
      return {
        ...createShape('session-button', x, y),
        width: RAIL_W,
        height: 96,
        session: { tool: 'vote', dots: item.dots },
      };
    case 'picker':
      return { ...createShape('picker', x, y), width: RAIL_W, height: 160, label: item.label };
    case 'temperature':
      return { ...createShape('temperature', x, y), width: RAIL_W, height: 220, label: item.label };
  }
}

function rail(items: readonly RailItem[], x: number): Box[] {
  let y = 0;
  return items.map((item) => {
    const el = railItem(item, x, y);
    y += el.height + RAIL_GAP;
    return el;
  });
}

function bounds(elements: readonly Box[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return { minX, minY, maxX, maxY };
}

// One template tab's elements, laid out from (0, 0) and then centred on (cx, cy).
export function buildPlanTab(spec: PlanTabSpec, cx: number, cy: number): Element[] {
  const width = spec.board?.width ?? DASHBOARD_W;
  const out: Box[] = [];
  let y = 0;
  if (spec.board) {
    out.push(board(spec.board, 0, 0));
    y = spec.board.height + GAP;
  }
  const [metrics, metricsH] = metricRow(spec, y, width);
  out.push(...metrics);
  y += metricsH;
  out.push(...chartGrid(spec.charts ?? [], y, width, spec.ganttTypes));
  out.push(...rail(spec.rail ?? [], width + GAP));
  // An empty tab (Blank Plan): nothing to place.
  if (out.length === 0) return [];
  const b = bounds(out);
  const dx = Math.round(cx - (b.minX + b.maxX) / 2);
  const dy = Math.round(cy - (b.minY + b.maxY) / 2);
  return out.map((el) => ({ ...el, x: el.x + dx, y: el.y + dy }));
}

// A template's tabs: their names (null for a template of one tab, which keeps the caller's name) and
// elements.
export function planTemplateTabs(
  kind: PlanTemplateKind,
): { name: string | null; build: (cx: number, cy: number) => Element[] }[] {
  const tabs = PLAN_TEMPLATE_TABS[kind];
  return tabs.map((spec) => ({
    name: tabs.length > 1 ? spec.name : null,
    build: (cx: number, cy: number) => buildPlanTab(spec, cx, cy),
  }));
}

// The first tab's elements: what a template's preview and a one-tab replace use.
export function buildPlanTemplate(kind: PlanTemplateKind, cx: number, cy: number): Element[] {
  return buildPlanTab(PLAN_TEMPLATE_TABS[kind][0]!, cx, cy);
}

export function isPlanTemplateKind(kind: string): kind is PlanTemplateKind {
  return (PLAN_TEMPLATE_KINDS as readonly string[]).includes(kind);
}
