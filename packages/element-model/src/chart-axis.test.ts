import { describe, expect, it } from 'vitest';
import { axisScale } from './chart-axis';
import { barMarks } from './chart-marks';
import { shortNumber } from './chart-values';

// docs/specs/009-elements/pie-chart.md "Show Axis", "Below zero on a column or bar chart", in every product.

describe('axisScale', () => {
  it('reads a fine step to its own decimals, so no two ticks read the same, and no -0', () => {
    expect(axisScale(-0.03, 0.05).ticks.map((t) => t.text)).toEqual([
      '-0.04',
      '-0.02',
      '0',
      '0.02',
      '0.04',
      '0.06',
    ]);
    expect(axisScale(0, 0.3).ticks.map((t) => t.text)).toEqual(['0', '0.1', '0.2', '0.3']);
  });
});

describe('shortNumber', () => {
  it('reads a value rounding to nothing as 0, never -0, and takes the decimals it is asked for', () => {
    expect(shortNumber(-0.04)).toBe('0');
    expect(shortNumber(-0.06)).toBe('-0.1');
    expect(shortNumber(0.025, 2)).toBe('0.03');
  });
});

describe('barMarks', () => {
  const area = { x: 0, y: 0, w: 300, h: 200 };

  it('draws a value that is not a number as zero, on the baseline', () => {
    const marks = barMarks(
      area,
      [
        { label: 'a', value: 10 },
        { label: 'b', value: Number.NaN },
      ],
      false,
    );
    expect(marks.bars[1]!.h).toBe(0);
    expect(marks.bars[1]!.y).toBe(marks.baseline.y1);
    expect(Number.isFinite(marks.bars[0]!.h)).toBe(true);
  });

  it('hangs a negative column below a zero baseline, its names under the plot foot', () => {
    const marks = barMarks(
      area,
      [
        { label: 'up', value: 10 },
        { label: 'down', value: -5 },
      ],
      false,
    );
    const [up, down] = marks.bars;
    expect(up!.y + up!.h).toBeCloseTo(marks.baseline.y1);
    expect(down!.y).toBeCloseTo(marks.baseline.y1);
    expect(marks.floor).toBeGreaterThan(marks.baseline.y1);
  });
});
