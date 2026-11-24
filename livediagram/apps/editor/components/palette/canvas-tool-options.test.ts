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

// Magnifier (docs/specs/008-canvas/magnifier.md "Where it lives"): first of the Preview group, before Isometric.
describe('the Magnifier row', () => {
  it('sits in the Preview group just before Isometric, on every screen', () => {
    for (const isMobile of [false, true]) {
      const options = buildCanvasToolOptions({ isMobile });
      const ids = options.map((o) => o.id);
      const at = ids.indexOf('magnifier');
      expect(ids[at + 1]).toBe('isometric');
      const row = options[at]!;
      expect(row).toMatchObject({ label: 'Magnifier', shortcut: 'M', group: 2 });
      expect(options.find((o) => o.id === 'isometric')!.group).toBe(2);
    }
  });

  it('is greyed out on an empty canvas', () => {
    const row = buildCanvasToolOptions({ isMobile: false, canvasEmpty: true }).find(
      (o) => o.id === 'magnifier',
    );
    expect(row?.disabled).toBe(true);
  });
});
