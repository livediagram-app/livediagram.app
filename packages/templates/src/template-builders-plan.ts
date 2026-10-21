// The Plan templates (docs/specs/026-plan/plan-templates.md, plan-tabs.md "Templates"): each makes one or more tabs of
// the Plan kinds: a Board tab of each board, a Sheet tab of each Sheet, and a Dashboard of the template's plan views
// and notes beside its Board and Sheet tabs. The tabs hold the set-up; the example cards a person's
// copy opens with are plan-template-seeds.ts's.
//
// Pure: takes a centre (cx, cy), returns fresh Element[] per tab.

import {
  createShape,
  newPlanSheetId,
  type Element,
  type ShapeElement,
  type Tab,
} from '@liveplanner/document';
import { CARD_FIELDS, presetSetup, type PlanBoardSetup } from '@liveplanner/items';
import { dashboardLayoutOf, dashboardViewElements } from './dashboard-builder';
import {
  PLAN_TEMPLATE_KINDS,
  PLAN_TEMPLATE_TABS,
  type BoardSpec,
  type PlanTemplateKind,
  type SheetSpec,
} from './plan-template-catalogue';

export { PLAN_TEMPLATE_KINDS, PLAN_TEMPLATE_TABS, type PlanTemplateKind };

// Every element a template tab holds is a shape: a board, a Sheet or a plan view.
type Box = ShapeElement;

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

// A template's board fills its Board tab, so it draws its cards Detailed, whatever its preset's size on a canvas
// (docs/specs/026-plan/plan-tabs.md "Board tab and Sheet tab").
function board(spec: BoardSpec, x: number, y: number): Box {
  const { cardSize: _canvasSize, ...setup } = boardSetup(spec);
  return {
    ...createShape('plan-board', x, y),
    width: spec.width,
    height: spec.height,
    planBoard: setup,
  };
}

// A Sheet not yet made: it names its start, and whatever makes the tabs makes its sheet (template-sheets.ts).
function sheet(spec: SheetSpec, x: number, y: number): Box {
  return {
    ...createShape('plan-sheet', x, y),
    width: spec.width,
    height: spec.height,
    planSheet: {
      sheetId: newPlanSheetId(),
      start: spec.start,
      ...(spec.fillTab ? { fillTab: true as const } : {}),
    },
  };
}

// A template tab as the new Plan model makes it (docs/specs/026-plan/plan-tabs.md "Templates"): its name (null for a
// template of one tab, which keeps the caller's name), its elements, and its tab fields, given every tab's id in order
// (a Dashboard's slots name the template's Board and Sheet tabs).
type PlanTemplateTabDef = {
  name: string | null;
  build: (cx: number, cy: number) => Element[];
  tab?: (ids: readonly string[]) => Partial<Tab>;
};

// A note from a rail sticky: its first line the heading, the rest the text.
function noteOf(text: string): { title: string; text: string } {
  const [title = '', ...rest] = text.split('\n');
  return { title, text: rest.join('\n') };
}

// A template's tabs in the new Plan model: a board's tab is a Board tab of the board alone, a Sheet's a Sheet tab,
// and a tab of plan views a Dashboard. The views and notes that sat beside a board or Sheet join the template's
// Dashboard (an Overview one, last, when it has none), which also shows each Board and Sheet tab; the rail's
// facilitation tools are not kept. A tab of nothing (Blank Plan) stays empty, for Start Planning.
export function planTemplateTabs(kind: PlanTemplateKind): PlanTemplateTabDef[] {
  const specs = PLAN_TEMPLATE_TABS[kind];
  const named = specs.length > 1;
  const dashSpec = specs.find(
    (s) => !s.board && !s.sheet && (s.metrics?.length || s.charts?.length),
  );
  // What a Dashboard gathers: every tab's metrics, charts and notes, in tab order.
  const metrics = specs.flatMap((s) => s.metrics ?? []);
  const charts = specs.flatMap((s) =>
    (s.charts ?? []).map((c) => ({ chart: c, gantt: c === 'gantt' ? s.ganttTypes : undefined })),
  );
  const notes = specs.flatMap((s) =>
    (s.rail ?? []).flatMap((r) => (r.kind === 'sticky' ? [r.text] : [])),
  );
  const wantsDashboard = !!dashSpec || metrics.length + charts.length + notes.length > 0;
  // A Dashboard's elements, made once so its layout names them (dashboard-builder.ts).
  const views = dashboardViewElements({
    metrics,
    charts: charts.map(({ chart, gantt }) => ({
      view: chart,
      ...(gantt ? { settings: { types: [...gantt] } } : {}),
    })),
  });
  const metricEls = views.metrics;
  const chartEls = views.charts;
  const dashboardTab = (ids: readonly string[]): Partial<Tab> => {
    const work = specs.flatMap((sp, i) =>
      sp.board || sp.sheet
        ? [{ tabId: ids[i]!, of: sp.board ? ('board' as const) : ('sheet' as const) }]
        : [],
    );
    const { dashboard } = dashboardLayoutOf(
      { tabs: work, notes: notes.map(noteOf) },
      views,
      ids[0] ?? 't',
    );
    return { kind: 'dashboard', opensIn: 'plan', ...(dashboard ? { dashboard } : {}) };
  };
  const out: PlanTemplateTabDef[] = specs.map((spec) => {
    const name = named ? spec.name : null;
    if (spec.board)
      return {
        name,
        build: (cx, cy) => [centred(board(spec.board!, 0, 0), cx, cy)],
        tab: () => ({ kind: 'board', opensIn: 'plan' }),
      };
    if (spec.sheet) return sheetTabDef(name, spec.sheet);
    if (spec === dashSpec)
      return { name, build: () => [...metricEls, ...chartEls], tab: dashboardTab };
    return { name, build: () => [] };
  });
  if (wantsDashboard && !dashSpec)
    out.push({ name: 'Overview', build: () => [...metricEls, ...chartEls], tab: dashboardTab });
  return out;
}

// A Sheet tab of one Sheet (docs/specs/026-plan/plan-tabs.md "Board tab and Sheet tab"): a Plan template's, or the
// companion Sheet a Diagram template makes after its drawing (template-companions.ts).
export function sheetTabDef(name: string | null, spec: SheetSpec): PlanTemplateTabDef {
  return {
    name,
    build: (cx, cy) => [centred(sheet(spec, 0, 0), cx, cy)],
    tab: () => ({ kind: 'sheet', opensIn: 'plan' }),
  };
}

function centred<T extends Box>(el: T, cx: number, cy: number): T {
  return { ...el, x: Math.round(cx - el.width / 2), y: Math.round(cy - el.height / 2) };
}

// The first tab's elements: what a template's preview and a one-tab replace use.
export function buildPlanTemplate(kind: PlanTemplateKind, cx: number, cy: number): Element[] {
  return planTemplateTabs(kind)[0]!.build(cx, cy);
}

export function isPlanTemplateKind(kind: string): kind is PlanTemplateKind {
  return (PLAN_TEMPLATE_KINDS as readonly string[]).includes(kind);
}
