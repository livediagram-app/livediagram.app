import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  FLOW_DAILY_MAX,
  FLOW_RANGE_DEFAULT,
  FLOW_RANGES,
  cycleTimesOf,
  flowPeriodOf,
  percentileOf,
  throughputOf,
  weekStartOf,
  type FlowCard,
} from './flow-metrics';
import { FLOW_DAYS_MAX } from './flow-counts';
import { ITEMS_MAX } from './limits';
import { DAY_MS } from './plan-view-dates';
import type { StatusPhase } from './plan-views';

// Cycle time and throughput (docs/specs/026-plan/plan-views.md "Flow charts"): a finish is a move into Done from
// outside it, a start the first move into In Progress before it (else the card's making, or its oldest kept entry),
// each card once at its last finish in the range; the percentiles by nearest rank; Monday weeks and whole periods.

const phases = new Map<string, StatusPhase>([
  ['todo', 'todo'],
  ['doing', 'doing'],
  ['review', 'doing'],
  ['done', 'done'],
  ['released', 'done'],
]);

// Flow day 20,000 is a Friday; times are at hours into a day.
const D = 20_000;
const at = (day: number, hours = 0) => day * DAY_MS + hours * 3_600_000;
type Move = { itemId: string; step: FlowCard['moves'][number] };
const mv = (itemId: string, when: number, from: string | null, to: string | null): Move => ({
  itemId,
  step: [when, from, to],
});
const card = (id: string, createdAt = at(D - 30), type = 'task', since = createdAt): FlowCard => ({
  id,
  type,
  createdAt,
  since,
  moves: [],
});
// The cards with their moves, as the flow read sends them: each card's own, oldest first.
const cycle = (
  moves: readonly Move[],
  cards: readonly FlowCard[],
  fromDay: number,
  toDay: number,
  types?: ReadonlySet<string>,
) =>
  cycleTimesOf(
    cards.map((c) => ({
      ...c,
      moves: moves
        .filter((m) => m.itemId === c.id)
        .map((m) => m.step)
        .sort((a, b) => a[0] - b[0]),
    })),
    phases,
    fromDay,
    toDay,
    types,
  );

describe('flow constants', () => {
  it('offers the ranges the spec names, never past the kept days', () => {
    expect(FLOW_RANGES).toEqual([14, 30, 90, 180]);
    expect(FLOW_RANGE_DEFAULT).toBe(30);
    expect(Math.max(...FLOW_RANGES)).toBe(FLOW_DAYS_MAX);
    expect(flowPeriodOf(FLOW_DAILY_MAX)).toBe('day');
    expect(flowPeriodOf(30)).toBe('week');
  });
});

describe('percentileOf', () => {
  it('takes the nearest rank, null when empty', () => {
    expect(percentileOf([], 50)).toBeNull();
    expect(percentileOf([4], 85)).toBe(4);
    expect(percentileOf([1, 2, 3, 4], 50)).toBe(2);
    expect(percentileOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 85)).toBe(9);
    expect(percentileOf([1, 2, 3], 0)).toBe(1);
    expect(percentileOf([1, 2, 3], 100)).toBe(3);
  });
});

describe('cycleTimesOf', () => {
  it('measures from the first In Progress move to the finish, to one decimal', () => {
    const out = cycle(
      [
        mv('a', at(D - 5), 'todo', 'doing'),
        mv('a', at(D - 3, 12), 'doing', 'review'),
        mv('a', at(D - 2, 9), 'review', 'done'),
      ],
      [card('a')],
      D - 10,
      D,
    );
    expect(out.cards).toEqual([{ itemId: 'a', at: at(D - 2, 9), day: D - 2, days: 3.4 }]);
    expect(out).toMatchObject({ p50: 3.4, p85: 3.4 });
  });

  it('starts a card that never went In Progress when it was made, or at its oldest kept entry when later', () => {
    const out = cycle(
      [mv('made', at(D - 1), 'todo', 'done'), mv('old', at(D - 1), 'todo', 'done')],
      [card('made', at(D - 3)), card('old', at(D - 400), 'task', at(D - 2))],
      D - 10,
      D,
    );
    expect(out.cards.map((c) => [c.itemId, c.days])).toEqual([
      ['made', 2],
      ['old', 1],
    ]);
  });

  it('counts each card once, at its last finish in the range, from the first start before it', () => {
    const out = cycle(
      [
        mv('a', at(D - 9), 'todo', 'doing'),
        mv('a', at(D - 8), 'doing', 'done'),
        mv('a', at(D - 6), 'done', 'doing'),
        mv('a', at(D - 4), 'doing', 'done'),
      ],
      [card('a')],
      D - 10,
      D,
    );
    expect(out.cards).toEqual([{ itemId: 'a', at: at(D - 4), day: D - 4, days: 5 }]);
  });

  it('finishes nothing again on a move between two Done statuses, or on a move out of Done', () => {
    const out = cycle(
      [
        mv('a', at(D - 5), 'todo', 'doing'),
        mv('a', at(D - 4), 'doing', 'done'),
        mv('a', at(D - 1), 'done', 'released'),
        mv('b', at(D - 2), 'done', 'todo'),
      ],
      [card('a'), card('b')],
      D - 10,
      D,
    );
    expect(out.cards.map((c) => [c.itemId, c.day])).toEqual([['a', D - 4]]);
  });

  it('leaves out finishes outside the range, other types, unknown cards and statuses no board names', () => {
    const out = cycle(
      [
        mv('early', at(D - 20), 'todo', 'done'),
        mv('late', at(D + 1), 'todo', 'done'),
        mv('bug', at(D - 1), 'todo', 'done'),
        mv('ghost', at(D - 1), 'todo', 'done'),
        mv('odd', at(D - 1), null, 'shipped'),
        mv('none', at(D - 1), 'done', null),
      ],
      [card('early'), card('late'), card('bug', at(D - 2), 'bug'), card('odd'), card('none')],
      D - 10,
      D,
      new Set(['task']),
    );
    expect(out).toEqual({ cards: [], p50: null, p85: null });
  });

  it('never answers a negative time', () => {
    const future = cycle([mv('b', at(D - 1), 'todo', 'done')], [card('b', at(D))], D - 10, D);
    expect(future.cards[0]!.days).toBe(0);
  });

  it('orders the cards by finish and takes the percentiles over them', () => {
    const moves: Move[] = [];
    const cards: FlowCard[] = [];
    for (let i = 0; i < 10; i++) {
      cards.push(card(`c${i}`, at(D - 20)));
      moves.push(mv(`c${i}`, at(D - 20 + i), 'todo', 'doing'));
      moves.push(mv(`c${i}`, at(D - 20 + i + i + 1), 'doing', 'done'));
    }
    const out = cycle(moves, cards, D - 30, D);
    expect(out.cards.map((c) => c.days)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(out).toMatchObject({ p50: 5, p85: 9 });
  });

  it('reads a full plan (ITEMS_MAX cards) with 180 days of moves within budget', () => {
    const cards: FlowCard[] = [];
    const statuses = ['todo', 'doing', 'review', 'done'];
    for (let c = 0; c < ITEMS_MAX; c++) {
      const made = card(`c${c}`, at(D - 180));
      for (let m = 0; m < 12; m++)
        made.moves.push([at(D - 180 + m * 15, c % 24), statuses[m % 4]!, statuses[(m + 1) % 4]!]);
      cards.push(made);
    }
    let answered = 0;
    const ms = cpuMsOf(() => {
      answered = cycleTimesOf(cards, phases, D - FLOW_DAYS_MAX + 1, D).cards.length;
    });
    expect(answered).toBe(ITEMS_MAX);
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });
});

describe('weekStartOf', () => {
  it('names the Monday of a day’s week', () => {
    // Day 4 (5 January 1970) was a Monday.
    expect(weekStartOf(4)).toBe(4);
    expect(weekStartOf(10)).toBe(4);
    expect(weekStartOf(11)).toBe(11);
    expect(weekStartOf(3)).toBe(-3);
    expect(weekStartOf(-1)).toBe(-3);
    expect(new Date(weekStartOf(D) * DAY_MS).getUTCDay()).toBe(1);
  });
});

describe('throughputOf', () => {
  it('counts finishes per day, today running, and averages the whole days', () => {
    const out = throughputOf([{ day: D - 2 }, { day: D - 2 }, { day: D }], D - 3, D, 'day');
    expect(out.periods).toEqual([
      { start: D - 3, cards: 0, running: false, whole: true },
      { start: D - 2, cards: 2, running: false, whole: true },
      { start: D - 1, cards: 0, running: false, whole: true },
      { start: D, cards: 1, running: true, whole: false },
    ]);
    expect(out).toMatchObject({ period: 'day', average: 0.7 });
  });

  it('counts per Monday week, leaving the cut first week and the running week out of the average', () => {
    // D is a Friday: the range D - 24 (a Tuesday) to D spans four weeks, the first cut by the range's start.
    const monday = weekStartOf(D);
    const out = throughputOf(
      [
        { day: D - 22 },
        { day: monday - 7 },
        { day: monday - 6 },
        { day: monday - 1 },
        { day: D },
        { day: D - 40 },
      ],
      D - 24,
      D,
      'week',
    );
    expect(out.periods.map((p) => [p.start, p.cards, p.running, p.whole])).toEqual([
      [monday - 21, 1, false, false],
      [monday - 14, 0, false, true],
      [monday - 7, 3, false, true],
      [monday, 1, true, false],
    ]);
    expect(out.average).toBe(1.5);
  });

  it('answers no average with no whole period', () => {
    expect(throughputOf([], D, D, 'day')).toEqual({
      period: 'day',
      periods: [{ start: D, cards: 0, running: true, whole: false }],
      average: null,
    });
  });
});
