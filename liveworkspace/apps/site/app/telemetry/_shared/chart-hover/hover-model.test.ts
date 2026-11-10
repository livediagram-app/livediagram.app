import { describe, expect, it } from 'vitest';
import {
  bucketCentres,
  changeOf,
  changeText,
  cycleKey,
  dayHeading,
  formatCount,
  liveSummary,
  nearestIndex,
  placeTooltip,
  stepIndex,
  tooltipRows,
  type HoverSeries,
} from './hover-model';

// The charts' hover model (liveworkspace/docs/specs/008-telemetry/telemetry.md "Tooltips").

const line = (key: string, values: (number | null)[], extra: Partial<HoverSeries> = {}) =>
  ({ key, label: key, color: 'red', values, ...extra }) satisfies HoverSeries;

describe('snapping', () => {
  it('puts a line chart’s first point at the left edge and its last at the right', () => {
    expect([...bucketCentres(5, 'points')]).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect([...bucketCentres(1, 'points')]).toEqual([0.5]);
  });

  it('centres a bar chart’s buckets in equal bands', () => {
    expect([...bucketCentres(4, 'bands')]).toEqual([0.125, 0.375, 0.625, 0.875]);
  });

  it('snaps anywhere on the plot to the nearest bucket, past the edges to the ends', () => {
    const xs = bucketCentres(5, 'points');
    expect(nearestIndex(xs, 0.1)).toBe(0);
    expect(nearestIndex(xs, 0.13)).toBe(1);
    expect(nearestIndex(xs, 0.62)).toBe(2);
    expect(nearestIndex(xs, 0.63)).toBe(3);
    expect(nearestIndex(xs, -2)).toBe(0);
    expect(nearestIndex(xs, 9)).toBe(4);
    expect(nearestIndex(new Float64Array(0), 0.5)).toBeNull();
  });

  it('snaps a bar chart to the band under the pointer', () => {
    const xs = bucketCentres(4, 'bands');
    expect(nearestIndex(xs, 0.01)).toBe(0);
    expect(nearestIndex(xs, 0.26)).toBe(1);
    expect(nearestIndex(xs, 0.74)).toBe(2);
    expect(nearestIndex(xs, 0.99)).toBe(3);
  });

  it('agrees with a linear scan at every pointer position', () => {
    const xs = bucketCentres(37, 'points');
    for (let k = 0; k <= 1000; k++) {
      const x = k / 1000;
      let best = 0;
      for (let i = 1; i < xs.length; i++)
        if (Math.abs(xs[i]! - x) < Math.abs(xs[best]! - x)) best = i;
      expect(Math.abs(xs[nearestIndex(xs, x)!]! - x)).toBeCloseTo(Math.abs(xs[best]! - x), 12);
    }
  });
});

describe('keyboard steps', () => {
  it('moves a bucket at a time and stops at the ends', () => {
    expect(stepIndex('ArrowLeft', 3, 10)).toBe(2);
    expect(stepIndex('ArrowRight', 3, 10)).toBe(4);
    expect(stepIndex('ArrowLeft', 0, 10)).toBe(0);
    expect(stepIndex('ArrowRight', 9, 10)).toBe(9);
  });

  it('starts from the latest bucket', () => {
    expect(stepIndex('ArrowLeft', null, 10)).toBe(9);
    expect(stepIndex('ArrowRight', null, 10)).toBe(9);
  });

  it('jumps to the ends and a week at a time', () => {
    expect(stepIndex('Home', 5, 10)).toBe(0);
    expect(stepIndex('End', 5, 10)).toBe(9);
    expect(stepIndex('PageUp', 5, 30)).toBe(0);
    expect(stepIndex('PageUp', 20, 30)).toBe(13);
    expect(stepIndex('PageDown', 20, 30)).toBe(27);
    expect(stepIndex('PageDown', null, 30)).toBe(29);
  });

  it('leaves other keys and empty charts alone', () => {
    expect(stepIndex('a', 3, 10)).toBeUndefined();
    expect(stepIndex('ArrowLeft', null, 0)).toBeUndefined();
  });

  it('cycles the emphasis through the rows, wrapping', () => {
    const keys = ['a', 'b', 'c'];
    expect(cycleKey(keys, null, 1)).toBe('a');
    expect(cycleKey(keys, null, -1)).toBe('c');
    expect(cycleKey(keys, 'c', 1)).toBe('a');
    expect(cycleKey(keys, 'a', -1)).toBe('c');
    expect(cycleKey(keys, 'gone', 1)).toBe('a');
    expect(cycleKey([], null, 1)).toBeNull();
  });
});

describe('placement', () => {
  const viewport = { width: 1200, height: 800 };
  const size = { width: 200, height: 120 };
  const plot = { left: 100, top: 300, right: 900, bottom: 460 };

  it('sits right of the crosshair, level with the plot’s top', () => {
    expect(placeTooltip({ plot, x: 400, size, viewport })).toEqual({
      left: 414,
      top: 300,
      side: 'right',
    });
  });

  it('flips left of the crosshair near the viewport’s right edge, never covering it', () => {
    const p = placeTooltip({ plot, x: 1050, size, viewport });
    expect(p.side).toBe('left');
    expect(p.left + size.width).toBeLessThan(1050);
  });

  it('goes above the plot on a narrow screen, inside the viewport', () => {
    const phone = { width: 375, height: 700 };
    const p = placeTooltip({
      plot: { left: 16, top: 300, right: 359, bottom: 420 },
      x: 187,
      size: { width: 220, height: 120 },
      viewport: phone,
    });
    expect(p.side).toBe('above');
    expect(p.top + 120).toBeLessThan(300);
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.left + 220).toBeLessThanOrEqual(375 - 8);
  });

  it('goes below a plot at the top of the screen', () => {
    const phone = { width: 375, height: 700 };
    const p = placeTooltip({
      plot: { left: 16, top: 40, right: 359, bottom: 160 },
      x: 187,
      size: { width: 220, height: 120 },
      viewport: phone,
    });
    expect(p).toEqual({ left: 77, top: 174, side: 'below' });
  });

  it('stays on screen when the plot is scrolled half out of view', () => {
    expect(placeTooltip({ plot: { ...plot, top: -60 }, x: 400, size, viewport }).top).toBe(8);
    expect(placeTooltip({ plot: { ...plot, top: 760 }, x: 400, size, viewport }).top).toBe(672);
  });
});

describe('formatting', () => {
  it('writes counts with thousands separators', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
  });

  it('heads a day with its weekday, in UTC', () => {
    expect(dayHeading(Date.UTC(2026, 10, 10), 'en-GB')).toBe('Tue 10 Nov');
    expect(dayHeading(Date.UTC(2026, 10, 10), 'en-US')).toBe('Tue, Nov 10');
  });

  it('says how a count moved against the bucket before', () => {
    expect(changeText(changeOf(112, 100)!)).toBe('+12%');
    expect(changeText(changeOf(95, 100)!)).toBe('−5%');
    expect(changeText(changeOf(1001, 1000)!)).toBe('+<1%');
    expect(changeText(changeOf(5, 0)!)).toBe('New');
    expect(changeText(changeOf(7, 7)!)).toBe('Flat');
    expect(changeOf(null, 3)).toBeNull();
    expect(changeOf(3, null)).toBeNull();
  });
});

describe('tooltip rows', () => {
  const series = [
    line('a', [10, 20, 5]),
    line('b', [1, 40, 5]),
    line('c', [3, null, 9]),
    line('Total', [14, 60, 19], { total: true }),
  ];

  it('lists every line largest first, no reading last, and the Total line as the Total row', () => {
    const { rows, total } = tooltipRows(series, 1);
    expect(rows.map((r) => [r.key, r.text])).toEqual([
      ['b', '40'],
      ['a', '20'],
      ['c', 'No Reading'],
    ]);
    expect(total?.text).toBe('60');
    expect(total?.change).toEqual({ dir: 'up', pct: '329%' });
  });

  it('keeps the lines’ order for a tie', () => {
    expect(tooltipRows(series, 2).rows.map((r) => r.key)).toEqual(['c', 'a', 'b']);
  });

  it('has no change on the first bucket, or when asked for none', () => {
    expect(tooltipRows(series, 0).rows.every((r) => r.change === null)).toBe(true);
    expect(tooltipRows(series, 2, { change: false }).rows.every((r) => r.change === null)).toBe(
      true,
    );
  });

  it('adds the lines up as the Total for a chart whose lines add up, or shows none', () => {
    const two = [line('New', [1, 2]), line('Returning', [3, 4])];
    const { total } = tooltipRows(two, 1, { totalLabel: 'Visits' });
    expect(total).toMatchObject({
      label: 'Visits',
      value: 6,
      text: '6',
      change: { dir: 'up', pct: '50%' },
    });
    expect(tooltipRows(two, 1).total).toBeNull();
  });

  it('uses the chart’s own format', () => {
    expect(
      tooltipRows([line('p75', [1500])], 0, { format: (v) => `${v / 1000} s` }).rows[0]!.text,
    ).toBe('1.5 s');
  });

  it('reads the bucket out for a screen reader', () => {
    const { rows, total } = tooltipRows(series, 1);
    expect(liveSummary('Tue 10 Nov', rows, total)).toBe(
      'Tue 10 Nov. b 40, up 3,900%. a 20, up 100%. c No Reading. Total 60, up 329%.',
    );
    const flat = tooltipRows([line('x', [2, 2]), line('y', [0, 3])], 1);
    expect(liveSummary('Day', flat.rows, null)).toBe('Day. y 3, new. x 2, flat.');
  });
});

describe('performance', () => {
  // The worst case the dashboard could draw: a year of days by six lines. Snapping is a binary search per move,
  // and a bucket's tooltip is six rows sorted; both stay far inside one frame however many buckets there are.
  it('snaps and builds the tooltip for 365 days by 6 lines inside a budget', () => {
    const n = 365;
    const lines = Array.from({ length: 6 }, (_, s) =>
      line(
        `s${s}`,
        Array.from({ length: n }, (_, i) => (i * (s + 3)) % 997),
      ),
    );
    const xs = bucketCentres(n, 'points');
    const moves = 100_000;
    // CPU time, not wall time, so a loaded machine's waits don't count against the budget.
    const cpu = () => {
      const { user, system } = process.cpuUsage();
      return (user + system) / 1000;
    };
    const start = cpu();
    let sink = 0;
    for (let k = 0; k < moves; k++) sink += nearestIndex(xs, (k % 1000) / 1000)!;
    const snap = cpu() - start;
    const built = cpu();
    for (let i = 0; i < n; i++) sink += tooltipRows(lines, i, { totalLabel: 'Total' }).rows.length;
    const rows = cpu() - built;
    expect(sink).toBeGreaterThan(0);
    // 100,000 moves would be about 30 minutes of pointer events at 60 a second; measured near 5 ms.
    expect(snap).toBeLessThan(250);
    // Every bucket's tooltip once: measured near 2 ms.
    expect(rows).toBeLessThan(250);
  });
});
