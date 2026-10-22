import { describe, expect, it } from 'vitest';
import { chartAxisLabel } from './chart-frame';

describe('chartAxisLabel', () => {
  it('keeps a month name whole when the chart has room for it', () => {
    // 4 categories over 300px: 100px between labels.
    expect(chartAxisLabel('January', 300, 4)).toBe('January');
    expect(chartAxisLabel('Q1 2025', 300, 4)).toBe('Q1 2025');
  });

  it('shortens a label only past the gap to the next one', () => {
    // 12 categories over 220px: 20px between labels, so the six-character floor.
    expect(chartAxisLabel('January', 220, 12)).toBe('Janua…');
    expect(chartAxisLabel('June', 220, 12)).toBe('June');
  });

  it('gives a lone category the whole plot', () => {
    expect(chartAxisLabel('All of last year', 200, 1)).toBe('All of last year');
  });
});
