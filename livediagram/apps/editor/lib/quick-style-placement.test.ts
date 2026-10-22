import { describe, expect, it } from 'vitest';
import { placeQuickStylePanel, type Rect } from './quick-style-placement';

// docs/specs/008-canvas/quick-style-panel.md "Where it sits": the left edge, vertically centred.

const area: Rect = { left: 0, top: 0, width: 1200, height: 800 };
const panel = { width: 200, height: 300 };
const place = (obstacles: Rect[], a = area) =>
  placeQuickStylePanel({ area: a, panel, obstacles, gap: 12 });

describe('placeQuickStylePanel', () => {
  it('sits on the left edge, vertically centred, when nothing is there', () => {
    expect(place([])).toEqual({ left: 12, top: 250, candidate: 'centre', fallback: false });
  });

  it('drops below a short panel in the top-left corner', () => {
    const explorer = { left: 12, top: 12, width: 238, height: 300 };
    expect(place([explorer])).toMatchObject({ left: 12, top: 324, candidate: 'below' });
  });

  it('rises above a panel docked at the bottom left', () => {
    const docked = { left: 12, top: 500, width: 238, height: 288 };
    expect(place([docked])).toMatchObject({ top: 188, candidate: 'above' });
  });

  it('steps right of a tall panel that fills the left edge', () => {
    const tall = { left: 12, top: 12, width: 238, height: 776 };
    expect(place([tall])).toMatchObject({ left: 262, top: 250, candidate: 'beside' });
  });

  it('crosses to the right edge when the left side and beside it are taken', () => {
    const tall = { left: 12, top: 12, width: 238, height: 776 };
    const comments = { left: 270, top: 200, width: 220, height: 400 };
    expect(place([tall, comments])).toMatchObject({ left: 988, candidate: 'right-edge' });
  });

  it('falls back to the left edge, flagged, when nowhere is clear', () => {
    const everywhere = { left: 0, top: 0, width: 1200, height: 800 };
    expect(place([everywhere])).toMatchObject({ left: 12, top: 250, fallback: true });
  });

  it('ignores chrome elsewhere on the canvas, the Palette on the right included', () => {
    const palette = { left: 950, top: 12, width: 238, height: 776 };
    expect(place([palette])).toMatchObject({ left: 12, candidate: 'centre' });
  });

  it('is relative to the canvas area, not the window', () => {
    const offset = { left: 100, top: 60, width: 1000, height: 700 };
    expect(place([], offset)).toMatchObject({ left: 112, top: 260 });
  });
});
