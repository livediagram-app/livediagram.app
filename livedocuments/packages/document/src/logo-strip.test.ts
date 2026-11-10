import { describe, expect, it } from 'vitest';
import {
  LOGO_H,
  LOGO_MIN_W,
  LOGO_STRIP_COUNT,
  LOGO_W,
  createLogoStrip,
  logoStripSize,
  stackPicturesGreyscale,
  withStackPicturesGreyscale,
} from './logo-strip';
import { createComponent, COMPONENT_SIZE } from './component-factories';
import { settleStacks } from './stack';
import type { Element, ImageElement, ShapeElement } from './index';

// docs/specs/009-elements/logo-strip.md
const colors = { accent: '#0284c7', surface: '#ffffff', ink: '#0f172a' };

describe('createLogoStrip', () => {
  it('is a borderless row stack and five grey placeholders, already settled', () => {
    const els = createLogoStrip({ cx: 500, cy: 300 });
    const [stack, ...logos] = els as [ShapeElement, ...ImageElement[]];
    expect(stack.shape).toBe('stack');
    expect(stack.strokeWidth).toBe('none');
    expect(stack.stackGap).toBe(40);
    expect(logos).toHaveLength(LOGO_STRIP_COUNT);
    for (const l of logos) {
      expect(l).toMatchObject({
        type: 'image',
        imageId: null,
        objectFit: 'contain',
        greyscale: true,
        aspectLocked: false,
        alt: 'Logo',
        width: LOGO_W,
        height: LOGO_H,
      });
    }
    expect({ width: stack.width, height: stack.height }).toEqual(logoStripSize());
    expect(stack.x + stack.width / 2).toBe(500);
    // Evenly spaced: the same gap between every pair.
    const gaps = logos.slice(1).map((l, i) => l.x - (logos[i]!.x + logos[i]!.width));
    expect(new Set(gaps)).toEqual(new Set([40]));
    // The stack's own settle leaves it as it is.
    expect(settleStacks(els)).toBe(els);
  });

  it('shares a dragged box among its logos, never below their minimum', () => {
    const [stack, ...logos] = createLogoStrip({ x: 0, y: 0, width: 1032, height: 112 }, 6) as [
      ShapeElement,
      ...ImageElement[],
    ];
    expect(logos).toHaveLength(6);
    expect(logos[0]!.width).toBe(Math.floor((1032 - 32 - 200) / 6));
    expect(logos[0]!.height).toBe(80);
    expect(stack.x).toBe(0);
    const tiny = createLogoStrip({ x: 0, y: 0, width: 10, height: 10 }) as ImageElement[];
    expect(tiny[1]!.width).toBe(LOGO_MIN_W);
  });

  it('is a component whose stack createComponent gives alone', () => {
    const made = createComponent('logo-strip', 100, 100, colors);
    expect(made.type === 'shape' && made.shape).toBe('stack');
    expect(COMPONENT_SIZE['logo-strip']).toEqual(logoStripSize());
  });
});

describe('Greyscale Pictures', () => {
  it('reads and turns the stack’s pictures grey or back', () => {
    const els: Element[] = createLogoStrip({ cx: 0, cy: 0 });
    const stack = els[0] as ShapeElement;
    expect(stackPicturesGreyscale(els, stack)).toEqual({ hasPictures: true, greyscale: true });
    const colour = withStackPicturesGreyscale(els, stack.id, false);
    expect(colour.filter((e) => e.type === 'image' && e.greyscale)).toHaveLength(0);
    expect(stackPicturesGreyscale(colour, stack)).toEqual({ hasPictures: true, greyscale: false });
    expect(withStackPicturesGreyscale(els, stack.id, true)).toBe(els);
    const back = withStackPicturesGreyscale(colour, stack.id, true);
    expect(stackPicturesGreyscale(back, stack).greyscale).toBe(true);
  });

  it('leaves a stack with no pictures, and anything not a stack, alone', () => {
    const stack = createLogoStrip({ cx: 0, cy: 0 })[0] as ShapeElement;
    expect(stackPicturesGreyscale([stack], stack)).toEqual({
      hasPictures: false,
      greyscale: false,
    });
    expect(withStackPicturesGreyscale([stack], stack.id, true)).toEqual([stack]);
    const els = createLogoStrip({ cx: 0, cy: 0 });
    expect(withStackPicturesGreyscale(els, els[1]!.id, false)).toBe(els);
    expect(withStackPicturesGreyscale(els, 'missing', false)).toBe(els);
  });
});
