import { describe, expect, it } from 'vitest';
import { buildCanvasToolOptions } from './canvas-tool-options';

// Avatar mode moved to livehuddle (docs/specs/009-elements/retired-elements.md), so the picker never lists it.
describe('buildCanvasToolOptions', () => {
  it('never offers Avatar, on any screen', () => {
    for (const isMobile of [false, true]) {
      const ids = buildCanvasToolOptions({ isMobile }).map((o) => o.id);
      expect(ids).not.toContain('avatar');
      expect(ids).toEqual(expect.arrayContaining(['select', 'pan', 'laser']));
    }
  });
});
