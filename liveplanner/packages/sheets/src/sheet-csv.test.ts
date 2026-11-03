import { describe, expect, it } from 'vitest';
import { sheetCsvText } from './sheet-csv';
import { book } from './testing/book';

describe('sheetCsvText', () => {
  it('is empty for an empty sheet', () => {
    const { wb, sheets } = book({});
    expect(sheetCsvText(wb, sheets[0]!)).toBe('');
  });

  it('writes up to the last filled cell, each value as shown', () => {
    const { wb, sheets } = book({ A1: '2', B1: '=A1*3', C2: 'a, "b"', A3: '50%' });
    expect(sheetCsvText(wb, sheets[0]!)).toBe('2,6,\r\n,,"a, ""b"""\r\n50.00%,,\r\n');
  });

  // sheet.md "CSV": a download never carries a live formula into another spreadsheet.
  it('makes text a spreadsheet would run as a formula inert', () => {
    const { wb, sheets } = book({ A1: "'=1+1", B1: '-5' });
    expect(sheetCsvText(wb, sheets[0]!)).toBe("'=1+1,-5\r\n");
  });
});
