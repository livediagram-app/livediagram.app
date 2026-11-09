import { describe, expect, it } from 'vitest';
import { book } from './testing/book';
import { clipFromRange } from './clipboard';
import { pasteCut, pasteExternal } from './commands-paste';
import { SHEET_COLS_MAX } from './limits';

// docs/specs/029-sheets/sheet.md "Clipboard": a paste cut at the grid's end selects what landed. A text or cut paste
// used to select its whole size, past the sheet's last column.
describe('a paste cut at the grid', () => {
  const wide = () => book({ A1: 'a', B1: 'b', C1: 'c' }, { rows: 2, cols: SHEET_COLS_MAX });
  const last = SHEET_COLS_MAX - 1;

  it('selects only the columns a text paste filled', () => {
    const b = wide();
    const at = { r1: 0, c1: last - 1, r2: 0, c2: last - 1 };
    const p = pasteExternal(b.wb, b.sheets[0]!.id, at, [['1', '2', '3', '4']], 'all')!;
    expect(p.truncated).toBe(true);
    expect(p.range).toEqual({ r1: 0, c1: last - 1, r2: 0, c2: last });
  });

  it('selects only the columns a cut paste filled', () => {
    const b = wide();
    const id = b.sheets[0]!.id;
    const clip = clipFromRange(b.wb, id, { r1: 0, c1: 0, r2: 0, c2: 2 }, true)!;
    const p = pasteCut(b.wb, id, { r: 1, c: last - 1 }, clip)!;
    expect(p.truncated).toBe(true);
    expect(p.range).toEqual({ r1: 1, c1: last - 1, r2: 1, c2: last });
  });
});
