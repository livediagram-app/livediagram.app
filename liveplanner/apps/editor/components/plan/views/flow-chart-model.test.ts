import { describe, expect, it } from 'vitest';
import { DAY_MS, flowCountsOf, type FlowCountRow } from '@liveplanner/items';
import { PHASE_COLOURS } from '@liveplanner/plan-art';
import {
  FLOW_DAY_LABEL_HALF_PX,
  FLOW_DAY_LABEL_PX,
  FLOW_KEY_LINES_MAX,
  FLOW_PLOT_MIN,
  bandColour,
  flowKeyLines,
  isDarkSurface,
  placeFootLabels,
  cumulativeFlowModel,
  cycleTimeSummary,
  daysText,
  flowDayLabel,
  flowDayTicks,
  flowPlotBox,
  flowX,
  niceTicks,
  periodLabel,
  throughputSummary,
} from './flow-chart-model';

// docs/specs/026-plan/plan-views.md "Flow charts".
// Flow day 20407 is Monday 3 November 2025 (UTC).
const MON = 20395;

describe('flow chart geometry', () => {
  it('gives whole-number ticks to a round top, never below 1', () => {
    expect(niceTicks(0)).toEqual({ top: 1, ticks: [0, 1] });
    expect(niceTicks(7)).toEqual({ top: 8, ticks: [0, 2, 4, 6, 8] });
    expect(niceTicks(37)).toEqual({ top: 40, ticks: [0, 10, 20, 30, 40] });
    expect(niceTicks(180).ticks.at(-1)).toBe(200);
  });

  it('names days in UTC and labels the foot evenly, today always', () => {
    expect(flowDayLabel(MON)).toBe(`${new Date(MON * DAY_MS).getUTCDate()} Nov`);
    const ticks = flowDayTicks(100, 129, 200);
    expect(ticks.at(-1)).toBe(129);
    expect(ticks.length).toBeLessThanOrEqual(Math.floor(200 / 44));
    expect(flowDayTicks(100, 100, 10)).toEqual([100]);
    expect(flowX(100 * DAY_MS, 100, 109)).toBe(0);
    expect(flowX(110 * DAY_MS, 100, 109)).toBe(1);
  });

  it('has no plot in a body too small for one', () => {
    expect(flowPlotBox(FLOW_PLOT_MIN.width - 1, 400, 30)).toBeNull();
    expect(flowPlotBox(400, FLOW_PLOT_MIN.height - 1, 30)).toBeNull();
    const box = flowPlotBox(400, 300, 30)!;
    expect(box.x).toBeGreaterThan(0);
    expect(box.width).toBeLessThan(400);
    expect(box.height).toBeLessThan(270);
  });

  it('says the summaries the spec gives', () => {
    expect(cycleTimeSummary(3, 6)).toBe('85% in 6 days or less · 50% in 3');
    expect(cycleTimeSummary(null, null)).toBe('');
    expect(daysText(1)).toBe('1 day');
    expect(daysText(0.5)).toBe('0.5 days');
    expect(throughputSummary({ period: 'week', periods: [], average: 8 })).toBe(
      '8 a week on average',
    );
    expect(throughputSummary({ period: 'day', periods: [], average: null })).toBe(
      'No whole day yet',
    );
    expect(periodLabel(MON, 'week')).toMatch(/^Week of \d+ Nov$/);
    expect(periodLabel(MON, 'day')).toMatch(/^\d+ Nov$/);
  });
});

describe('the foot, the key and the dark bands', () => {
  it('keeps every label inside the plot and drops any that would collide, today kept', () => {
    // Today's label sits at the right edge: clamped in, so the one before it is too close and goes.
    const placed = placeFootLabels(
      [
        { x: 100, text: 'a' },
        { x: 300, text: 'b' },
        { x: 350, text: 'c' },
        { x: 395, text: 'today' },
      ],
      30,
      400,
    );
    expect(placed.at(-1)).toEqual({ x: 400 - FLOW_DAY_LABEL_HALF_PX, text: 'today' });
    expect(placed.map((l) => l.text)).toEqual(['a', 'b', 'today']);
    for (let i = 1; i < placed.length; i++)
      expect(placed[i]!.x - placed[i - 1]!.x).toBeGreaterThanOrEqual(FLOW_DAY_LABEL_PX);
    expect(placeFootLabels([{ x: 0 }], 30, 400)[0]!.x).toBe(30 + FLOW_DAY_LABEL_HALF_PX);
  });

  it('wraps a key that does not fit to more lines, up to its most', () => {
    expect(flowKeyLines(['To Do', 'Doing', 'Done'], 400)).toBe(1);
    expect(flowKeyLines(['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'], 200)).toBe(3);
    expect(
      flowKeyLines(
        Array.from({ length: 30 }, () => 'A long status'),
        200,
      ),
    ).toBe(FLOW_KEY_LINES_MAX);
  });

  it('tells dark surfaces, and brightens work in progress there while every band stays visible', () => {
    expect(isDarkSurface('#0f172a')).toBe(true);
    expect(isDarkSurface('#ffffff')).toBe(false);
    expect(isDarkSurface('white')).toBe(false);
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) + ((n >> 8) & 255) + (n & 255)) / 3;
    };
    const dark = '#0f172a';
    const doing = bandColour('doing', 0, dark);
    for (const t of [0, 0.5, 1]) {
      expect(lum(bandColour('todo', t, dark))).toBeLessThan(lum(doing));
      expect(lum(bandColour('done', t, dark))).toBeLessThan(lum(doing));
      // Never the surface's own darkness: each band clears it clearly.
      expect(lum(bandColour('todo', t, dark)) - lum(dark)).toBeGreaterThan(60);
    }
    expect(bandColour('done', 0, '#ffffff')).toBe(PHASE_COLOURS.done);
  });
});

describe('cumulativeFlowModel', () => {
  const names = new Map([
    ['todo', 'To Do'],
    ['doing', 'In Progress'],
    ['review', 'In Review'],
    ['done', 'Done'],
    ['shipped', 'Shipped'],
  ]);
  const phases = new Map([
    ['todo', 'todo' as const],
    ['doing', 'doing' as const],
    ['review', 'doing' as const],
    ['done', 'done' as const],
    ['shipped', 'done' as const],
  ]);
  const row = (day: number, status: string, cards: number): FlowCountRow => ({
    day,
    type: 'task',
    status,
    cards,
  });

  it('stacks Done at the bottom and the first column on top, in phase colour families', () => {
    const rows = [
      row(10, 'todo', 5),
      row(10, 'doing', 2),
      row(10, 'review', 1),
      row(10, 'done', 3),
      row(10, 'shipped', 1),
      row(10, '', 1),
      row(10, 'gone-away', 1),
      row(11, 'todo', 4),
      row(11, 'doing', 3),
      row(11, 'review', 1),
      row(11, 'done', 4),
      row(11, 'shipped', 1),
      row(11, '', 1),
      row(11, 'gone-away', 1),
    ];
    const counts = flowCountsOf(rows, 10, 11);
    const m = cumulativeFlowModel(counts, phases, names, '#ffffff');
    expect(m.bands.map((b) => b.label)).toEqual([
      'Shipped',
      'Done',
      'In Review',
      'In Progress',
      'Gone away',
      'To Do',
      'No status',
    ]);
    // The status nearest the band under it keeps the phase's own colour.
    expect(m.bands[0]!.colour).toBe(PHASE_COLOURS.done);
    expect(m.bands[1]!.colour).not.toBe(PHASE_COLOURS.done);
    expect(m.bands[2]!.colour).toBe(PHASE_COLOURS.doing);
    expect(m.totals).toEqual([14, 15]);
    expect(m.max).toBe(15);
    expect(m.bands.at(-1)!.tops).toEqual([14, 15]);
    expect(m.inProgress).toBe(4);
    expect(m.done).toBe(5);
    expect(m.countedFrom).toBe(0);
  });

  it('answers nothing for a range with no counts', () => {
    const m = cumulativeFlowModel(flowCountsOf([], 10, 12), phases, names, '#000000');
    expect(m.bands).toEqual([]);
    expect(m.countedFrom).toBeNull();
    expect(m.max).toBe(0);
    expect(m.inProgress).toBe(0);
  });
});
