import { describe, expect, it } from 'vitest';
import { createShape, createText, type Element, type ShapeElement } from '@livedocuments/document';
import {
  getBuiltInTheme,
  shapeColorPresets,
  themedForTab,
  themeHalf,
} from '@livedocuments/document';
import {
  SOFT_BOX_OPACITY,
  SOFT_BOX_PRESET,
  softenLayoutBoxes,
  solidWhenCarrying,
} from './layout-soft-boxes';

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
  it('binds a box, with words or without, to the Soft preset on a fine border, with no colours of its own', () => {
    for (const out of [soft(box()), soft(box({ label: 'Now' }))]) {
      expect(out.colorPreset).toBe(SOFT_BOX_PRESET);
      expect(out.strokeWidth).toBe('thin');
      expect(out.fillColor).toBeUndefined();
    }
  });

  // Work Tracker 1501: a box takes on the design it sits on; its words never fade with it.
  it('draws a box with no words of its own part see-through, and one with words solid', () => {
    expect(SOFT_BOX_OPACITY).toBeGreaterThanOrEqual(0.5);
    expect(SOFT_BOX_OPACITY).toBeLessThanOrEqual(0.6);
    expect(soft(box()).opacity).toBe(SOFT_BOX_OPACITY);
    expect(soft(box({ label: '  ' })).opacity).toBe(SOFT_BOX_OPACITY);
    expect(soft(box({ label: 'Now' })).opacity).toBeUndefined();
    expect(soft(box({ richText: [{ text: 'Now' }] })).opacity).toBeUndefined();
  });

  it('turns a see-through box solid once it carries an icon, a sticker or words, and leaves the rest', () => {
    const see = soft(box());
    expect(solidWhenCarrying(see)).toBe(see);
    for (const extra of [
      { iconId: 'check' },
      { stickerId: 'star' },
      { label: 'Moved in' },
      { richText: [] },
    ]) {
      const out = solidWhenCarrying({ ...see, ...extra });
      expect(out.opacity, JSON.stringify(extra)).toBeUndefined();
      expect(out.colorPreset).toBe(SOFT_BOX_PRESET);
    }
    // A box at an opacity the person chose, or not a soft box, is never touched.
    const chosen = { ...see, opacity: 0.3, iconId: 'check' };
    expect(solidWhenCarrying(chosen)).toBe(chosen);
    const plain = box({ opacity: SOFT_BOX_OPACITY, iconId: 'check' });
    expect(solidWhenCarrying(plain)).toBe(plain);
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
      expect(placed!.opacity).toBe(SOFT_BOX_OPACITY);
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
