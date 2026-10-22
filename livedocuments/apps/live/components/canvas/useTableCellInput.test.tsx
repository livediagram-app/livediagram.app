// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTable } from '@livedocuments/document';
import { useTableCellInput } from './useTableCellInput';

// A selected cell's keys (docs/specs/008-canvas/canvas-and-palette.md "Selected-cell keyboard layer"): a printable key
// type-to-edits, and so does a character composed with Option or AltGr (£, €, @); a chord is left alone.
function setup() {
  const setEditing = vi.fn();
  const initialTextRef = { current: '' };
  renderHook(() =>
    useTableCellInput({
      element: createTable(0, 0),
      rows: 3,
      cols: 3,
      selectedCell: { r: 0, c: 0 },
      setSelectedCell: vi.fn(),
      setExtraCells: vi.fn(),
      editing: null,
      setEditing,
      suspended: false,
      readOnly: false,
      addRow: vi.fn(),
      selectionCells: () => [{ r: 0, c: 0 }],
      onCommitTable: vi.fn(),
      initialTextRef,
      typeToEditRef: { current: false },
    }),
  );
  return { setEditing, initialTextRef };
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
});
