// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MAX_TABLE_ROWS, createTable } from '@livediagram/document';
import { useTableCellInput } from './useTableCellInput';

// A selected cell's keys (docs/specs/008-canvas/canvas-and-palette.md "Selected-cell keyboard layer"): a printable key
// type-to-edits, and so does a character composed with Option or AltGr (£, €, @); a chord is left alone.
function setup(element = createTable(0, 0), selectedCell = { r: 0, c: 0 }) {
  const setEditing = vi.fn();
  const setSelectedCell = vi.fn();
  const addRow = vi.fn();
  const initialTextRef = { current: '' };
  renderHook(() =>
    useTableCellInput({
      element,
      rows: element.cells.length,
      cols: element.cells[0]!.length,
      selectedCell,
      setSelectedCell,
      setExtraCells: vi.fn(),
      editing: null,
      setEditing,
      suspended: false,
      readOnly: false,
      addRow,
      selectionCells: () => [{ r: 0, c: 0 }],
      onCommitTable: vi.fn(),
      initialTextRef,
      typeToEditRef: { current: false },
    }),
  );
  return { setEditing, setSelectedCell, addRow, initialTextRef };
}

const press = (init: KeyboardEventInit) =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
  );

describe('useTableCellInput', () => {
  it('starts the cell with a character composed with Option or AltGr', () => {
    const mac = setup();
    press({ key: '£', code: 'Digit3', altKey: true });
    expect(mac.setEditing).toHaveBeenCalledWith({ r: 0, c: 0 });
    expect(mac.initialTextRef.current).toBe('£');
  });

  it('leaves a chord to the canvas', () => {
    const h = setup();
    press({ key: 'z', code: 'KeyZ', ctrlKey: true });
    press({ key: 'd', code: 'KeyD', altKey: true });
    press({ key: 'ArrowDown', altKey: true });
    expect(h.setEditing).not.toHaveBeenCalled();
  });

  it('Tab off the last cell appends a row, and at the row cap leaves the selection where it is', () => {
    const open = setup(createTable(0, 0), { r: 2, c: 2 });
    press({ key: 'Tab' });
    expect(open.addRow).toHaveBeenCalledWith(3);
    expect(open.setSelectedCell).toHaveBeenCalledWith({ r: 3, c: 0 });

    const base = createTable(0, 0);
    const full = { ...base, cells: Array.from({ length: MAX_TABLE_ROWS }, () => ['x']) };
    const capped = setup(full, { r: MAX_TABLE_ROWS - 1, c: 0 });
    press({ key: 'Tab' });
    expect(capped.addRow).not.toHaveBeenCalled();
    expect(capped.setSelectedCell).not.toHaveBeenCalled();
  });
});
