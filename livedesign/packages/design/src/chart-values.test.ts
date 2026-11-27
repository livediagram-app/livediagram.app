import { describe, expect, it } from 'vitest';
import { glyphWidth } from './label-box';
import { barMarks, lineMarks, pieMarks } from '@liveworkspace/element-model/chart-marks';
import {
  barCategoryLabels,
  barValueLabels,
  chartValueFontPx,
  lineValueLabels,
  pieValueLabels,
  shortNumber,
} from '@liveworkspace/element-model/chart-values';
import { renderElementsToSvg } from './svg-render';
import type { Tab } from './index';

// Show Values (docs/specs/009-elements/pie-chart.md).

const area = { x: 0, y: 0, w: 300, h: 200 };
const months = [
  { label: 'Jul', value: 120000 },
  { label: 'Aug', value: 135000 },
  { label: 'Sep', value: 160000 },
];

describe('shortNumber', () => {
  it('reads a value that rounds up to the next unit in that unit', () => {
    expect(shortNumber(999_960)).toBe('1M');
    expect(shortNumber(999_960_000)).toBe('1B');
    expect(shortNumber(-999_960)).toBe('-1M');
    expect(shortNumber(999_940)).toBe('999.9k');
  });

  it('reads numbers short, at most one decimal', () => {
    expect(shortNumber(42)).toBe('42');
    expect(shortNumber(3.14159)).toBe('3.1');
    expect(shortNumber(120000)).toBe('120k');
    expect(shortNumber(1500000)).toBe('1.5M');
    expect(shortNumber(2_000_000_000)).toBe('2B');
    expect(shortNumber(-4500)).toBe('-4,500');
    expect(shortNumber(1080)).toBe('1,080');
    expect(shortNumber(-45000)).toBe('-45k');
  });
});

describe('value labels', () => {
  it('puts a column value above each column and its name under the baseline', () => {
    const marks = barMarks(area, months, false);
    const labels = barValueLabels(marks, months, false, 12);
    const values = labels.filter((l) => !l.category);
    expect(values.map((l) => l.text)).toEqual(['120k', '135k', '160k']);
    values.forEach((l, i) => expect(l.y).toBeLessThan(marks.bars[i]!.y));
    expect(labels.some((l) => l.category)).toBe(false);
    const names = barCategoryLabels(marks, months, false, 11);
    expect(names.map((l) => l.text)).toEqual(['Jul', 'Aug', 'Sep']);
    names.forEach((l) => expect(l.y).toBeGreaterThan(marks.baseline.y1));
  });

  it('cuts a column name to its slot, so neighbours never overprint', () => {
    const regions = Array.from({ length: 10 }, (_, i) => ({
      label: `Northern Europe ${i}`,
      value: 10 + i,
    }));
    const marks = barMarks({ x: 0, y: 0, w: 300, h: 200 }, regions, false);
    const names = barCategoryLabels(marks, regions, false, 12);
    expect(names).toHaveLength(regions.length);
    const slot = (marks.baseline.x2 - marks.baseline.x1) / regions.length;
    for (const n of names) {
      expect(glyphWidth(n.text, 12)).toBeLessThanOrEqual(slot);
      expect(n.text.endsWith('…')).toBe(true);
    }
  });

  it('puts a negative column value under its column, and every name below the lowest column', () => {
    const mixed = [
      { label: 'Jul', value: 30 },
      { label: 'Aug', value: -10 },
    ];
    const marks = barMarks(area, mixed, false);
    const labels = barValueLabels(marks, mixed, false, 12);
    const [up, down] = labels.filter((l) => !l.category);
    expect(up!.y).toBeLessThan(marks.bars[0]!.y);
    expect(down!.y).toBeGreaterThan(marks.bars[1]!.y + marks.bars[1]!.h);
    for (const name of barCategoryLabels(marks, mixed, false, 12))
      expect(name.y).toBeGreaterThan(down!.y);

    const across = barValueLabels(barMarks(area, mixed, true), mixed, true, 12);
    expect(across[1]!.anchor).toBe('end');
  });

  it('puts a bar value after each bar, and its name left of the plot, beside the bar', () => {
    const marks = barMarks(area, months, true, 0, 0, false, 11);
    const labels = barValueLabels(marks, months, true, 12);
    expect(labels.every((l) => !l.category && l.anchor === 'start')).toBe(true);
    labels.forEach((l, i) => expect(l.x).toBeGreaterThan(marks.bars[i]!.tip.x));
    const names = barCategoryLabels(marks, months, true, 11);
    expect(names.map((l) => l.text)).toEqual(['Jul', 'Aug', 'Sep']);
    names.forEach((n, i) => {
      expect(n.anchor).toBe('end');
      expect(n.x).toBeLessThan(marks.floor);
      expect(Math.abs(n.y - marks.bars[i]!.tip.y)).toBeLessThan(11);
    });
  });

  it('reads a pie as percentages when it adds up to 100, and skips empty wedges', () => {
    const regions = [
      { label: 'UK', value: 40 },
      { label: 'EU', value: 35 },
      { label: 'US', value: 25 },
      { label: 'Other', value: 0 },
    ];
    const labels = pieValueLabels(pieMarks(area, regions, false), regions, 12);
    expect(labels.map((l) => l.text)).toEqual(['40%', '35%', '25%']);
    expect(labels.map((l) => l.onMark)).toEqual([0, 1, 2]);
    const counts = [
      { label: 'A', value: 1200 },
      { label: 'B', value: 300 },
    ];
    expect(pieValueLabels(pieMarks(area, counts, false), counts, 12).map((l) => l.text)).toEqual([
      '1,200',
      '300',
    ]);
  });

  it('puts a value above each point of each series', () => {
    const series = [
      { name: 'Signups', values: [1000, 1200] },
      { name: 'Paid', values: [100, 130] },
    ];
    const marks = lineMarks(area, ['W1', 'W2'], series, 'line');
    const labels = lineValueLabels(marks, series, 12);
    expect(labels.map((l) => l.text).sort()).toEqual(['1,000', '1,200', '100', '130']);
    expect(labels.find((l) => l.text === '1,000')!.y).toBeLessThan(marks.points[0]![0]!.y);
  });

  it('thins a long line’s numbers to its end, its extremes and what fits without overprinting', () => {
    const values = Array.from({ length: 40 }, (_, i) => 100 + i * 5);
    const series = [{ name: 'Daily', values }];
    const cats = values.map((_, i) => `D${i}`);
    const marks = lineMarks(area, cats, series, 'line');
    const labels = lineValueLabels(marks, series, 12);
    expect(labels.length).toBeLessThan(values.length);
    // The end first, then the highest and the lowest.
    expect(labels[0]!.text).toBe('295');
    expect(labels[0]!.x).toBeLessThanOrEqual(marks.points[0]![39]!.x);
    const texts = labels.map((l) => l.text);
    expect(texts).toContain('295');
    expect(texts).toContain('100');
    const half = (t: string) => glyphWidth(t, 12) / 2;
    for (let a = 0; a < labels.length; a++)
      for (let b = a + 1; b < labels.length; b++) {
        const [p, q] = [labels[a]!, labels[b]!];
        const apart =
          Math.abs(p.x - q.x) >= half(p.text) + half(q.text) || Math.abs(p.y - q.y) >= 14;
        expect(apart).toBe(true);
      }
  });

  it('sizes the numbers a step under the key, never under 9px', () => {
    expect(chartValueFontPx('md')).toBeLessThan(14);
    expect(chartValueFontPx('sm')).toBeGreaterThanOrEqual(9);
  });
});

describe('Show Values in an export', () => {
  const tab = (chartValues: boolean): Tab => ({
    id: 't',
    name: 'T',
    elements: [
      {
        id: 'c',
        type: 'shape',
        shape: 'bar-chart',
        x: 0,
        y: 0,
        width: 320,
        height: 240,
        pieSlices: months,
        chartValues,
      },
    ],
  });

  it('prints the numbers only when asked, and always names the columns', () => {
    const on = renderElementsToSvg(tab(true), {});
    expect(on).toContain('>120k<');
    const off = renderElementsToSvg(tab(false), {});
    expect(off).not.toContain('>120k<');
    expect(off).toContain('>Jul<');
  });
});
