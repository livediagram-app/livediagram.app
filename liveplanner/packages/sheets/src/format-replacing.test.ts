import { describe, expect, it } from 'vitest';
import { book } from './testing/book';
import { applySheetWrite, type SheetWrite } from './store';
import { clipFromRange } from './clipboard';
import { pasteClip, pasteCut } from './commands-paste';
import { fillRange } from './commands';
import { sortRange } from './commands-axis';
import { formatReplacing } from './format';
import type { MergeRefusal } from './merge-guards';
import { cellKey, type CellFormat } from './sheet';

// A format that lands replaces the cell's own (docs/specs/029-sheets/sheet.md "Paste"): a bold cell that takes a red
// one reads red, not bold and red.
const ctx = { now: 1, by: { id: '', name: '', color: '#000000' } };

function setup() {
  // A1 is red text, A2 bold; B1 and B2 plain.
  const b = book({ A1: '2', A2: '1', B1: 'x', B2: 'y' });
  const sheet = b.sheets[0]!;
  const at = (r: number, c: number) => ({ r: sheet.layout.rows[r]!, c: sheet.layout.cols[c]! });
  apply(b, {
    kind: 'cells',
    cells: [
      { ...at(0, 0), f: { fc: '#ff0000' } },
      { ...at(1, 0), f: { b: true } },
    ],
  });
  const format = (r: number, c: number): CellFormat | undefined => {
    const s = b.sheets[0]!;
    return s.cells.get(cellKey(s.layout.rows[r]!, s.layout.cols[c]!))?.format;
  };
  return { b, id: sheet.id, format };
}

function apply(b: ReturnType<typeof book>, w: SheetWrite | MergeRefusal | null) {
  if (!w || 'refused' in w) throw new Error('no write');
  const r = applySheetWrite(b.sheets[0]!, w, ctx);
  b.sheets[0] = r.sheet;
  b.wb.updateSheet(r.sheet, w.kind === 'cells' ? r.touched : undefined);
}

describe('a format that lands replaces the cell’s own', () => {
  it('names only the keys to drop beside the new ones', () => {
    expect(formatReplacing({ b: true, fc: '#000000' }, { fc: '#ff0000' })).toEqual({
      fc: '#ff0000',
      b: null,
    });
    expect(formatReplacing(undefined, { fc: '#ff0000' })).toEqual({ fc: '#ff0000' });
    expect(formatReplacing({ b: true }, undefined)).toBeNull();
  });

  it('on a paste and on Paste Formatting Only', () => {
    const { b, id, format } = setup();
    const clip = clipFromRange(b.wb, id, { r1: 0, c1: 0, r2: 0, c2: 0 })!;
    apply(b, pasteClip(b.wb, id, { r1: 1, c1: 0, r2: 1, c2: 0 }, clip, 'all')!.edits[0]!.write);
    expect(format(1, 0)).toEqual({ fc: '#ff0000' });
    const bold = setup();
    const red = clipFromRange(bold.b.wb, bold.id, { r1: 0, c1: 0, r2: 0, c2: 0 })!;
    apply(
      bold.b,
      pasteClip(bold.b.wb, bold.id, { r1: 1, c1: 0, r2: 1, c2: 0 }, red, 'formats')!.edits[0]!
        .write,
    );
    expect(bold.format(1, 0)).toEqual({ fc: '#ff0000' });
  });

  it('on a cut', () => {
    const { b, id, format } = setup();
    const clip = clipFromRange(b.wb, id, { r1: 0, c1: 0, r2: 0, c2: 0 })!;
    apply(b, pasteCut(b.wb, id, { r: 1, c: 0 }, clip)!.edits[0]!.write);
    expect(format(1, 0)).toEqual({ fc: '#ff0000' });
    expect(format(0, 0)).toBeUndefined();
  });

  it('on a fill', () => {
    const { b, id, format } = setup();
    apply(b, fillRange(b.wb, id, { r1: 0, c1: 0, r2: 0, c2: 0 }, { r1: 0, c1: 0, r2: 1, c2: 0 }));
    expect(format(1, 0)).toEqual({ fc: '#ff0000' });
  });

  it('on Sort Range', () => {
    const { b, id, format } = setup();
    apply(
      b,
      sortRange(b.wb, id, { r1: 0, c1: 0, r2: 1, c2: 1 }, [{ col: 0, ascending: true }], false),
    );
    // The bold 1 moves up and the red 2 down, each taking only its own format.
    expect([b.v('A1'), b.v('A2')]).toEqual([1, 2]);
    expect(format(0, 0)).toEqual({ b: true });
    expect(format(1, 0)).toEqual({ fc: '#ff0000' });
  });
});
