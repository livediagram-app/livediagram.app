import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import { createTable } from './factories';
import { svgBoxed } from './svg-render';
import {
  addTableColumn,
  moveTableColumn,
  removeTableColumn,
  withHighlightColumn,
  withTablePatch,
} from './table';
import {
  TABLE_MARK_TEXT,
  tableCellMark,
  tableHighlightColours,
  tableMarkColours,
  tableMarkPath,
  tableMarkSize,
} from './table-marks';
import { isValidElement } from './validate';

// docs/specs/009-elements/comparison-tables.md.
describe('tableCellMark', () => {
  it('reads a cell holding only a tick or a cross', () => {
    for (const t of ['✓', '✔', '✅', '☑', ' ✓ ', '✔️', '✔︎'])
      expect(tableCellMark(t), t).toBe('tick');
    for (const t of ['✗', '✘', '✕', '❌', '×', '☒']) expect(tableCellMark(t), t).toBe('cross');
    expect(tableCellMark(TABLE_MARK_TEXT.tick)).toBe('tick');
    expect(tableCellMark(TABLE_MARK_TEXT.cross)).toBe('cross');
  });

  it('leaves words, empty cells and marks among words alone', () => {
    for (const t of ['', 'Yes', '✓ included', 'x', 'X', '✓✓', '3 × 4', ' '.repeat(20) + '✓'])
      expect(tableCellMark(t), t).toBeNull();
  });
});

describe('mark and highlight colours', () => {
  it('a mark meets 3:1 on light and dark paper and on a coloured cell', () => {
    for (const [surface, ground] of [
      ['light', '#ffffff'],
      ['dark', '#141b26'],
      ['light', '#dcfce7'],
    ] as const) {
      for (const mark of ['tick', 'cross'] as const) {
        const { stroke } = tableMarkColours(mark, surface, ground);
        expect(contrastRatio(stroke, ground), `${mark} on ${ground}`).toBeGreaterThanOrEqual(3);
      }
    }
    expect(tableMarkColours('tick', 'light', '#fff', '#123456').stroke).toBe('#123456');
  });

  it('the highlighted header ink reads on the accent', () => {
    const h = tableHighlightColours('#4f46e5');
    expect(h.header).toBe('#4f46e5');
    expect(contrastRatio(h.headerInk, h.header)).toBeGreaterThanOrEqual(4.5);
  });

  it('sizes a mark to the text, never past the cell', () => {
    expect(tableMarkSize(16, 40, 4)).toBe(24);
    expect(tableMarkSize(16, 20, 4)).toBe(12);
    expect(tableMarkSize(16, 6, 4)).toBe(8);
    expect(tableMarkPath('tick')).not.toBe(tableMarkPath('cross'));
  });
});

describe('the highlighted column', () => {
  const t = {
    ...createTable(0, 0),
    cells: [
      ['', 'A', 'B', 'C'],
      ['x', '✓', '✗', '✓'],
    ],
  };
  const hl = withHighlightColumn(t, 2);

  it('validates within the columns only', () => {
    expect(isValidElement(hl)).toBe(true);
    expect(isValidElement({ ...t, highlightColumn: 4 })).toBe(false);
    expect(isValidElement({ ...t, highlightColumn: -1 })).toBe(false);
    expect(isValidElement({ ...t, highlightColumn: 1.5 })).toBe(false);
  });

  it('stays on its column through inserts, deletes and moves', () => {
    expect(addTableColumn(hl, 0).highlightColumn).toBe(3);
    expect(addTableColumn(hl, 3).highlightColumn).toBe(2);
    expect(removeTableColumn(hl, 0).highlightColumn).toBe(1);
    expect('highlightColumn' in removeTableColumn(hl, 2)).toBe(false);
    expect(removeTableColumn(hl, 3).highlightColumn).toBe(2);
    expect(moveTableColumn(hl, 2, 0).highlightColumn).toBe(0);
    expect(moveTableColumn(hl, 0, 3).highlightColumn).toBe(1);
    expect(moveTableColumn(hl, 3, 1).highlightColumn).toBe(3);
  });

  it('is removed, not left empty, by a patch or a clear', () => {
    expect('highlightColumn' in withHighlightColumn(hl, null)).toBe(false);
    expect('highlightColumn' in withTablePatch(hl, { highlightColumn: undefined })).toBe(false);
    expect(withTablePatch(hl, { cells: hl.cells }).highlightColumn).toBe(2);
  });

  it('the export draws the marks, the wash, the accent header and the frame', () => {
    const svg = svgBoxed({ ...hl, headerRow: true });
    expect(svg).toContain(tableMarkPath('tick'));
    expect(svg).toContain(tableMarkPath('cross'));
    expect(svg).toContain('stroke-width="2"');
    expect(svg).not.toContain('>✓<');
    const plain = svgBoxed({ ...t, headerRow: true });
    expect(plain.length).toBeLessThan(svg.length);
  });
});
