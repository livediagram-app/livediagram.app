import { describe, expect, it } from 'vitest';
import { placeQuickStylePanel, type Rect } from './quick-style-placement';

// docs/specs/008-canvas/quick-style-panel.md "Where it sits".

const area: Rect = { left: 0, top: 0, width: 1200, height: 800 };
const panel = { width: 200, height: 300 };
const place = (obstacles: Rect[], a = area) =>
  placeQuickStylePanel({ area: a, panel, obstacles, gap: 12 });

describe('placeQuickStylePanel', () => {
  it('sits on the right edge, vertically centred, when nothing is there', () => {
    expect(place([])).toEqual({ left: 988, top: 250, candidate: 'centre', fallback: false });
  });

  it('drops below a short palette in the top-right corner', () => {
    const palette = { left: 950, top: 12, width: 238, height: 300 };
    expect(place([palette])).toMatchObject({ left: 988, top: 324, candidate: 'below' });
  });

  it('rises above a panel docked at the bottom right', () => {
    const docked = { left: 950, top: 500, width: 238, height: 288 };
    expect(place([docked])).toMatchObject({ top: 188, candidate: 'above' });
  });

  it('drops below the palette even when the zoom cluster sits under it', () => {
    const palette = { left: 950, top: 12, width: 238, height: 300 };
    const zoom = { left: 900, top: 740, width: 288, height: 48 };
    expect(place([palette, zoom])).toMatchObject({ top: 324, candidate: 'below' });
  });

  it('steps left of a tall palette that fills the right edge', () => {
    const palette = { left: 950, top: 12, width: 238, height: 776 };
    expect(place([palette])).toMatchObject({ left: 738, top: 250, candidate: 'beside' });
  });

  it('crosses to the left edge when the right side and beside it are taken', () => {
    const palette = { left: 950, top: 12, width: 238, height: 776 };
    const comments = { left: 700, top: 200, width: 220, height: 400 };
    expect(place([palette, comments])).toMatchObject({ left: 12, candidate: 'left-edge' });
  });

  it('falls back to the right edge, flagged, when nowhere is clear', () => {
    const everywhere = { left: 0, top: 0, width: 1200, height: 800 };
    expect(place([everywhere])).toMatchObject({ left: 988, top: 250, fallback: true });
  });

  it('ignores chrome elsewhere on the canvas', () => {
    const explorer = { left: 12, top: 12, width: 280, height: 600 };
    expect(place([explorer])).toMatchObject({ candidate: 'centre' });
  });

  it('is relative to the canvas area, not the window', () => {
    const offset = { left: 100, top: 60, width: 1000, height: 700 };
    expect(place([], offset)).toMatchObject({ left: 888, top: 260 });
  });
});
