// Converting an old Plan tab to the Plan kinds (docs/specs/026-plan/plan-tabs.md "Converting old Plan tabs"): a tab
// in Plan of the general kind holding only Plan elements. One board or Sheet alone makes the tab a Board or Sheet tab;
// anything more moves each board and Sheet to a tab of its own, after this one, and makes this tab a Dashboard of them
// and its views. Pure: the hook (usePlanTabConversion) decides when, and commits the result as one step.
import {
  DASHBOARD_ROWS_MAX,
  dashboardRowsOf,
  isPlanTabKind,
  readDashboard,
  type DashboardContent,
  type Element,
  type Tab,
} from '@liveplanner/document';

const PLAN_SHAPES = new Set(['plan-board', 'plan-sheet', 'plan-view']);

const shapeOf = (el: Element) => (el.type === 'shape' ? el.shape : null);

// The tab is an old Plan tab this converts: of the general kind, holding Plan elements and nothing else.
export function isConvertiblePlanTab(tab: Tab): boolean {
  if (isPlanTabKind(tab.kind) || (tab.kind && tab.kind !== 'diagram')) return false;
  if (tab.elements.length === 0) return false;
  return tab.elements.every((el) => PLAN_SHAPES.has(shapeOf(el) ?? ''));
}

// Top to bottom, then left to right.
const readingOrder = (a: Element, b: Element) =>
  'y' in a && 'y' in b ? a.y - b.y || a.x - b.x : 0;

type Row = ReturnType<typeof dashboardRowsOf>[number];

const titleOf = (el: Element): string | null => {
  const board = (el as { planBoard?: { title?: unknown } }).planBoard;
  if (typeof board?.title === 'string' && board.title.trim()) return board.title.trim();
  return null;
};

// `tab` converted: the tabs to put in its place (itself first, then any new ones), or null when it does not convert.
export function convertPlanTab(
  tab: Tab,
  createTab: (name: string) => Tab,
  newId: () => string,
): Tab[] | null {
  if (!isConvertiblePlanTab(tab)) return null;
  const work = tab.elements.filter(
    (el) => shapeOf(el) === 'plan-board' || shapeOf(el) === 'plan-sheet',
  );
  const views = tab.elements.filter((el) => shapeOf(el) === 'plan-view').sort(readingOrder);
  // One board or Sheet alone: the tab becomes its kind.
  if (work.length === 1 && views.length === 0) {
    return [
      { ...tab, kind: shapeOf(work[0]!) === 'plan-board' ? 'board' : 'sheet' },
    ];
  }
  const look: Partial<Tab> = {
    theme: tab.theme,
    backgroundPattern: tab.backgroundPattern,
    backgroundColor: tab.backgroundColor,
    backgroundOpacity: tab.backgroundOpacity,
    patternColor: tab.patternColor,
    font: tab.font,
    defaultTextSize: tab.defaultTextSize,
  };
  const made = [...work].sort(readingOrder).map((el): Tab => {
    const isBoard = shapeOf(el) === 'plan-board';
    return {
      ...look,
      ...createTab(titleOf(el) ?? (isBoard ? 'Board' : 'Sheet')),
      kind: isBoard ? 'board' : 'sheet',
      elements: [el],
    };
  });
  const isMetric = (el: Element) =>
    ((el as { planView?: { view?: string } }).planView?.view ?? '').startsWith('metric:');
  const isGantt = (el: Element) =>
    (el as { planView?: { view?: string } }).planView?.view === 'gantt';
  const element = (el: Element): DashboardContent => ({ type: 'element', elementId: el.id });
  const rows: Row[] = [
    ...dashboardRowsOf(made, 2, 480, (t) => ({
      type: 'tab',
      tabId: t.id,
      of: t.kind === 'sheet' ? 'sheet' : 'board',
    })),
    ...dashboardRowsOf(views.filter(isMetric), 4, 160, element),
    ...dashboardRowsOf(views.filter(isGantt), 1, 440, element),
    ...dashboardRowsOf(
      views.filter((v) => !isMetric(v) && !isGantt(v)),
      2,
      360,
      element,
    ),
  ].slice(0, DASHBOARD_ROWS_MAX);
  const dashboard = readDashboard({
    rows: rows.map((r) => ({
      id: newId(),
      height: r.height,
      slots: r.slots.map((s) => ({ id: newId(), ...s })),
    })),
  });
  // Views past the last row would sit in no slot: they stay on the tab, out of sight, as Fill Tab hides others.
  return [
    {
      ...tab,
      kind: 'dashboard',
      elements: views,
      ...(dashboard ? { dashboard } : {}),
    },
    ...made,
  ];
}
