import { describe, expect, it } from 'vitest';
import { createTable } from '@livediagram/document';
import { tablePatchChangesNothing } from './table-patch';

describe('tablePatchChangesNothing', () => {
  const table = {
    ...createTable(0, 0),
    colWidths: [80, null, null],
    cellStyles: [[{ bold: true }, null, null], [], []],
  };

  it('is true for a patch that rebuilds the same values', () => {
    expect(tablePatchChangesNothing(table, { cells: table.cells.map((r) => [...r]) })).toBe(true);
    expect(tablePatchChangesNothing(table, { colWidths: [80, null, null] })).toBe(true);
    expect(
      tablePatchChangesNothing(table, { cellStyles: [[{ bold: true }, null, null], [], []] }),
    ).toBe(true);
    expect(tablePatchChangesNothing(table, {})).toBe(true);
  });

  it('is false when any value differs', () => {
    const cells = table.cells.map((r, i) => (i === 0 ? ['x', ...r.slice(1)] : r));
    expect(tablePatchChangesNothing(table, { cells })).toBe(false);
    expect(tablePatchChangesNothing(table, { cells: table.cells.slice(1) })).toBe(false);
    expect(tablePatchChangesNothing(table, { colWidths: [81, null, null] })).toBe(false);
    expect(tablePatchChangesNothing(table, { rowHeights: [null, null, null] })).toBe(false);
    expect(
      tablePatchChangesNothing(table, { cellStyles: [[{ bold: false }, null, null], [], []] }),
    ).toBe(false);
    expect(
      tablePatchChangesNothing(table, {
        cellStyles: [[{ bold: true, italic: true }, null, null], [], []],
      }),
    ).toBe(false);
    expect(tablePatchChangesNothing(table, { cellStyles: [[null, null, null], [], []] })).toBe(
      false,
    );
    expect(
      tablePatchChangesNothing(table, { cellStyles: [[[] as never, null, null], [], []] }),
    ).toBe(false);
  });
});
