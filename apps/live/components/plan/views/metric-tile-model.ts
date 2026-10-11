// What a metric tile shows (docs/specs/026-plan/plan-views.md "Metrics", plan-tabs.md "Metric tiles"): for each metric
// kind its hero figure, the line under it and the picture beside it, from every live card; and how much of that a tile
// of a given size has room for. Pure: MetricTile draws it.
import {
  PRIORITY_LABELS,
  itemAssignee,
  itemTitle,
  type BoardProjection,
  type Item,
  type ItemPerson,
  type ItemTypeDef,
  type MetricKind,
  type PlanBoardSetup,
} from '@livediagram/items';
import { PRIORITY_COLOURS } from '../plan-palette';
import { OVERDUE_RED, PHASE_COLOURS } from './phase-colours';
import {
  STALE_DAYS,
  boardPoints,
  boardTypeCounts,
  dueCounts,
  priorityCounts,
  staleCount,
  topVoted,
  unassignedCount,
} from '../widgets/widget-stats';

export const DUE_SOON_AMBER = '#d97706';

// How much a tile has room for. `pill`: a metric at its small canvas size, drawn as a header widget. `compact`: the
// figure and its line side by side. `regular`: a header, the figure, its line and a strip of the picture. `large`: the
// picture in full, beside the figure when the tile is wide, else under it.
export type MetricTier = 'pill' | 'compact' | 'regular' | 'large';

export const METRIC_PILL_MAX_H = 90;
export const METRIC_COMPACT_MAX_H = 150;
export const METRIC_LARGE_MIN_H = 230;
export const METRIC_LARGE_MIN_W = 300;
// Wide enough for the picture beside the figure.
export const METRIC_SIDE_BY_SIDE_MIN_W = 520;

export function metricTier(width: number, height: number): MetricTier {
  if (height < METRIC_PILL_MAX_H) return 'pill';
  if (height < METRIC_COMPACT_MAX_H) return 'compact';
  if (height >= METRIC_LARGE_MIN_H && width >= METRIC_LARGE_MIN_W) return 'large';
  return 'regular';
}

// The hero figure's size in px: grows with the tile, within 28 and 72.
export function heroSize(width: number, height: number, tier: MetricTier): number {
  const fit = Math.min(height * (tier === 'compact' ? 0.42 : 0.3), width * 0.2);
  return Math.round(Math.min(72, Math.max(28, fit)));
}

export type MetricBar = { key: string; label: string; count: number; color: string };

export type MetricVisual =
  | { kind: 'ring'; pct: number }
  | { kind: 'bars'; rows: MetricBar[]; total: number }
  | { kind: 'split'; parts: MetricBar[]; total: number }
  | { kind: 'people'; rows: { person: ItemPerson; count: number }[] }
  | { kind: 'card'; itemId: string; title: string; votes: number }
  | { kind: 'list'; rows: { itemId: string; title: string }[] }
  | null;

export type MetricModel = {
  hero: string;
  // A word after the figure ("%", "items", "pts").
  unit?: string;
  line: string;
  // The figure's colour, when it carries meaning (overdue red); the text colour otherwise.
  tone?: string;
  visual: MetricVisual;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The cards in each phase of the work, as the projection's three columns hold them.
function phaseSplit(projection: BoardProjection): MetricBar[] {
  return projection.columns.map((c) => ({
    key: c.column.id,
    label: c.column.name,
    count: c.count,
    color: PHASE_COLOURS[c.column.id as keyof typeof PHASE_COLOURS] ?? PHASE_COLOURS.todo,
  }));
}

function peopleCounts(items: readonly Item[]): { person: ItemPerson; count: number }[] {
  const counts = new Map<string, { person: ItemPerson; count: number }>();
  for (const it of items) {
    const p = itemAssignee(it);
    if (!p) continue;
    const row = counts.get(p.id);
    if (row) row.count += 1;
    else counts.set(p.id, { person: p, count: 1 });
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.person.name.localeCompare(b.person.name),
  );
}

export function metricModel(
  kind: MetricKind,
  board: { setup: PlanBoardSetup; projection: BoardProjection; items: Item[] },
  types: readonly ItemTypeDef[],
  now: Date,
): MetricModel {
  const { setup, projection, items } = board;
  const total = items.length;
  switch (kind) {
    case 'count':
      return {
        hero: String(total),
        unit: total === 1 ? 'card' : 'cards',
        line: total ? 'Across every board' : 'No cards yet',
        visual: total ? { kind: 'split', parts: phaseSplit(projection), total } : null,
      };
    case 'progress': {
      if (setup.doneColumnId === undefined)
        return { hero: '–', line: 'No board has a done column yet', visual: null };
      const pct = total ? Math.round((projection.doneCount / total) * 100) : 0;
      return {
        hero: String(pct),
        unit: '%',
        line: `${projection.doneCount} of ${plural(total, 'card', 'cards')} done`,
        tone: pct === 100 && total ? PHASE_COLOURS.done : undefined,
        visual: { kind: 'ring', pct },
      };
    }
    case 'people': {
      const rows = peopleCounts(items);
      return {
        hero: String(rows.length),
        unit: rows.length === 1 ? 'person' : 'people',
        line: rows.length
          ? 'With cards, most first'
          : total
            ? 'No one assigned yet'
            : 'No cards yet',
        visual: rows.length ? { kind: 'people', rows } : null,
      };
    }
    case 'types': {
      const counts = boardTypeCounts(
        items,
        types.map((t) => t.id),
      );
      const rows = counts.map(({ type, count }) => {
        const def = types.find((t) => t.id === type);
        return {
          key: type,
          label: def?.label ?? type,
          count,
          color: def?.color ?? PHASE_COLOURS.todo,
        };
      });
      return {
        hero: String(rows.length),
        unit: rows.length === 1 ? 'type' : 'types',
        line: total ? plural(total, 'card', 'cards') : 'No cards yet',
        visual: rows.length ? { kind: 'bars', rows, total } : null,
      };
    }
    case 'priorities': {
      const rows = priorityCounts(items).map(({ priority, count }) => ({
        key: priority,
        label: PRIORITY_LABELS[priority],
        count,
        color: PRIORITY_COLOURS[priority],
      }));
      const urgent = rows.find((r) => r.key === 'urgent')?.count ?? 0;
      return {
        hero: String(urgent),
        unit: 'urgent',
        line: rows.length
          ? `${rows.reduce((n, r) => n + r.count, 0)} with a priority`
          : 'No priorities set',
        tone: urgent ? PRIORITY_COLOURS.urgent : undefined,
        visual: rows.length ? { kind: 'bars', rows, total } : null,
      };
    }
    case 'due': {
      const { overdue, soon } = dueCounts(setup, items, now);
      return {
        hero: String(overdue),
        unit: 'overdue',
        line: `${soon} due in the next 7 days`,
        tone: overdue ? OVERDUE_RED : undefined,
        visual:
          overdue + soon
            ? {
                kind: 'split',
                parts: [
                  { key: 'overdue', label: 'Overdue', count: overdue, color: OVERDUE_RED },
                  { key: 'soon', label: 'Due soon', count: soon, color: DUE_SOON_AMBER },
                ],
                total: overdue + soon,
              }
            : null,
      };
    }
    case 'unassigned': {
      const n = unassignedCount(items);
      return {
        hero: String(n),
        unit: 'unassigned',
        line: total ? `Of ${plural(total, 'card', 'cards')}` : 'No cards yet',
        visual: total
          ? {
              kind: 'split',
              parts: [
                { key: 'none', label: 'Unassigned', count: n, color: DUE_SOON_AMBER },
                { key: 'some', label: 'Assigned', count: total - n, color: PHASE_COLOURS.doing },
              ],
              total,
            }
          : null,
      };
    }
    case 'points': {
      const { done, total: pts, estimated } = boardPoints(setup, items);
      const pct = pts ? Math.round((done / pts) * 100) : 0;
      return {
        hero: `${done}/${pts}`,
        unit: 'pts',
        line: estimated ? `${plural(estimated, 'card', 'cards')} estimated` : 'No estimates yet',
        visual: pts ? { kind: 'ring', pct } : null,
      };
    }
    case 'top-voted': {
      const top = topVoted(items);
      return top
        ? {
            hero: String(top.votes),
            unit: top.votes === 1 ? 'vote' : 'votes',
            line: itemTitle(top.item) || 'Untitled card',
            visual: {
              kind: 'card',
              itemId: top.item.id,
              title: itemTitle(top.item),
              votes: top.votes,
            },
          }
        : { hero: '0', unit: 'votes', line: 'No votes yet', visual: null };
    }
    case 'stale': {
      const n = staleCount(setup, items, now);
      const before = now.getTime() - STALE_DAYS * 86_400_000;
      const done = setup.columns.find((c) => c.id === setup.doneColumnId)?.status;
      const rows = items
        .filter((it) => it.updatedAt < before && !(done && it.fields['status'] === done))
        .sort((a, b) => a.updatedAt - b.updatedAt)
        .slice(0, 5)
        .map((it) => ({ itemId: it.id, title: itemTitle(it) || 'Untitled card' }));
      return {
        hero: String(n),
        unit: 'stale',
        line: `Not done, unchanged in ${STALE_DAYS} days`,
        tone: n ? DUE_SOON_AMBER : undefined,
        visual: rows.length ? { kind: 'list', rows } : null,
      };
    }
  }
}
