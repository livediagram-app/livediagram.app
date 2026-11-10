import { describe, expect, it } from 'vitest';
import { createPresetText, createShape, type TextElement } from '@livedesign/design';
import type { MeasureTextBlock } from '@/lib/text-hug';
import { restyleTextAs } from './text-style';

// A measurer that lays the words out at 0.5 px of width per px of size per character, one line per 400 px.
const measure =
  (el: TextElement): MeasureTextBlock =>
  (width, fixed) => {
    const px = typeof el.textSize === 'number' ? el.textSize : 14;
    const natural = (el.label ?? '').length * px * 0.5;
    const w = fixed ? width : Math.min(width, natural);
    return { width: w, height: Math.ceil(natural / Math.max(1, w)) * px * 1.25 };
  };

// docs/specs/008-canvas/canvas-and-palette.md "Text styles".
describe('restyleTextAs', () => {
  it('switches a text to a style and hugs its box to the words at the new size, in one step', () => {
    const paragraph = { ...createPresetText(0, 0, 'paragraph'), label: 'Pricing' };
    const heading = restyleTextAs('heading', measure)(paragraph) as TextElement;
    expect(heading).toMatchObject({
      label: 'Pricing',
      textSize: 32,
      textBold: true,
      sizing: 'fit',
    });
    // 7 characters at 32 px, plus the hug padding either side.
    expect(heading.width).toBe(Math.ceil(7 * 32 * 0.5) + 8);
    expect(heading.height).toBe(Math.ceil(32 * 1.25) + 4);
  });

  it('keeps a wrapping text at its own width', () => {
    const wide = { ...createPresetText(0, 0, 'paragraph'), width: 500, label: 'x' };
    const quote = restyleTextAs('quote', measure)(wide) as TextElement;
    expect(quote).toMatchObject({ width: 500, sizing: 'wrap', textItalic: true });
  });

  it('leaves anything but a text untouched', () => {
    const shape = createShape('square', 0, 0);
    expect(restyleTextAs('title', measure)(shape)).toBe(shape);
  });

  it('gives a text made before text hugged its words a sizing, so it hugs from then on', () => {
    const legacy: TextElement = { ...createPresetText(0, 0, 'caption'), label: 'Hi' };
    delete legacy.sizing;
    const heading = restyleTextAs('heading', measure)(legacy) as TextElement;
    expect(heading).toMatchObject({ sizing: 'fit', width: Math.ceil(2 * 32 * 0.5) + 8 });
  });
});
