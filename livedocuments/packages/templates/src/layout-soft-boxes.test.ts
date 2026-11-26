import { describe, expect, it } from 'vitest';
import { createShape, createText, type Element, type ShapeElement } from '@livedocuments/document';
import { SOFT_CARD_OPACITY, softenLayoutBoxes } from './layout-soft-boxes';

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
  it('draws a word-less card see-through, on a fine border', () => {
    const out = soft(box());
    expect(out.opacity).toBe(SOFT_CARD_OPACITY);
    expect(out.strokeWidth).toBe('thin');
  });

  it('keeps a box with words of its own fully opaque, so its words keep their contrast', () => {
    const out = soft(box({ label: 'Now' }));
    expect(out.opacity).toBeUndefined();
    expect(out.strokeWidth).toBe('thin');
  });

  it("keeps a border the layout chose: a recommended option's thick one, a frame's none", () => {
    expect(soft(box({ strokeWidth: 'thick' })).strokeWidth).toBe('thick');
    expect(soft(box({ strokeWidth: 'none' })).strokeWidth).toBe('none');
    expect(soft(box({ strokeWidth: 'thick' })).opacity).toBe(SOFT_CARD_OPACITY);
  });

  it('leaves a box that says something by its colour, icon, picture, opacity or theme lock', () => {
    for (const extra of [
      { fillColor: '#fecaca' },
      { strokeColor: '#16a34a' },
      { penColour: 'red' },
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
