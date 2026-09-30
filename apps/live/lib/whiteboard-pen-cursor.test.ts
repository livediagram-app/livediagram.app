import { describe, expect, it } from 'vitest';
import { PEN_CURSOR_VARIANTS, penCursor, penCursorSvg } from './whiteboard-pen-cursor';

describe('penCursor', () => {
  it('offers five looks, each in the pen colour with a rim in the board colour', () => {
    expect(PEN_CURSOR_VARIANTS).toHaveLength(5);
    for (const v of PEN_CURSOR_VARIANTS) {
      const { svg } = penCursorSvg(v, '#e5484d', '#0d121a');
      expect(svg).toContain('#e5484d');
    }
    expect(penCursorSvg('dot', '#e5484d', '#0d121a').svg).toContain('#0d121a');
  });

  it('puts the hotspot inside the image, with a crosshair fallback', () => {
    for (const v of PEN_CURSOR_VARIANTS) {
      const { size, hotspot } = penCursorSvg(v, '#000', '#fff');
      expect(hotspot[0]).toBeLessThan(size);
      expect(hotspot[1]).toBeLessThan(size);
      expect(penCursor(v, '#000', '#fff')).toMatch(/\) \d+ \d+, crosshair$/);
    }
  });
});
