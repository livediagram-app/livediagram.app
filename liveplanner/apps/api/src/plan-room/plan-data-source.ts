// A plan's cards as live data for a chart or table in another app (liveworkspace/docs/specs/004-index/live-data.md,
// docs/specs/015-api/api.md "Live data"): its boards, metrics and the values a filter can name, for a picker, and one
// board's cards counted by column, label, assignee or priority, or one Dashboard metric's rows. Runs in the plan's
// room. Reads only the counts: category names and numbers, never a card's title, text, comments or other fields.
import {
  BOARD_WIDGET_INFO,
  METRIC_KINDS,
  PRIORITIES,
  PRIORITY_LABELS,
  isArchived,
  isPriority,
  isTrashed,
  itemAssignee,
  itemLabels,
  metricBoard,
  normaliseBoardSetup,
  projectBoard,
  statusPhasesOf,
  type Item,
  type MetricKind,
  type QuickFilter,
} from '@liveplanner/items';
import { metricModel, type MetricModel } from '@liveplanner/plan-art';
import type { PlanDataListResult, PlanDataResult } from '@liveworkspace/index-app';
import {
  BOARD_COUNT_LABELS,
  PLAN_DATA_BOARDS_MAX,
  PLAN_DATA_LIST_MAX,
  type BoardCountBy,
  type BoardCountFilter,
  type PlanDataAsk,
  type SheetChartTable,
} from '@liveworkspace/index-client';
import type { PlanEnv } from '../types';
import { readPlanHead } from './plan-content';
import { planReads, readTabs, type PlanReads, type StoredTab } from './plan-export';

// The chart caps (500 categories): a count keeps its largest.
export const PLAN_DATA_CATEGORIES_MAX = 500;
const SERIES_NAME = 'Cards';
const NO_PRIORITY = 'No Priority';
const NO_ASSIGNEE = 'Unassigned';
const DASHBOARD_NAME = 'Dashboard';

const isMetricKind = (v: string): v is MetricKind => (METRIC_KINDS as readonly string[]).includes(v);

const boardOf = (tab: StoredTab) => {
  const el = tab.elements.find((e) => e.type === 'shape' && e.shape === 'plan-board');
  return el?.type === 'shape' ? normaliseBoardSetup(el.planBoard) : null;
};

const boardSetups = (tabs: readonly StoredTab[]): unknown[] =>
  tabs.flatMap((t) =>
    t.elements.flatMap((el) =>
      el.type === 'shape' && el.shape === 'plan-board' ? [el.planBoard] : [],
    ),
  );

// Each value once, most used first, capped.
function mostUsed(values: Iterable<string>, max = PLAN_DATA_LIST_MAX): string[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([v]) => v);
}

const liveItems = (reads: PlanReads): Item[] =>
  [...reads.items.values()].filter((it) => !isTrashed(it) && !isArchived(it));

async function readPlan(env: PlanEnv, planId: string) {
  const { meta, itemTypes } = await readPlanHead(env, planId);
  if (!meta) return null;
  const tabs = await readTabs(env, planId);
  return { tabs, reads: await planReads(env, planId, itemTypes, tabs) };
}

export async function listPlanData(env: PlanEnv, planId: string): Promise<PlanDataListResult> {
  const plan = await readPlan(env, planId);
  if (!plan) return { status: 'not_found' };
  const { tabs, reads } = plan;
  const items = liveItems(reads);
  const people = new Map<string, string>();
  for (const it of items) {
    const p = itemAssignee(it);
    if (p && !people.has(p.id)) people.set(p.id, p.name);
  }
  return {
    status: 'ok',
    listing: {
      boards: tabs
        .filter((t) => boardOf(t) !== null)
        .slice(0, PLAN_DATA_BOARDS_MAX)
        .map((t) => ({ id: t.id, name: t.name, tabId: t.id })),
      metrics: METRIC_KINDS.map((id) => ({ id, label: BOARD_WIDGET_INFO[id].label })),
      filters: {
        priorities: PRIORITIES.map((id) => ({ id, label: PRIORITY_LABELS[id] })),
        labels: mostUsed(items.flatMap(itemLabels)),
        people: [...people].slice(0, PLAN_DATA_LIST_MAX).map(([id, name]) => ({ id, name })),
        types: reads.types.slice(0, PLAN_DATA_LIST_MAX).map((t) => ({ id: t.id, label: t.label })),
      },
    },
  };
}

// The rows of a count, largest first (ties by name), capped, as one series.
function countTable(counts: ReadonlyMap<string, number>, order?: readonly string[]): SheetChartTable {
  const rows = [...counts.entries()];
  if (order) rows.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  else rows.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const kept = rows.slice(0, PLAN_DATA_CATEGORIES_MAX);
  return {
    categories: kept.map(([name]) => name),
    series: [{ name: SERIES_NAME, values: kept.map(([, n]) => n) }],
  };
}

const bump = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1);

// One board's cards, narrowed by the filter, counted by `by`.
export function boardCounts(
  setup: NonNullable<ReturnType<typeof boardOf>>,
  reads: PlanReads,
  by: BoardCountBy,
  filter: BoardCountFilter = {},
): SheetChartTable {
  const quick: QuickFilter = {
    ...(filter.priority && isPriority(filter.priority) ? { priority: filter.priority } : {}),
    ...(filter.person ? { person: filter.person } : {}),
    ...(filter.type ? { type: filter.type } : {}),
  };
  const label = filter.label;
  const items = label
    ? new Map([...reads.items].filter(([, it]) => itemLabels(it).includes(label)))
    : reads.items;
  const projection = projectBoard(setup, items, quick, reads.types, reads.statusNames);
  // The cards each column shows through the filter, each once (a card in several swimlanes is one card).
  const shown = projection.columns
    .slice(0, PLAN_DATA_CATEGORIES_MAX)
    .map((c) => ({ name: c.column.name, cards: [...new Set(c.lanes.flatMap((l) => l.items))] }));
  if (by === 'column') {
    // Every column in its board order, an empty one at nought; two columns of one name stay apart.
    return {
      categories: shown.map((c) => c.name),
      series: [{ name: SERIES_NAME, values: shown.map((c) => c.cards.length) }],
    };
  }
  const cards = shown.flatMap((c) => c.cards);
  const counts = new Map<string, number>();
  if (by === 'label') {
    for (const it of cards) for (const l of new Set(itemLabels(it))) bump(counts, l);
    return countTable(counts);
  }
  if (by === 'assignee') {
    for (const it of cards) bump(counts, itemAssignee(it)?.name ?? NO_ASSIGNEE);
    return countTable(counts);
  }
  const order = [...PRIORITIES.map((p) => PRIORITY_LABELS[p]), NO_PRIORITY];
  for (const it of cards) {
    const p = it.fields['priority'];
    bump(counts, isPriority(p) ? PRIORITY_LABELS[p] : NO_PRIORITY);
  }
  return countTable(counts, order);
}

// A metric's rows as a table: its bars, split or people as categories, a ring as Done and Not Done, anything else its
// figure alone.
export function metricTable(model: MetricModel, label: string): SheetChartTable {
  const one = (categories: string[], values: number[]): SheetChartTable => ({
    categories: categories.slice(0, PLAN_DATA_CATEGORIES_MAX),
    series: [{ name: label, values: values.slice(0, PLAN_DATA_CATEGORIES_MAX) }],
  });
  const v = model.visual;
  if (v?.kind === 'bars' || v?.kind === 'split')
    return one(
      (v.kind === 'bars' ? v.rows : v.parts).map((r) => r.label),
      (v.kind === 'bars' ? v.rows : v.parts).map((r) => r.count),
    );
  if (v?.kind === 'people')
    return one(
      v.rows.map((r) => r.person.name),
      v.rows.map((r) => r.count),
    );
  if (v?.kind === 'ring') return one(['Done', 'Not Done'], [v.pct, 100 - v.pct]);
  const figure = Number.parseFloat(model.hero);
  return one([label], [Number.isFinite(figure) ? figure : 0]);
}

export async function readPlanData(
  env: PlanEnv,
  planId: string,
  ask: PlanDataAsk,
  now = new Date(),
): Promise<PlanDataResult> {
  const plan = await readPlan(env, planId);
  if (!plan) return { status: 'not_found' };
  const { tabs, reads } = plan;
  if (ask.kind === 'metric') {
    if (!isMetricKind(ask.metric)) return { status: 'not_found' };
    const label = BOARD_WIDGET_INFO[ask.metric].label;
    const board = metricBoard(liveItems(reads), statusPhasesOf(boardSetups(tabs)), reads.types);
    const model = metricModel(ask.metric, board, reads.types, now);
    return {
      status: 'ok',
      read: { sourceName: DASHBOARD_NAME, tabId: '', label, table: metricTable(model, label) },
    };
  }
  const tab = tabs.find((t) => t.id === ask.boardId);
  const setup = tab ? boardOf(tab) : null;
  if (!tab || !setup) return { status: 'not_found' };
  return {
    status: 'ok',
    read: {
      sourceName: tab.name,
      tabId: tab.id,
      label: BOARD_COUNT_LABELS[ask.by],
      table: boardCounts(setup, reads, ask.by, ask.filter),
    },
  };
}
