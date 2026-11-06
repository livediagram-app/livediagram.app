// How the whiteboard dock fits its room (docs/specs/023-draw-mode/draw-mode.md "When the bar is too
// wide"): pins leave first, then the least-used drawing tools fold into More Tools, only as far as
// they must.
import { describe, expect, it } from 'vitest';
import {
  DOCK_FOLD_ORDER,
  dockBarWidth,
  drawingRuns,
  fitDock,
  foldedInBarOrder,
  type FoldableTool,
} from './whiteboard-dock-fold';
import type { WhiteboardPenId } from './whiteboard-prefs';

const PENS: WhiteboardPenId[] = ['main', 'second', 'third'];
const none = new Set<FoldableTool>();
const set = (...tools: FoldableTool[]) => new Set<FoldableTool>(tools);

describe('drawingRuns', () => {
  it('is Select, the markers, Text and Path, Fill and Eraser', () => {
    expect(drawingRuns(PENS, none)).toEqual([
      ['select'],
      ['main', 'second', 'third'],
      ['text', 'path'],
      ['fill', 'eraser'],
    ]);
  });

  it('leaves folded tools out and drops a run left empty', () => {
    expect(drawingRuns(PENS, set('path', 'fill', 'eraser', 'third'))).toEqual([
      ['select'],
      ['main', 'second'],
      ['text'],
    ]);
  });
});

describe('foldedInBarOrder', () => {
  it('lists folded tools as the bar orders them, not as they fold', () => {
    expect(foldedInBarOrder(PENS, set('eraser', 'path', 'third', 'fill'))).toEqual([
      'third',
      'path',
      'fill',
      'eraser',
    ]);
  });
});

describe('dockBarWidth', () => {
  // Measured in Chromium: 466 px of scroller content plus its 2 px border, with one pin.
  it('matches the bar as drawn, with one pin', () => {
    expect(dockBarWidth(PENS, 1, none)).toBe(468);
  });

  it('adds a tile and a gap per pin', () => {
    expect(dockBarWidth(PENS, 2, none)).toBe(506);
  });

  it('drops the pinned separator with no pins, unless shapes drag', () => {
    expect(dockBarWidth(PENS, 0, none)).toBe(468 - 38 - 7);
    expect(dockBarWidth(PENS, 0, none, true)).toBe(468 - 38);
  });

  it('counts More Tools once anything folds, and a run that folds whole takes its hairline', () => {
    const base = dockBarWidth(PENS, 0, none);
    // Path: one tile and its gap out, More Tools in.
    expect(dockBarWidth(PENS, 0, set('path'))).toBe(base);
    // Fill and Eraser: their whole run and its hairline out.
    expect(dockBarWidth(PENS, 0, set('path', 'fill', 'eraser'))).toBe(base - 2 * 38 - 7);
  });
});

describe('fitDock', () => {
  it('folds nothing until the room is measured', () => {
    expect(fitDock({ room: null, pens: PENS, pins: 2, canDrag: true })).toEqual({
      pins: 2,
      folded: none,
    });
  });

  it('keeps everything when it fits', () => {
    const fit = fitDock({ room: 468, pens: PENS, pins: 1, canDrag: false });
    expect(fit.pins).toBe(1);
    expect(fit.folded.size).toBe(0);
  });

  it('takes pins off first, the last first', () => {
    const fit = fitDock({ room: 500, pens: PENS, pins: 7, canDrag: true });
    expect(fit.pins).toBe(1);
    expect(fit.folded.size).toBe(0);
  });

  it('then folds the least-used tools, only as far as it must', () => {
    // No pins: 423 px. Path alone saves nothing (More Tools takes its place), so Fill folds too.
    const fit = fitDock({ room: 400, pens: PENS, pins: 1, canDrag: false });
    expect(fit.pins).toBe(0);
    expect([...fit.folded]).toEqual(['path', 'fill']);
  });

  it('folds in order down to Select, Marker 1 and More Tools', () => {
    const fit = fitDock({ room: 10, pens: PENS, pins: 1, canDrag: false });
    expect([...fit.folded]).toEqual([...DOCK_FOLD_ORDER]);
    expect(drawingRuns(PENS, fit.folded)).toEqual([['select'], ['main']]);
  });

  it('never folds a marker the bar does not show', () => {
    const fit = fitDock({ room: 10, pens: ['main'], pins: 0, canDrag: false });
    expect(fit.folded.has('second')).toBe(false);
    expect(fit.folded.has('third')).toBe(false);
  });

  it('fits every width from the narrowest tablet room to the widest, never wider than the room', () => {
    for (let room = 250; room <= 700; room++) {
      const fit = fitDock({ room, pens: PENS, pins: 1, canDrag: false });
      const width = dockBarWidth(PENS, fit.pins, fit.folded);
      if (fit.folded.size < DOCK_FOLD_ORDER.length) expect(width).toBeLessThanOrEqual(room + 0.5);
    }
  });
});
