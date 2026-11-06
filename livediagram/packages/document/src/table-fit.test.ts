import { describe, expect, it } from 'vitest';
import { createTable } from './factories';
import { PADDING_PX, type TableElement } from './index';
import { LABEL_LINE_HEIGHT } from './svg-render-primitives';
import { tableGrowthForCells } from './table-fit';
import { svgTableShape } from './svg-render-table';

// docs/specs/009-elements/table-rows-fit-text.md: a row grows taller (never shorter) to hold its cells' words.

// Ten px a character, whatever the font, so a line's length is easy to reason about.
const measure = () => (s: string) => s.length * 10;
const pad = PADDING_PX.sm;
const lineH = 13 * LABEL_LINE_HEIGHT;

// A 3x3, 360 x 150: 120px columns (100px of text, ten characters a line), 50px rows.
const table = (over: Partial<TableElement> = {}): TableElement => ({
  ...createTable(0, 0),
  headerRow: false,
  ...over,
});
const cellsWith = (r: number, c: number, text: string) => {
  const cells = table().cells.map((row) => [...row]);
  cells[r]![c] = text;
  return cells;
};
// The growth once `cells` are written over this table's own.
const fit = (el: TableElement, cells: string[][], m?: Parameters<typeof tableGrowthForCells>[2]) =>
  tableGrowthForCells({ ...el, cells }, el.cells, m);

describe('tableGrowthForCells', () => {
  it('leaves a table whose words fit alone', () => {
    expect(fit(table(), cellsWith(1, 1, 'short'), measure)).toBeNull();
    expect(fit(table(), [], measure)).toBeNull();
    expect(fit(table(), [[]], measure)).toBeNull();
  });

  it('pins a row to the lines its words wrap to and grows the table by the same, the other rows kept', () => {
    // Six words of nine characters: six lines in a ten-character cell.
    const text = Array.from({ length: 6 }, () => 'wordwordw').join(' ');
    const need = Math.ceil(6 * lineH + pad * 2);
    const grown = fit(table(), cellsWith(1, 2, text), measure)!;
    expect(grown.rowHeights).toEqual([null, need, null]);
    expect(grown.height).toBe(150 + need - 50);
  });

  it('grows a pinned row from its pinned height, and a long word breaks rather than staying one line', () => {
    const el = table({ rowHeights: [30, null, null], height: 150 });
    const grown = fit(el, cellsWith(0, 0, 'x'.repeat(30)), measure)!;
    const need = Math.ceil(3 * lineH + pad * 2);
    expect(grown.rowHeights).toEqual([need, null, null]);
    expect(grown.height).toBe(150 + need - 30);
  });

  it('measures a cell in its own size, a header in bold', () => {
    const cells = cellsWith(0, 0, 'a b c');
    const sizes: number[] = [];
    const bolds: boolean[] = [];
    const spy = (px: number, bold: boolean) => {
      sizes.push(px);
      bolds.push(bold);
      return (s: string) => s.length * 10;
    };
    fit(table({ headerRow: true, cellStyles: [[{ textSize: 'lg', italic: true }]] }), cells, spy);
    expect(sizes).toEqual([16]);
    expect(bolds).toEqual([true]);
  });

  it('reads the table-wide padding, slant and weight, and a header column', () => {
    const calls: [number, boolean, boolean][] = [];
    const spy = (px: number, bold: boolean, italic: boolean) => {
      calls.push([px, bold, italic]);
      return (s: string) => s.length * 10;
    };
    const cells = cellsWith(1, 0, 'a');
    cells[1]![1] = 'b';
    const grown = fit(
      table({ headerColumn: true, textItalic: true, textBold: true, padding: 'lg', height: 30 }),
      cells,
      spy,
    );
    // Measured once, and once more after growing, which then fits.
    expect(calls).toEqual(Array.from({ length: 4 }, () => [13, true, true]));
    expect(grown?.rowHeights?.[1]).toBe(Math.ceil(lineH + PADDING_PX.lg * 2));
  });

  it('measures a table sized to scale again as its font grows with the rows, and stops', () => {
    const text = Array.from({ length: 8 }, () => 'wordwordw').join(' ');
    const grown = fit(table({ textSize: 'scale' }), cellsWith(2, 0, text), measure)!;
    expect(grown.height).toBeGreaterThan(150);
    expect(grown.rowHeights?.[2]).toBeGreaterThan(50);
  });

  it('measures with the shared label measure when none is given', () => {
    const grown = fit(table(), cellsWith(0, 0, 'one\ntwo\nthree\nfour\nfive'));
    expect(grown?.height).toBeGreaterThan(150);
  });

  // The export clips a cell's lines to its row: once grown, every line is drawn.
  it('lets the export draw every line once the row has grown', () => {
    const text = 'one\ntwo\nthree\nfour\nfive';
    const el = table({ cells: cellsWith(0, 0, text) });
    const before = (svgTableShape(el).match(/<tspan/g) ?? []).length;
    // No earlier words: every row is measured.
    const grown = { ...el, ...tableGrowthForCells(el)! };
    expect(before).toBeLessThan(5);
    expect((svgTableShape(grown).match(/<tspan/g) ?? []).length).toBe(5);
  });

  it('measures only the rows whose words changed, a new row included', () => {
    // Counts the cells measured: the measure is asked for once per cell per pass.
    let measured = 0;
    const spy = () => {
      measured++;
      return (s: string) => s.length * 10;
    };
    const el = table({
      cells: [
        ['a', 'b', 'c'],
        ['d', 'e', 'f'],
        ['g', 'h', 'i'],
      ],
    });
    expect(tableGrowthForCells(el, el.cells, spy)).toBeNull();
    expect(measured).toBe(0);
    const typed = [
      ['a', 'b', 'c'],
      ['d', 'long words that wrap a lot', 'f'],
      ['g', 'h', 'i'],
    ];
    expect(tableGrowthForCells({ ...el, cells: typed }, el.cells, spy)).not.toBeNull();
    // The typed row's three cells, measured, grown, and measured again: it fits.
    expect(measured).toBe(6);
    const appended = [...el.cells, ['x'.repeat(40), '', '']];
    const grown = tableGrowthForCells(
      { ...el, cells: appended, rowHeights: [null, null, null, null] },
      el.cells,
      spy,
    );
    expect(grown?.rowHeights?.slice(0, 3)).toEqual([null, null, null]);
    expect(grown?.rowHeights?.[3]).toBeGreaterThan(0);
    // A row whose cell count changed is measured too.
    const widened = tableGrowthForCells(
      { ...el, cells: el.cells.map((row) => [...row, 'x'.repeat(60)]) },
      el.cells,
      spy,
    );
    expect(widened?.height).toBeGreaterThan(150);
  });
});
