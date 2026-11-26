import { describe, expect, it } from 'vitest';
import { createShape, createText, type Element, type ShapeElement } from '@livedocuments/document';
import {
  getBuiltInTheme,
  shapeColorPresets,
  themedForTab,
  themeHalf,
} from '@livedocuments/document';
import { SOFT_BOX_PRESET, softenLayoutBoxes } from './layout-soft-boxes';

// docs/specs/007-editor/pages-mode.md "Layouts", "Soft boxes" (Work Tracker 1481).
const box = (extra: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('square', 0, 0),
  width: 200,
  height: 120,
  label: '',
  ...extra,
});
const soft = (el: Element) => softenLayoutBoxes([el], 800)[0] as ShapeElement;

describe('softenLayoutBoxes', () => {
  it('binds a box, with words or without, to the Soft preset on a fine border, solid and with no colours of its own', () => {
    for (const out of [soft(box()), soft(box({ label: 'Now' }))]) {
      expect(out.colorPreset).toBe(SOFT_BOX_PRESET);
      expect(out.strokeWidth).toBe('thin');
      expect(out.opacity).toBeUndefined();
      expect(out.fillColor).toBeUndefined();
    }
  });

  it("takes the tab theme's Soft look when placed, from the page's half", () => {
    for (const dark of [false, true]) {
      const [placed] = themedForTab<ShapeElement>([soft(box())], 'ocean', { dark });
      const preset = shapeColorPresets(
        themeHalf(getBuiltInTheme('ocean'), dark ? 'dark' : 'light'),
      ).find((p) => p.id === SOFT_BOX_PRESET)!;
      expect(placed!.fillColor).toBe(preset.fill);
      expect(placed!.strokeColor).toBe(preset.stroke);
      expect(placed!.strokeWidth).toBe('thin');
      expect(placed!.opacity).toBeUndefined();
    }
  });

  it("leaves a border the layout chose: a recommended option's thick one, a frame's none", () => {
    for (const strokeWidth of ['thick', 'none'] as const) {
      const el = box({ strokeWidth });
      expect(soft(el)).toBe(el);
    }
  });

  it('leaves a box that says something by its colour, icon, picture, opacity or theme lock', () => {
    for (const extra of [
      { fillColor: '#fecaca' },
      { strokeColor: '#16a34a' },
      { penColour: 'red' },
      { colorPreset: 'bold' },
      { iconId: 'check' },
      { imageId: 'a'.repeat(32) },
      { opacity: 0.3 },
      { themeLockFill: true },
    ] as Partial<ShapeElement>[]) {
      const el = box(extra);
      expect(soft(el), JSON.stringify(extra)).toBe(el);
    }
  });

  it('leaves marks smaller than 5% of the page across, other kinds and other elements', () => {
    const dot = box({ width: 30, height: 30 });
    const disc = { ...box(), shape: 'circle' } as ShapeElement;
    const text = createText(0, 0);
    expect(softenLayoutBoxes([dot, disc, text], 800)).toEqual([dot, disc, text]);
    // The threshold follows the page: the same box on a far bigger page is a mark.
    const card = box();
    expect(softenLayoutBoxes([card], 4000)[0]).toBe(card);
  });
});
