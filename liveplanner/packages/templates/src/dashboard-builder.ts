// A Dashboard tab made whole (docs/specs/026-plan/plan-tabs.md, docs/specs/026-plan/plan-agents.md "Making a
// dashboard"): rows of the Board and Sheet tabs it shows, its metric tiles, its charts and its notes, as a template's
// Dashboard is laid out. Shared by the templates (template-builders-plan.ts) and by an agent's `dashboard` source
// (edit-operations' replace). Pure: ids come from the caller.
import {
  DASHBOARD_ROWS_MAX,
  buildTab,
  createShape,
  dashboardRowsOf,
  readDashboard,
  readSlotName,
  type DashboardContent,
  type DashboardLayout,
  type PlanViewRef,
  type ShapeElement,
  stampTabKind,
  type Tab,
} from '@liveplanner/project';
import {
  METRIC_KINDS,
  PLAN_VISUALISATIONS,
  PLAN_CHART_SIZE,
  PLAN_METRIC_SIZE,
  type MetricKind,
  type PlanViewId,
  type PlanVisualisation,
} from '@liveplanner/items';

// What a Dashboard can hold: every metric, and every chart a person can add (Status Breakdown is no longer offered).
export const DASHBOARD_METRIC_KINDS: readonly MetricKind[] = METRIC_KINDS;
export const DASHBOARD_CHART_VIEWS: readonly PlanVisualisation[] = PLAN_VISUALISATIONS.filter(
  (v) => v !== 'status-mix',
);

// A Gantt's starting height.
export const GANTT_H = 440;

// Each row kind's height, and how many slots it holds.
const DASH_TAB_ROW_H = 480;
const DASH_METRIC_ROW_H = 160;
const DASH_CHART_ROW_H = 360;
const DASH_GANTT_ROW_H = 440;
const DASH_NOTE_ROW_H = 240;
const TABS_PER_ROW = 2;
const METRICS_PER_ROW = 4;
const CHARTS_PER_ROW = 2;
const NOTES_PER_ROW = 3;

// A chart a Dashboard holds: its view and, for its element, the rest of its settings (its card types, its grouping).
// `name`: its slot's own name in place of the generated heading (docs/specs/026-plan/plan-tabs.md "A slot's name").
export type DashboardChartSpec = {
  view: PlanVisualisation;
  settings?: Omit<PlanViewRef, 'view'>;
  name?: string;
};

export type DashboardSpec = {
  // The Board and Sheet tabs it shows, by id, each with what it holds.
  tabs?: readonly { tabId: string; of: 'board' | 'sheet' }[];
  metrics?: readonly MetricKind[];
  charts?: readonly DashboardChartSpec[];
  notes?: readonly { title: string; text: string }[];
};

// A plan view element at the origin: the Dashboard's layout places it.
function planViewElement(
  viewId: PlanViewId,
  width: number,
  height: number,
  settings: Omit<PlanViewRef, 'view'> = {},
): ShapeElement {
  return {
    ...createShape('plan-view', 0, 0),
    width,
    height,
    planView: { view: viewId, ...structuredClone(settings) },
  };
}

// The view elements a spec's metrics and charts make, in its order.
export function dashboardViewElements(spec: DashboardSpec): {
  metrics: ShapeElement[];
  charts: ShapeElement[];
} {
  return {
    metrics: (spec.metrics ?? []).map((m) =>
      planViewElement(`metric:${m}`, PLAN_METRIC_SIZE.width, PLAN_METRIC_SIZE.height),
    ),
    charts: (spec.charts ?? []).map((c) =>
      planViewElement(
        c.view,
        PLAN_CHART_SIZE.width,
        c.view === 'gantt' ? GANTT_H : PLAN_CHART_SIZE.height,
        c.settings,
      ),
    ),
  };
}

type DashRow = { height: number; slots: { span: number; content?: DashboardContent }[] };

// The layout over a spec's views: the tabs two to a row, the metrics four, each Gantt a row of its own, the other
// charts two, the notes three, up to DASHBOARD_ROWS_MAX rows; `dropped` counts the rows left off. Its rows and slots
// take ids `<prefix>-d<n>`.
export function dashboardLayoutOf(
  spec: DashboardSpec,
  views: { metrics: readonly ShapeElement[]; charts: readonly ShapeElement[] },
  idPrefix: string,
): { dashboard: DashboardLayout | undefined; dropped: number } {
  const gantts = views.charts.filter((el) => el.planView?.view === 'gantt');
  const others = views.charts.filter((el) => el.planView?.view !== 'gantt');
  // Each chart's slot name, by its element (views.charts is in spec.charts' order); read as a stored name is.
  const names = new Map<ShapeElement, string>();
  views.charts.forEach((el, i) => {
    const name = readSlotName(spec.charts?.[i]?.name);
    if (name) names.set(el, name);
  });
  const element = (el: ShapeElement): DashboardContent => {
    const name = names.get(el);
    return { type: 'element', elementId: el.id, ...(name ? { name } : {}) };
  };
  const rows: DashRow[] = [
    ...dashboardRowsOf(spec.tabs ?? [], TABS_PER_ROW, DASH_TAB_ROW_H, (w) => ({
      type: 'tab',
      tabId: w.tabId,
      of: w.of,
    })),
    ...dashboardRowsOf(views.metrics, METRICS_PER_ROW, DASH_METRIC_ROW_H, element),
    ...dashboardRowsOf(gantts, 1, DASH_GANTT_ROW_H, element),
    ...dashboardRowsOf(others, CHARTS_PER_ROW, DASH_CHART_ROW_H, element),
    ...dashboardRowsOf(spec.notes ?? [], NOTES_PER_ROW, DASH_NOTE_ROW_H, (n) => ({
      type: 'note' as const,
      title: n.title,
      text: n.text,
    })),
  ];
  const kept = rows.slice(0, DASHBOARD_ROWS_MAX);
  let n = 0;
  const id = () => `${idPrefix}-d${++n}`;
  const dashboard = readDashboard({
    rows: kept.map((r) => ({
      id: id(),
      height: r.height,
      slots: r.slots.map((s) => ({ id: id(), ...s })),
    })),
  });
  return { dashboard: dashboard ?? undefined, dropped: rows.length - kept.length };
}

// A whole Dashboard tab (docs/specs/026-plan/plan-agents.md "Making a dashboard"): its views at the origin for the
// layout to place, the Dashboard kind, opening in Plan; `dropped` counts the rows past DASHBOARD_ROWS_MAX left off.
export function buildDashboardTab(
  tabId: string,
  name: string,
  spec: DashboardSpec,
  themeId?: string,
): { tab: Tab; dropped: number } {
  const views = dashboardViewElements(spec);
  const { dashboard, dropped } = dashboardLayoutOf(spec, views, tabId);
  const tab = stampTabKind({
    ...buildTab(tabId, name, [...views.metrics, ...views.charts], 'preserve', themeId),
    kind: 'dashboard' as const,
    ...(dashboard ? { dashboard } : {}),
  });
  return { tab, dropped };
}
