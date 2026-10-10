import { describe, expect, it } from 'vitest';
import {
  acceptFunction,
  argumentAt,
  argumentSlot,
  cycleAbsolute,
  functionMatches,
  insertReference,
  referenceSlot,
  refSpans,
  spanRange,
} from './formula-assist';

describe('formula assist', () => {
  it('finds references and colours them by text', () => {
    const spans = refSpans('=SUM(A1:B2)+a1*Budget!C3+LOG10(2)+A:A');
    expect(spans.map((s) => s.text)).toEqual(['A1:B2', 'a1', 'Budget!C3', 'A:A']);
    expect(spans[1]!.colour).not.toBe(spans[0]!.colour);
    expect(refSpans('=A1+A1').map((s) => s.colour)).toEqual([
      refSpans('=A1')[0]!.colour,
      refSpans('=A1')[0]!.colour,
    ]);
    expect(refSpans('hello')).toEqual([]);
    expect(refSpans("='Sheet")).toEqual([]);
    expect(spanRange(spans[0]!)).toEqual({ r1: 0, c1: 0, r2: 1, c2: 1 });
    expect(spanRange(spans[2]!)).toBeNull();
    expect(spanRange(spans[3]!)).toBeNull();
  });
  it('knows where a clicked cell goes', () => {
    expect(referenceSlot('=', 1)).toEqual({ start: 1, end: 1 });
    expect(referenceSlot('=SUM(', 5)).toEqual({ start: 5, end: 5 });
    expect(referenceSlot('=A1+', 4)).toEqual({ start: 4, end: 4 });
    expect(referenceSlot('=A1', 3)).toEqual({ start: 1, end: 3 });
    expect(referenceSlot('=SU', 3)).toBeNull();
    expect(referenceSlot('=1+ x', 3)).toBeNull();
    expect(referenceSlot('12', 2)).toBeNull();
    expect(referenceSlot('=(', 2)).toEqual({ start: 2, end: 2 });
    const r = insertReference('=SUM()', { start: 5, end: 5 }, 'B2');
    expect(r).toEqual({ draft: '=SUM(B2)', caret: 7, slot: { start: 5, end: 7 } });
  });
  it('cycles absolute parts with F4', () => {
    let d = { draft: '=A1+1', caret: 3 };
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      d = cycleAbsolute(d.draft, d.caret)!;
      seen.push(d.draft);
    }
    expect(seen).toEqual(['=$A$1+1', '=A$1+1', '=$A1+1', '=A1+1']);
    expect(cycleAbsolute('=A1:B2', 3)!.draft).toBe('=$A$1:$B$2');
    expect(cycleAbsolute('=1+2', 2)).toBeNull();
    expect(cycleAbsolute('=X!A1', 5)).toBeNull();
  });
  it('suggests functions and accepts one', () => {
    const m = functionMatches('=1+vlo', 6)!;
    expect(m.names).toEqual(['VLOOKUP']);
    expect(acceptFunction('=1+vlo', m, 6, 'VLOOKUP')).toEqual({ draft: '=1+VLOOKUP(', caret: 11 });
    expect(functionMatches('=SUM(', 5)).toBeNull();
    expect(functionMatches('="su', 4)).toBeNull();
    expect(functionMatches('=A1', 3)).toBeNull();
    expect(functionMatches('=SU', 2)).not.toBeNull();
    expect(functionMatches('=zzz', 4)).toBeNull();
    expect(functionMatches('sum', 3)).toBeNull();
  });
  it('suggests the sheet\u2019s named ranges after the functions, and accepts one without brackets', () => {
    const m = functionMatches('=B2*ta', 6, 8, ['TaxRate', 'Totals', 'Other'])!;
    expect(m.names).toEqual(['TaxRate']);
    expect(acceptFunction('=B2*ta', m, 6, 'TaxRate')).toEqual({ draft: '=B2*TaxRate', caret: 11 });
    // Typed in full, it is no longer offered, so Enter commits; so too a name that is also a function's (RATE).
    expect(functionMatches('=B2*taxrate', 11, 8, ['TaxRate'])).toBeNull();
    expect(functionMatches('=B2*Rate', 8, 8, ['Rate'])).toBeNull();
    // A name with `_` is offered as it is typed.
    expect(functionMatches('=Q3_s', 5, 8, ['Q3_Sales'])!.names).toEqual(['Q3_Sales']);
    expect(functionMatches('=_ta', 4, 8, ['_tax'])!.names).toEqual(['_tax']);
    // Functions first, then the names.
    const s2 = functionMatches('=sum', 4, 20, ['Summary'])!;
    expect(s2.names[0]).toBe('SUM');
    expect(s2.names.at(-1)).toBe('Summary');
    expect(acceptFunction('=sum', s2, 4, 'SUM')).toEqual({ draft: '=SUM(', caret: 5 });
  });
  it('knows the argument the caret is in', () => {
    expect(argumentAt('=IF(A1>2, SUM(1,', 16)).toEqual({ name: 'SUM', index: 1 });
    expect(argumentAt('=IF(A1>2, SUM(1,2), ', 20)).toEqual({ name: 'IF', index: 2 });
    expect(argumentAt('=IF(",", ', 9)).toEqual({ name: 'IF', index: 1 });
    expect(argumentAt('=(1, ', 5)).toBeNull();
    expect(argumentAt('x', 1)).toBeNull();
    expect(argumentSlot('SUM', 5)).toBe(1);
    expect(argumentSlot('IF', 1)).toBe(1);
    expect(argumentSlot('ABS', 3)).toBe(0);
  });
  it('copes with the edges of what is typed', () => {
    // A sheet name with nothing after it yet.
    expect(refSpans('=Budget!')).toEqual([]);
    expect(spanRange(refSpans('=B3')[0]!)).toEqual({ r1: 2, c1: 1, r2: 2, c2: 1 });
    // Whole columns have no $ parts to cycle, and stay as they are.
    expect(cycleAbsolute('=A:B', 2)).toEqual({ draft: '=A:B', caret: 4 });
    // A word inside a string is not a function name.
    expect(functionMatches('="a su', 6)).toBeNull();
    // A function with no documented arguments has no slot.
    expect(argumentSlot('NOT_A_FUNCTION', 0)).toBe(-1);
  });
});
