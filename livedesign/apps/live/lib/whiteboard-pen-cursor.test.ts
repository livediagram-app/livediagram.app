import { describe, expect, it } from 'vitest';
import { penCursor, penCursorSvg } from './whiteboard-pen-cursor';

// docs/specs/023-draw-mode/drawing-tools.md "Markers": the marker cursor, a crosshair with a nib.
describe('penCursor', () => {
  it('draws the crosshair black with a white outline on the light canvas', () => {
    const { svg } = penCursorSvg('#1d7afc', 'light');
    expect(svg).toContain("stroke='white' stroke-width='3'");
    expect(svg).toContain("stroke='black' stroke-width='1.5'");
    expect(svg).toContain("fill='#1d7afc'");
  });

  it('draws it as the exact inverse on the dark canvas, with no outline', () => {
    const light = penCursorSvg('#1d7afc', 'light').svg;
    const dark = penCursorSvg('#1d7afc', 'dark').svg;
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
    const { size, hotspot } = penCursorSvg('#000', 'light');
    expect(hotspot[0]).toBeLessThan(size);
    expect(penCursor('#000', 'light')).toMatch(/\) \d+ \d+, crosshair$/);
  });
});
