import { describe, expect, it } from 'vitest';
import { placeQuickStylePanel, type Rect } from './quick-style-placement';

// docs/specs/008-canvas/quick-style-panel.md "Where it sits".

const area: Rect = { left: 0, top: 0, width: 1200, height: 800 };
const panel = { width: 200, height: 300 };
const place = (obstacles: Rect[], a = area) =>
  placeQuickStylePanel({ layout: 'toolbar', area: a, panel, obstacles, gap: 12 });

describe('placeQuickStylePanel: Toolbar and Minimal, the right edge', () => {
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

describe('placeQuickStylePanel: Floating, docked under the Palette', () => {
  const palette: Rect = { left: 932, top: 72, width: 256, height: 360 };
  const dock = (obstacles: Rect[], anchor: Rect | null = palette, p = panel) =>
    placeQuickStylePanel({ layout: 'floating', area, panel: p, obstacles, anchor, gap: 12 });

  it('sits right beneath the Palette, left edges aligned, one stack gap down', () => {
    expect(dock([palette])).toEqual({
      left: 932,
      top: 448,
      candidate: 'under-palette',
      fallback: false,
    });
  });

  it('follows a collapsed Palette up to its banner', () => {
    const banner = { ...palette, height: 36 };
    expect(dock([banner], banner)).toMatchObject({ top: 124, candidate: 'under-palette' });
  });

  it('follows a Palette moved elsewhere', () => {
    const moved = { left: 300, top: 100, width: 256, height: 200 };
    expect(dock([moved], moved)).toMatchObject({ left: 300, top: 316 });
  });

  it('steps below a panel stacked under the Palette', () => {
    const comments = { left: 932, top: 448, width: 256, height: 120 };
    const tall = { width: 200, height: 200 };
    expect(dock([palette, comments], palette, tall)).toMatchObject({
      top: 584,
      candidate: 'under-palette',
    });
  });

  it('sits above a Palette docked at the bottom when there is no room beneath', () => {
    const low = { left: 946, top: 420, width: 256, height: 368 };
    expect(dock([low], low)).toMatchObject({ top: 104, candidate: 'over-palette' });
  });

  it('keeps inside the canvas when a moved Palette hangs off its right edge', () => {
    const edge = { left: 1100, top: 72, width: 256, height: 200 };
    expect(dock([edge], edge).left).toBe(988);
  });

  it('stays docked, scrolling, when the room beneath is short but usable', () => {
    const zoom = { left: 900, top: 740, width: 288, height: 48 };
    const tall = { width: 256, height: 400 };
    expect(dock([palette, zoom], palette, tall)).toEqual({
      left: 932,
      top: 448,
      maxHeight: 740 - 16 - 448,
      candidate: 'under-palette',
      fallback: false,
    });
  });

  it('prefers a full fit above a bottom Palette over scrolling beneath it', () => {
    const low = { left: 946, top: 400, width: 256, height: 250 };
    expect(dock([low], low)).toMatchObject({ top: 84, candidate: 'over-palette' });
  });

  it('falls back to the right edge when the Palette leaves no room above or below', () => {
    const full = { left: 946, top: 12, width: 256, height: 776 };
    expect(dock([full], full)).toMatchObject({ candidate: 'beside' });
  });

  it('uses the right edge when there is no Palette to dock under', () => {
    expect(dock([], null)).toMatchObject({ left: 988, top: 250, candidate: 'centre' });
  });
});

describe('placeQuickStylePanel: Floating on a short window', () => {
  it('docks and scrolls rather than jumping into the canvas', () => {
    const shortArea: Rect = { left: 0, top: 56, width: 1280, height: 616 };
    const palette: Rect = { left: 1008, top: 72, width: 256, height: 360 };
    const zoom: Rect = { left: 868, top: 610, width: 400, height: 46 };
    const placed = placeQuickStylePanel({
      layout: 'floating',
      area: shortArea,
      panel: { width: 256, height: 280 },
      obstacles: [palette, zoom],
      anchor: palette,
    });
    expect(placed).toMatchObject({ left: 1008, top: 448, candidate: 'under-palette' });
    expect(placed.maxHeight).toBe(610 - 16 - 448);
  });
});
