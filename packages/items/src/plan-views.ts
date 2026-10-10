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
  SWIMLANE_BY,
  type BoardProjection,
  type SwimlaneBy,
  type PlanBoardSetup,
} from './board';
import { GANTT_NAMES_MAX_PX, GANTT_NAMES_MIN_PX } from './plan-view-gantt';
import { isGanttRowOrder } from './gantt-row-order';
import { ITEM_TYPE_PATTERN } from './limits';
import { ITEM_TYPES, LEGACY_PARENT_GROUPING, type ItemTypeDef } from './item-types';
import { isCardSearchFilters } from './card-search';

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
  'search',
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

// The card types a Gantt chart draws when it names none (docs/specs/026-plan/plan-views.md "Gantt Chart").
export const GANTT_DEFAULT_TYPES: readonly string[] = ['project'];
// The most card types a chart can name: the catalogue's own limit (ITEM_TYPES_MAX in type-catalogue.ts).
export const GANTT_TYPES_MAX = 32;

// The card types a Gantt chart's settings accept: its own list, else Project.
export function ganttTypesOf(
  settings: { types?: readonly string[] } | undefined,
): readonly string[] {
  return settings?.types && settings.types.length > 0 ? settings.types : GANTT_DEFAULT_TYPES;
}

// The card types a Gantt chart can show (docs/specs/026-plan/plan-views.md "Card types"): those that offer both a
// Start and a Due field, so every card of them can have a bar. A Project always can.
export function ganttEligibleTypes(types: readonly ItemTypeDef[]): ItemTypeDef[] {
  return types.filter((t) => t.fields.includes('start') && t.fields.includes('due'));
}

// What a chart draws: the types it accepts that can be drawn. A type that loses Start or Due drops out until
// it has them again; the setting keeps naming it.
export function ganttShownTypes(
  settings: { types?: readonly string[] } | undefined,
  types: readonly ItemTypeDef[],
): string[] {
  const eligible = new Set(ganttEligibleTypes(types).map((t) => t.id));
  return ganttTypesOf(settings).filter((id) => eligible.has(id));
}

// A plan view element's settings (docs/specs/026-plan/plan-views.md): its view, and for the Gantt chart its
// card types, swimlanes, names column width and row order. What validation accepts; anything else is refused.
export function isPlanViewSettings(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!isPlanViewId(v['view'])) return false;
  if (
    v['swimlaneBy'] !== undefined &&
    v['swimlaneBy'] !== LEGACY_PARENT_GROUPING &&
    !(SWIMLANE_BY as readonly unknown[]).includes(v['swimlaneBy'])
  )
    return false;
  if (
    v['swimlaneField'] !== undefined &&
    (typeof v['swimlaneField'] !== 'string' ||
      !v['swimlaneField'] ||
      v['swimlaneField'].length > 64)
  )
    return false;
  const types = v['types'];
  if (
    types !== undefined &&
    (!Array.isArray(types) ||
      types.length === 0 ||
      types.length > GANTT_TYPES_MAX ||
      types.some((t) => typeof t !== 'string' || !ITEM_TYPE_PATTERN.test(t)) ||
      new Set(types).size !== types.length)
  )
    return false;
  if (v['rowOrder'] !== undefined && !isGanttRowOrder(v['rowOrder'])) return false;
  if (v['filters'] !== undefined && !isCardSearchFilters(v['filters'])) return false;
  const w = v['namesWidth'];
  if (
    w !== undefined &&
    (typeof w !== 'number' ||
      !Number.isFinite(w) ||
      w < GANTT_NAMES_MIN_PX ||
      w > GANTT_NAMES_MAX_PX)
  )
    return false;
  return true;
}

// The fields a card type must offer to feed a view (docs/specs/026-plan/plan-views.md "Card types"): a Gantt
// chart draws Start to Due, a Due Calendar places by Due, Priority by Status counts by Priority, and a metric reads
// its own field. A view not listed takes every type.
const VIEW_NEEDS: Partial<Record<PlanViewId, readonly string[]>> = {
  gantt: ['start', 'due'],
  calendar: ['due'],
  'priority-matrix': ['priority'],
  'metric:people': ['assignee'],
  'metric:unassigned': ['assignee'],
  'metric:priorities': ['priority'],
  'metric:due': ['due'],
  'metric:points': ['estimate'],
  'metric:top-voted': ['votes'],
};

// The fields a view needs a type to offer, as its Card Types note names them.
export function viewNeeds(view: PlanViewId): readonly string[] {
  return VIEW_NEEDS[view] ?? [];
}

// The card types a view can show: those offering every field it needs.
export function viewEligibleTypes(view: PlanViewId, types: readonly ItemTypeDef[]): ItemTypeDef[] {
  const needs = viewNeeds(view);
  return types.filter((t) => needs.every((f) => t.fields.includes(f)));
}

// The card types a view's settings name: a Gantt chart's own list (else Project); any other view's list, else
// every type.
export function viewChosenTypes(
  view: PlanViewId,
  settings: { types?: readonly string[] } | undefined,
  types: readonly ItemTypeDef[],
): readonly string[] {
  if (view === 'gantt') return ganttTypesOf(settings);
  return settings?.types && settings.types.length > 0 ? settings.types : types.map((t) => t.id);
}

// What a view shows: the types it names that can feed it. A named type that has lost a needed field drops out
// until it has it again.
export function viewShownTypes(
  view: PlanViewId,
  settings: { types?: readonly string[] } | undefined,
  types: readonly ItemTypeDef[],
): string[] {
  const eligible = new Set(viewEligibleTypes(view, types).map((t) => t.id));
  return viewChosenTypes(view, settings, types).filter((id) => eligible.has(id));
}

// What Cards by Field groups by (docs/specs/026-plan/plan-views.md "Cards by Field"): its own grouping, else
// Assignee, as Workload by Person was.
export function breakdownGroupingOf(settings: {
  swimlaneBy?: SwimlaneBy;
  swimlaneField?: string;
}): { by: SwimlaneBy; field: string | undefined } {
  const by =
    settings.swimlaneBy && settings.swimlaneBy !== 'none' ? settings.swimlaneBy : 'assignee';
  return { by, field: by === 'field' ? settings.swimlaneField : undefined };
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

// The visualisations the palette offers. Status Breakdown is retired: one already placed still draws, but no new
// one is made (docs/specs/026-plan/plan-views.md "Visualisations").
export const PLAN_PALETTE_VISUALISATIONS: readonly PlanVisualisation[] = PLAN_VISUALISATIONS.filter(
  (v) => v !== 'status-mix',
);

// A view's name, as its palette tile and header say it.
export const PLAN_VISUALISATION_LABELS: Readonly<Record<PlanVisualisation, string>> = {
  gantt: 'Gantt Chart',
  calendar: 'Due Calendar',
  workload: 'Cards by Field',
  'status-mix': 'Status Breakdown',
  'priority-matrix': 'Priority by Status',
  search: 'Card Search',
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
    hideWriting: false,
  };
  const cards = liveCards(items).map((it) => ({
    ...it,
    fields: { ...it.fields, status: PHASE_STATUS(phaseOf(it, phases)) },
  }));
  const projection = projectBoard(setup, new Map(cards.map((c) => [c.id, c])), undefined, types);
  return { setup, items: cards, projection };
}
