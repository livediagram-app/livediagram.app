import { describe, expect, it } from 'vitest';
import { columnCanvasBox } from './frame-board-column';

// docs/specs/026-plan/plan-board.md "On a phone": a tapped column is framed, its box taken to canvas coordinates.
describe('columnCanvasBox', () => {
  it('maps a column on screen into the board’s canvas box, through the board’s drawn scale', () => {
    // A 800-wide board drawn at half size: 400 px on screen, from (100, 50).
    const board = { left: 100, top: 50, width: 400, height: 250 };
    const column = { left: 150, top: 70, width: 100, height: 200 };
    expect(columnCanvasBox(column, board, { x: 1000, y: 2000, width: 800 })).toEqual({
      x: 1100,
      y: 2040,
      width: 200,
      height: 400,
    });
  });

  it('gives nothing for an unmeasured board', () => {
    const none = { left: 0, top: 0, width: 0, height: 0 };
    expect(columnCanvasBox(none, none, { x: 0, y: 0, width: 800 })).toBeNull();
  });
});
