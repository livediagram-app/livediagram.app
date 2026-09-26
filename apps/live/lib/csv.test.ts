import { describe, expect, it } from 'vitest';
import { parseCsvLineData } from './csv';

describe('parseCsvLineData (docs/specs/009-elements/pie-chart.md)', () => {
  it('parses a header + rows into categories + series', () => {
    const out = parseCsvLineData('Month,Sales,Costs\nJan,10,5\nFeb,20,8\nMar,15,6');
    expect(out).not.toBeNull();
    expect(out!.categories).toEqual(['Jan', 'Feb', 'Mar']);
    expect(out!.series).toEqual([
      { name: 'Sales', values: [10, 20, 15] },
      { name: 'Costs', values: [5, 8, 6] },
    ]);
  });

  it('handles quoted fields, embedded commas, and CRLF', () => {
    const out = parseCsvLineData('x,"A, inc"\r\n"Q1",1\r\n"Q2",2\r\n');
    expect(out!.series[0]!.name).toBe('A, inc');
    expect(out!.categories).toEqual(['Q1', 'Q2']);
    expect(out!.series[0]!.values).toEqual([1, 2]);
  });

  it('coerces non-numeric / missing values to 0 and names blank series', () => {
    const out = parseCsvLineData('x,\nJan,nope\nFeb,');
    expect(out!.series[0]!.name).toBe('Series 1');
    expect(out!.series[0]!.values).toEqual([0, 0]);
  });

  it('returns null when there is no usable data', () => {
    expect(parseCsvLineData('')).toBeNull();
    expect(parseCsvLineData('just-a-header,A')).toBeNull();
    expect(parseCsvLineData('x\nJan\nFeb')).toBeNull(); // no series columns
  });
});
