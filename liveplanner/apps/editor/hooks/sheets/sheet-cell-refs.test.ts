import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusSheetCell, PENDING_FOCUS_MS, registerCellFocuser } from './sheet-cell-refs';

// Bringing a Sheet's cell into view (docs/specs/029-sheets/sheet.md "Cell comments"): at once on a drawn Sheet, and
// held for a Sheet an Inbox link reaches before it is drawn.

afterEach(() => {
  vi.useRealTimers();
});

describe('focusSheetCell', () => {
  it('selects the cell on a drawn Sheet', () => {
    const focus = vi.fn();
    const off = registerCellFocuser('s-drawn', focus);
    focusSheetCell('s-drawn', 'rowa1a1:cola1a1');
    expect(focus).toHaveBeenCalledWith('rowa1a1:cola1a1');
    off();
  });

  it('holds the cell until the Sheet is drawn, then takes it once', () => {
    focusSheetCell('s-late', 'rowb4b4:colb4b4');
    const focus = vi.fn();
    const off = registerCellFocuser('s-late', focus);
    expect(focus).toHaveBeenCalledWith('rowb4b4:colb4b4');
    off();
    const again = vi.fn();
    registerCellFocuser('s-late', again)();
    expect(again).not.toHaveBeenCalled();
  });

  it('drops an ask the Sheet is drawn too late for', () => {
    vi.useFakeTimers();
    focusSheetCell('s-old', 'rowc9c9:colc9c9');
    vi.advanceTimersByTime(PENDING_FOCUS_MS + 1);
    const focus = vi.fn();
    registerCellFocuser('s-old', focus)();
    expect(focus).not.toHaveBeenCalled();
  });
});
