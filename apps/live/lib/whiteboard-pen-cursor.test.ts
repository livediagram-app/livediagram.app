import { describe, expect, it } from 'vitest';
import {
  PEN_CURSOR_DOT_MIN_PX,
  PEN_CURSOR_MAX_PX,
  PEN_CURSOR_VARIANTS,
  penCursor,
  penCursorSvg,
} from './whiteboard-pen-cursor';

// docs/specs/023-whiteboard/whiteboard.md "Pens": the pen cursor, Dot or Crosshair + nib.
describe('penCursor', () => {
  it('offers the dot and the crosshair with a nib', () => {
    expect(PEN_CURSOR_VARIANTS).toEqual(['dot', 'nib-crosshair']);
  });

  it('draws the dot in the pen colour, rimmed in the board colour', () => {
    expect(penCursorSvg('dot', '#e5484d', 'dark').svg).toContain("fill='#e5484d'");
    expect(penCursorSvg('dot', '#e5484d', 'dark').svg).toContain("stroke='#0d121a'");
    expect(penCursorSvg('dot', '#e5484d', 'light').svg).toContain("stroke='#fbfaf7'");
  });

  it('makes the dot at least as wide as the stroke on screen, and never too small to see', () => {
    const dot = (px: number) =>
      Number(penCursorSvg('dot', '#000', 'light', px).svg.match(/r='([\d.]+)' fill='#000'/)![1]) *
      2;
    expect(dot(12)).toBe(12);
    expect(dot(1.5)).toBe(PEN_CURSOR_DOT_MIN_PX);
    expect(dot(500)).toBeLessThanOrEqual(PEN_CURSOR_MAX_PX);
    const { size, hotspot } = penCursorSvg('dot', '#000', 'light', 12);
    expect(hotspot).toEqual([size / 2, size / 2]);
  });

  it('draws the crosshair black with a white outline on the light board', () => {
    const { svg } = penCursorSvg('nib-crosshair', '#1d7afc', 'light');
    expect(svg).toContain("stroke='white' stroke-width='3'");
    expect(svg).toContain("stroke='black' stroke-width='1.5'");
  });

  it('draws it as the exact inverse on the dark board, with no outline', () => {
    const light = penCursorSvg('nib-crosshair', '#1d7afc', 'light').svg;
    const dark = penCursorSvg('nib-crosshair', '#1d7afc', 'dark').svg;
    expect(dark).not.toContain("stroke-width='3'");
    expect(dark).toContain("stroke='white' stroke-width='1.5'");
    // Everything but the outline and the pen colour swaps black for white.
    const inverted = light
      .replace(
        /<path d='M0 4 H8 M4 0 V8' stroke='white' stroke-width='3' stroke-linecap='round' \/>/,
        '',
      )
      .replace(/black|white/g, (c) => (c === 'black' ? 'white' : 'black'));
    expect(dark).toBe(inverted);
  });

  it('puts the hotspot inside the image, with a crosshair fallback', () => {
    for (const v of PEN_CURSOR_VARIANTS) {
      const { size, hotspot } = penCursorSvg(v, '#000', 'light');
      expect(hotspot[0]).toBeLessThan(size);
      expect(penCursor(v, '#000', 'light')).toMatch(/\) \d+ \d+, crosshair$/);
    }
  });
});
