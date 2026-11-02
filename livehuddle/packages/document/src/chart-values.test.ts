import { describe, expect, it } from 'vitest';
import { glyphWidth } from './graph-authoring';
import { barMarks, lineMarks, pieMarks } from './chart-marks';
import {
  barValueLabels,
  chartValueFontPx,
  lineValueLabels,
  pieValueLabels,
  shortNumber,
} from './chart-values';
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
    const names = labels.filter((l) => l.category);
    expect(names.map((l) => l.text)).toEqual(['Jul', 'Aug', 'Sep']);
    names.forEach((l) => expect(l.y).toBeGreaterThan(marks.baseline.y1));
  });

  it('cuts a column name to its slot, so neighbours never overprint', () => {
    const regions = Array.from({ length: 10 }, (_, i) => ({
      label: `Northern Europe ${i}`,
      value: 10 + i,
    }));
    const marks = barMarks({ x: 0, y: 0, w: 300, h: 200 }, regions, false);
    const names = barValueLabels(marks, regions, false, 12).filter((l) => l.category);
    const slot = (marks.baseline.x2 - marks.baseline.x1) / regions.length;
    for (const n of names) {
      expect(glyphWidth(n.text, 12)).toBeLessThanOrEqual(slot);
      expect(n.text.endsWith('…')).toBe(true);
    }
  });

  // docs/specs/009-elements/pie-chart.md "Below zero on a column or bar chart".
  it('reads a negative value past the end of its column or bar, and names columns under the plot', () => {
    const mixed = [
      { label: 'Q1', value: 30 },
      { label: 'Q2', value: -10 },
    ];
    const cols = barMarks(area, mixed, false);
    const labels = barValueLabels(cols, mixed, false, 12);
    const [up, down] = labels.filter((l) => !l.category);
    expect(up!.y).toBeLessThan(cols.bars[0]!.y);
    expect(down!.y).toBeGreaterThan(cols.bars[1]!.y + cols.bars[1]!.h);
    for (const name of labels.filter((l) => l.category)) {
      expect(name.y).toBeGreaterThan(cols.floor);
      expect(name.y).toBeGreaterThan(down!.y);
    }
    const bars = barMarks(area, mixed, true);
    const left = barValueLabels(bars, mixed, true, 12)[1]!;
    expect(left.anchor).toBe('end');
    expect(left.x).toBeLessThan(bars.bars[1]!.x);
  });

  it('puts a bar value after each bar, and no names', () => {
    const marks = barMarks(area, months, true);
    const labels = barValueLabels(marks, months, true, 12);
    expect(labels.every((l) => !l.category && l.anchor === 'start')).toBe(true);
    labels.forEach((l, i) => expect(l.x).toBeGreaterThan(marks.bars[i]!.tip.x));
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
    const labels = lineValueLabels(marks, series);
    expect(labels.map((l) => l.text)).toEqual(['1,000', '1,200', '100', '130']);
    expect(labels[0]!.y).toBeLessThan(marks.points[0]![0]!.y);
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

  it('prints the numbers and names only when asked', () => {
    const on = renderElementsToSvg(tab(true), {});
    expect(on).toContain('>120k<');
    expect(on).toContain('>Jul<');
    expect(renderElementsToSvg(tab(false), {})).not.toContain('>120k<');
  });
});
