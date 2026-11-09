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

  it('reads a stray quote mid-field as a character, never merging the rows after it', () => {
    const out = parseCsvLineData('Item,Count\n5" monitor,3\nDesk,2');
    expect(out!.categories).toEqual(['5" monitor', 'Desk']);
    expect(out!.series[0]!.values).toEqual([3, 2]);
  });

  it('coerces non-numeric / missing values to 0 and names blank series', () => {
    const out = parseCsvLineData('x,\nJan,nope\nFeb,');
    expect(out!.series[0]!.name).toBe('Series 1');
    expect(out!.series[0]!.values).toEqual([0, 0]);
  });

  it('reads a spreadsheet saved with semicolons or tabs, not one column and nothing', () => {
    // Excel where `,` is the decimal point saves `;`-separated: it read as one column and the import did nothing.
    const semi = parseCsvLineData('Month;Sales;Costs\nJan;10,5;1.234,5\nFeb;20;8');
    expect(semi!.categories).toEqual(['Jan', 'Feb']);
    expect(semi!.series).toEqual([
      { name: 'Sales', values: [10.5, 20] },
      { name: 'Costs', values: [1234.5, 8] },
    ]);
    const tabbed = parseCsvLineData('Month\tSales\nJan\t3\nFeb\t4');
    expect(tabbed!.series).toEqual([{ name: 'Sales', values: [3, 4] }]);
  });

  it('keeps the number a spreadsheet formatted: thousands, currency and percent', () => {
    // `"1,234"` and `$10` read 0.
    const out = parseCsvLineData(
      'x,Revenue,Share\nQ1,"1,234",25%\nQ2,$10.50, 7.5 %\nQ3,-$3,"12,34"',
    );
    expect(out!.series).toEqual([
      { name: 'Revenue', values: [1234, 10.5, -3] },
      // `12,34` is no thousands grouping, so it is not a number in a comma file.
      { name: 'Share', values: [25, 7.5, 0] },
    ]);
  });

  it('reads a currency sign after the number, and dotted thousands in a `;` file', () => {
    // `10 €` and `1.234` (one thousand two hundred and thirty-four, where `,` is the decimal point) read 0 and 1.234.
    const semi = parseCsvLineData('Month;Sales;Units\nJan;1.234,50 €;1.234\nFeb;12 €;12.345.678');
    expect(semi!.series).toEqual([
      { name: 'Sales', values: [1234.5, 12] },
      { name: 'Units', values: [1234, 12345678] },
    ]);
    const comma = parseCsvLineData('x,Price\nA,10£\nB,1.5');
    expect(comma!.series[0]!.values).toEqual([10, 1.5]);
  });

  it('returns null when there is no usable data', () => {
    expect(parseCsvLineData('')).toBeNull();
    expect(parseCsvLineData('just-a-header,A')).toBeNull();
    expect(parseCsvLineData('x\nJan\nFeb')).toBeNull(); // no series columns
  });
});
