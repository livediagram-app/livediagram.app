// A change checked whole against the store's caps before any of its parts is sent
// (docs/specs/029-sheets/sheet-store.md "Agents", "Limits").
import { describe, expect, it } from 'vitest';
import { DOCUMENT_CELLS_MAX, SHEET_CELLS_MAX } from './limits';
import { emptyLayout, emptySheet, type Sheet } from './sheet';
import type { SheetWrite } from './store';
import { documentCellCount, writesCapsProblem } from './write-caps';

function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const sheet = (): Sheet =>
  emptySheet({ id: 'sheet_caps01', tabId: 't', title: 'Caps', layout: emptyLayout(seeded()) });

// One number in each of the first `n` cells, row by row across the sheet's columns.
function fill(s: Sheet, n: number): SheetWrite {
  const { rows, cols } = s.layout;
  const cells = Array.from({ length: n }, (_, i) => ({
    r: rows[Math.floor(i / cols.length)]!,
    c: cols[i % cols.length]!,
    i: { n: i },
  }));
  return { kind: 'cells', cells };
}

describe('writesCapsProblem', () => {
  it('lets a change that fits through', () => {
    const s = sheet();
    expect(writesCapsProblem(s, [fill(s, 10)], 0)).toBeNull();
    expect(writesCapsProblem(s, [], DOCUMENT_CELLS_MAX)).toBeNull();
  });

  it('refuses a change that would pass the document’s cells, counting every part', () => {
    const s = sheet();
    expect(writesCapsProblem(s, [fill(s, 10)], DOCUMENT_CELLS_MAX - 10)).toBeNull();
    expect(writesCapsProblem(s, [fill(s, 11)], DOCUMENT_CELLS_MAX - 10)).toBe('sheets_full');
  });

  it('refuses a change that would pass the sheet’s cells', () => {
    const s = { ...sheet(), layout: emptyLayout(seeded(), 2_001, 26) };
    expect(writesCapsProblem(s, [fill(s, SHEET_CELLS_MAX + 1)], 0)).toBe('sheet_full');
  });

  it('never refuses a change that grows nothing, so a full document can still be cleared', () => {
    const s = sheet();
    const cleared = {
      kind: 'cells',
      cells: [{ r: s.layout.rows[0]!, c: s.layout.cols[0]!, i: null }],
    } as SheetWrite;
    expect(writesCapsProblem(s, [cleared], DOCUMENT_CELLS_MAX + 5)).toBeNull();
  });
});

describe('documentCellCount', () => {
  it('adds up every sheet’s cells', () => {
    expect(documentCellCount([{ cells: [1, 2] }, { cells: [] }, { cells: [3] }])).toBe(3);
  });
});
