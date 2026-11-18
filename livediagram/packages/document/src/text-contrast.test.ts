import { describe, expect, it } from 'vitest';
import { DEFAULT_BACKGROUND_COLOR } from '@liveworkspace/model-core/canvas-colors';
import { createShape, createSticky, createText } from './index';
import type { BoxedElement, Element } from './index';
import { savedCanvasTone, textGroundOf } from './text-contrast';

// docs/specs/004-interface-design/colour-picker.md "Reading on its ground": this model's grounds, a canvas as
// saved. The judge's own table (ratios, large text, shades) is the shared one's,
// @liveworkspace/element-model/text-contrast.test.ts.
const text = (extra: object = {}) =>
  ({
    ...createText(40, 40),
    id: 't',
    width: 120,
    height: 30,
    label: 'Hi',
    ...extra,
  }) as BoxedElement;
const square = (id: string, extra: object = {}) =>
  ({ ...createShape('square', 0, 0), id, width: 300, height: 200, ...extra }) as BoxedElement;

describe('savedCanvasTone', () => {
  it('is the canvas colour the tab saves, else the paper, as #rrggbb', () => {
    expect(savedCanvasTone({})).toBe(DEFAULT_BACKGROUND_COLOR);
    expect(savedCanvasTone({ backgroundColor: '#FFF' })).toBe('#ffffff');
    expect(savedCanvasTone({ backgroundColor: 'not-a-colour' })).toBeNull();
    expect(savedCanvasTone({ backgroundColor: 3 })).toBe(DEFAULT_BACKGROUND_COLOR);
  });
});

describe('textGroundOf', () => {
  it('reads text with nothing under it on the canvas', () => {
    const t = text();
    expect(textGroundOf(t, { elements: [t] })).toEqual({
      tones: [DEFAULT_BACKGROUND_COLOR],
      on: 'canvas',
    });
    expect(textGroundOf(t, { elements: [t], backgroundColor: '#0f172a' })).toEqual({
      tones: ['#0f172a'],
      on: 'canvas',
    });
    expect(textGroundOf(t, { elements: [t], backgroundColor: 'none' })).toBeNull();
  });

  it('reads a shape on its fill, a note on its paper, and text on the box painted under it', () => {
    const s = square('s', { fillColor: '#1e293b' });
    expect(textGroundOf(s, { elements: [s] })).toEqual({ tones: ['#1e293b'], on: 'shape' });
    const note = { ...createSticky(0, 0), id: 'n', fillColor: '#fef08a' } as BoxedElement;
    expect(textGroundOf(note, { elements: [note] })!.on).toBe('shape');
    const t = text();
    expect(textGroundOf(t, { elements: [s, t] as Element[] })).toEqual({
      tones: ['#1e293b'],
      on: 'card',
    });
    // Painted over the text, the box is not under it.
    expect(textGroundOf(t, { elements: [t, s] as Element[] })!.on).toBe('canvas');
  });

  it('reads a box with no fill of its own in its default fill for the saved canvas', () => {
    const s = square('s');
    const light = textGroundOf(s, { elements: [s] });
    const dark = textGroundOf(s, { elements: [s], backgroundColor: '#0f172a' });
    expect(light!.on).toBe('shape');
    expect(dark!.tones).not.toEqual(light!.tones);
  });
});
