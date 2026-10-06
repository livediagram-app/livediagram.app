// Plan views (docs/specs/026-plan/plan-views.md): the view kinds a 'plan-view' element shows, the size each
// starts at, and what every view reads: the document's live cards and the phase each status sits in. Pure;
// the charts' own models are plan-view-gantt.ts and plan-view-charts.ts.
import type { Item } from './item';
import { itemStatus } from './item';
import type { BoardWidgetKind } from './board-widgets';
import {
  isArchived,
  isTrashed,
  normaliseBoardSetup,
  projectBoard,
  type BoardProjection,
  type PlanBoardSetup,
} from './board';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';

// The board widget kinds that read out rather than narrow a board or need its set-up
// (docs/specs/026-plan/plan-views.md "Metrics"), in the palette's order.
export const METRIC_KINDS = [
  'count',
  'progress',
  'people',
  'types',
  'priorities',
  'due',
  'unassigned',
  'points',
  'top-voted',
  'stale',
] as const satisfies readonly BoardWidgetKind[];
export type MetricKind = (typeof METRIC_KINDS)[number];

export const PLAN_VISUALISATIONS = [
  'gantt',
  'calendar',
  'workload',
  'status-mix',
  'priority-matrix',
] as const;
export type PlanVisualisation = (typeof PLAN_VISUALISATIONS)[number];

export type PlanViewId = `metric:${MetricKind}` | PlanVisualisation;

export const PLAN_VIEW_IDS: readonly PlanViewId[] = [
  ...METRIC_KINDS.map((k): PlanViewId => `metric:${k}`),
  ...PLAN_VISUALISATIONS,
];

export function isPlanViewId(value: unknown): value is PlanViewId {
  return typeof value === 'string' && (PLAN_VIEW_IDS as readonly string[]).includes(value);
}

// The metric a view is, or null for a visualisation.
export function planViewMetric(view: PlanViewId): MetricKind | null {
  return view.startsWith('metric:') ? (view.slice(7) as MetricKind) : null;
}

// The size a view starts at (docs/specs/026-plan/blueprints/DEFAULTS.md D25).
export const PLAN_METRIC_SIZE = { width: 260, height: 64 } as const;
export const PLAN_CHART_SIZE = { width: 720, height: 400 } as const;
export const PLAN_GANTT_SIZE = { width: 880, height: 420 } as const;

export function planViewSize(view: unknown): { width: number; height: number } {
  if (!isPlanViewId(view)) return { ...PLAN_CHART_SIZE };
  if (planViewMetric(view)) return { ...PLAN_METRIC_SIZE };
  return view === 'gantt' ? { ...PLAN_GANTT_SIZE } : { ...PLAN_CHART_SIZE };
}

// A view's name, as its palette tile and header say it.
export const PLAN_VISUALISATION_LABELS: Readonly<Record<PlanVisualisation, string>> = {
  gantt: 'Project Gantt Chart',
  calendar: 'Due Calendar',
  workload: 'Workload by Person',
  'status-mix': 'Status Breakdown',
  'priority-matrix': 'Priority by Status',
};

// Every live card: not archived, not in the Trash.
export function liveCards(items: Iterable<Item>): Item[] {
  const out: Item[] = [];
  for (const it of items) if (!isArchived(it) && !isTrashed(it)) out.push(it);
  return out;
}

// Where a status sits in the work (docs/specs/026-plan/plan-views.md "What a plan view reads").
export const STATUS_PHASES = ['todo', 'doing', 'done'] as const;
export type StatusPhase = (typeof STATUS_PHASES)[number];
export const STATUS_PHASE_LABELS: Readonly<Record<StatusPhase, string>> = {
  todo: 'Not Started',
  doing: 'In Progress',
  done: 'Done',
};

// The phases the boards give their statuses: a board's first column Not Started, its done column and those
// after it Done, the rest In Progress. The first board to name a status decides it. All Cards and Archive
// boards name no statuses of their own.
export function statusPhasesOf(boards: Iterable<unknown>): Map<string, StatusPhase> {
  const out = new Map<string, StatusPhase>();
  for (const raw of boards) {
    const setup = normaliseBoardSetup(raw);
    if (!setup || setup.allCards || setup.archive) continue;
    const doneAt = setup.columns.findIndex((c) => c.id === setup.doneColumnId);
    setup.columns.forEach((c, i) => {
      if (out.has(c.status)) return;
      const phase: StatusPhase = doneAt >= 0 && i >= doneAt ? 'done' : i === 0 ? 'todo' : 'doing';
      out.set(c.status, phase);
    });
  }
  return out;
}

export function phaseOf(item: Item, phases: ReadonlyMap<string, StatusPhase>): StatusPhase {
  const s = itemStatus(item);
  return (s !== undefined && phases.get(s)) || 'todo';
}

// The board a metric reads (docs/specs/026-plan/plan-views.md "Metrics"): every live card on
// one of three columns by its phase, the Done one the board's done column when any status is Done, so the
// header widgets' own rules read the whole document.
const PHASE_STATUS = (p: StatusPhase) => `phase-${p}`;

export function metricBoard(
  items: Iterable<Item>,
  phases: ReadonlyMap<string, StatusPhase>,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
): { setup: PlanBoardSetup; items: Item[]; projection: BoardProjection } {
  const hasDone = [...phases.values()].includes('done');
  const setup: PlanBoardSetup = {
    title: 'All Cards',
    columns: STATUS_PHASES.map((p) => ({
      id: p,
      name: STATUS_PHASE_LABELS[p],
      status: PHASE_STATUS(p),
    })),
    ...(hasDone ? { doneColumnId: 'done' } : {}),
    swimlaneBy: 'none',
    cardFields: [],
    voting: { on: false },
    hideWriting: false,
  };
  const cards = liveCards(items).map((it) => ({
    ...it,
    fields: { ...it.fields, status: PHASE_STATUS(phaseOf(it, phases)) },
  }));
  const projection = projectBoard(setup, new Map(cards.map((c) => [c.id, c])), undefined, types);
  return { setup, items: cards, projection };
}
