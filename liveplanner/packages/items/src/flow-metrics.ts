// Cycle time and throughput from the plan's card history (docs/specs/026-plan/plan-views.md "Flow charts", blueprint
// plan-views.md "Flow charts"): when each card finished in a range and how long it took, the 50th and 85th
// percentile, and how many cards finished in each day or week. Pure: the api reads the moves
// (apps/api routes/flow-route.ts, `FlowResponse`), and the Cycle Time and Throughput charts draw what this answers.

import { DAY_MS } from './plan-view-dates';
import { flowDayOf } from './flow-counts';
import type { StatusPhase } from './plan-views';

// The ranges a flow chart offers, in days, and the one it reads when none is set.
export const FLOW_RANGES = [14, 30, 90, 180] as const;
export const FLOW_RANGE_DEFAULT = 30;
// A range this short or shorter reads Throughput per day, a longer one per week.
export const FLOW_DAILY_MAX = 14;

// One move from a card's history: at `at`, the card went from status `from` to status `to` (null for none).
export type FlowMove = { itemId: string; at: number; from: string | null; to: string | null };
// A card that moved in the range: its type, when it was made, and its oldest kept history entry.
export type FlowCard = { id: string; type: string; createdAt: number; since: number };
// A card finished in the range: when (`at`, and its flow day), and the days it took, to one decimal.
export type CycleTime = { itemId: string; at: number; day: number; days: number };
export type CycleTimes = { cards: CycleTime[]; p50: number | null; p85: number | null };

export type FlowPeriod = 'day' | 'week';
// One Throughput bar: the period starting on flow day `start` and the cards finished in it. `running` for the period
// holding `toDay` (today, not over yet: today or this week), `whole` when it lies inside the range and is not running.
export type ThroughputPeriod = { start: number; cards: number; running: boolean; whole: boolean };
export type Throughput = {
  period: FlowPeriod;
  periods: ThroughputPeriod[];
  average: number | null;
};

const oneDecimal = (n: number) => Math.round(n * 10) / 10;

// The `p`th percentile of ascending `sorted` by nearest rank (blueprint DEFAULTS D111), null when empty.
export function percentileOf(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1]!;
}

// The cards of `types` (every type when absent) that finished between flow days `fromDay` and `toDay`, each once at
// its last finish in the range, with the days from its start. A finish is a move into a Done phase status from one
// outside it; the start is the first move into an In Progress status before that finish, else when the card was made,
// or its oldest kept entry when that is later (its history no longer reaches back to its making). Linear in the moves,
// plus the sort of the answer.
export function cycleTimesOf(
  moves: readonly FlowMove[],
  cards: readonly FlowCard[],
  phases: ReadonlyMap<string, StatusPhase>,
  fromDay: number,
  toDay: number,
  types?: ReadonlySet<string>,
): CycleTimes {
  const byId = new Map<string, FlowCard>();
  for (const card of cards) if (!types || types.has(card.type)) byId.set(card.id, card);
  const phaseOf = (status: string | null) => (status === null ? undefined : phases.get(status));
  // Per card, in time order: the first start seen and the last finish in the range with the start before it.
  const state = new Map<
    string,
    { started: number | null; finish: number | null; start: number | null }
  >();
  const ordered = moves.every((m, i) => i === 0 || moves[i - 1]!.at <= m.at)
    ? moves
    : [...moves].sort((a, b) => a.at - b.at);
  for (const move of ordered) {
    if (!byId.has(move.itemId)) continue;
    let s = state.get(move.itemId);
    if (!s) state.set(move.itemId, (s = { started: null, finish: null, start: null }));
    const to = phaseOf(move.to);
    if (to === 'doing' && s.started === null) s.started = move.at;
    if (to !== 'done' || phaseOf(move.from) === 'done') continue;
    const day = flowDayOf(move.at);
    if (day < fromDay || day > toDay) continue;
    s.finish = move.at;
    s.start = s.started;
  }
  const out: CycleTime[] = [];
  for (const [itemId, s] of state) {
    if (s.finish === null) continue;
    const card = byId.get(itemId)!;
    const start = s.start ?? Math.max(card.createdAt, card.since);
    out.push({
      itemId,
      at: s.finish,
      day: flowDayOf(s.finish),
      days: Math.max(0, oneDecimal((s.finish - start) / DAY_MS)),
    });
  }
  out.sort((a, b) => a.at - b.at || (a.itemId < b.itemId ? -1 : 1));
  const sorted = out.map((c) => c.days).sort((a, b) => a - b);
  return { cards: out, p50: percentileOf(sorted, 50), p85: percentileOf(sorted, 85) };
}

// How a range of `days` reads Throughput: per day up to FLOW_DAILY_MAX days, else per week.
export function flowPeriodOf(days: number): FlowPeriod {
  return days <= FLOW_DAILY_MAX ? 'day' : 'week';
}

// The Monday that starts flow day `day`'s week (day 0, 1 January 1970, was a Thursday).
export function weekStartOf(day: number): number {
  return day - ((((day + 3) % 7) + 7) % 7);
}

// The cards finished in each period from the one holding `fromDay` to the one holding `toDay`, each card counted in
// the period of its finish (cycleTimesOf answers each once), and the average over the whole periods. Linear in the
// finishes and the periods.
export function throughputOf(
  finished: readonly Pick<CycleTime, 'day'>[],
  fromDay: number,
  toDay: number,
  period: FlowPeriod,
): Throughput {
  const length = period === 'day' ? 1 : 7;
  const startOf = (day: number) => (period === 'day' ? day : weekStartOf(day));
  const first = startOf(fromDay);
  const periods: ThroughputPeriod[] = [];
  for (let start = first; start <= toDay; start += length) {
    const running = start + length > toDay;
    periods.push({ start, cards: 0, running, whole: !running && start >= fromDay });
  }
  for (const { day } of finished) {
    if (day < fromDay || day > toDay) continue;
    periods[(startOf(day) - first) / length]!.cards++;
  }
  let total = 0;
  let whole = 0;
  for (const p of periods)
    if (p.whole) {
      total += p.cards;
      whole++;
    }
  return { period, periods, average: whole === 0 ? null : oneDecimal(total / whole) };
}
