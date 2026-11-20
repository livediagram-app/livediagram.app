import { describe, expect, it } from 'vitest';
import { leanCell } from './lean-cells';

describe('leanCell', () => {
  it('says typed text and a typed number once', () => {
    expect(leanCell({ at: 'A1', input: 'Design', value: 'Design', display: 'Design' })).toEqual({
      at: 'A1',
      input: 'Design',
    });
    expect(leanCell({ at: 'B1', input: '40', value: 40, display: '40' })).toEqual({
      at: 'B1',
      input: '40',
    });
  });

  it('keeps a formula’s value, and what a format shows', () => {
    expect(leanCell({ at: 'D2', input: '=B2*C2', value: 3400, display: '3400' })).toEqual({
      at: 'D2',
      input: '=B2*C2',
      value: 3400,
    });
    expect(leanCell({ at: 'C2', input: '85', value: 85, display: '£85.00' })).toEqual({
      at: 'C2',
      input: '85',
      display: '£85.00',
    });
    expect(
      leanCell({ at: 'D5', input: '=SUM(D2:D4)', value: 15160, display: '£15,160.00' }),
    ).toEqual({ at: 'D5', input: '=SUM(D2:D4)', value: 15160, display: '£15,160.00' });
  });

  it('keeps a boolean, an empty value and why a value is not allowed', () => {
    expect(leanCell({ at: 'A1', input: 'TRUE', value: true, display: 'TRUE' })).toEqual({
      at: 'A1',
      input: 'TRUE',
      value: true,
    });
    expect(leanCell({ at: 'A2', input: '', value: null, display: '' })).toEqual({
      at: 'A2',
      input: '',
      value: null,
    });
    expect(
      leanCell({ at: 'A3', input: 'S9', value: 'S9', display: 'S9', invalid: 'One of S1, S2' }),
    ).toEqual({ at: 'A3', input: 'S9', invalid: 'One of S1, S2' });
  });
});
