import type { Element, ElementIndex } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { arrowLabelFontSize, labelSize, placeLabel } from './arrow-label-geometry';

const box = (id: string, over: Record<string, unknown> = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, ...over }) as Element;

const index = (...els: Element[]): ElementIndex => new Map(els.map((e) => [e.id, e]));

describe('arrowLabelFontSize', () => {
  it('maps each preset, defaulting to 12', () => {
    expect(arrowLabelFontSize('lg')).toBe(20);
    expect(arrowLabelFontSize('md')).toBe(14);
    expect(arrowLabelFontSize('scale')).toBe(18);
    expect(arrowLabelFontSize('sm')).toBe(12);
    expect(arrowLabelFontSize(undefined)).toBe(12);
  });
});

describe('labelSize', () => {
  it('applies the minimum width and padding for short/empty text', () => {
    // empty -> ' ' (1 char): max(24, 7) + 8 = 32; height 16 + 4 = 20.
    expect(labelSize('')).toEqual({ width: 32, height: 20 });
  });

  it('grows with text length past the minimum', () => {
    // 'hello' (5): max(24, 35) + 8 = 43.
    expect(labelSize('hello').width).toBe(43);
  });

  it('scales width and height with font size', () => {
    // fontSize 24 -> scale 2. 'ab' (2): max(24, 2*7*2) + 8 = 36; height 16*2 + 4 = 36.
    expect(labelSize('ab', 24)).toEqual({ width: 36, height: 36 });
  });
});

describe('placeLabel', () => {
  const mid = { x: 100, y: 100 };
  // For text ' ' at fontSize 12: size {32,20}, halfW 16, halfH 10.

  it('returns the right slot first when nothing collides and no direction', () => {
    expect(placeLabel(mid, ' ', index(), 'self')).toEqual({ x: 124, y: 100 });
  });

  it('offsets perpendicular to a horizontal arrow when a direction is given', () => {
    // dir (10,0): perpendicular is (0,1); clear = 10 + 8 = 18 -> first candidate below.
    expect(placeLabel(mid, ' ', index(), 'self', 12, { dx: 10, dy: 0 })).toEqual({
      x: 100,
      y: 118,
    });
  });

  it('dodges to the next slot when the first candidate collides with a box', () => {
    // Box overlaps the right rect (x108..140, y90..110) but not the below rect.
    const els = index(box('b', { x: 120, y: 90, width: 20, height: 10 }));
    expect(placeLabel(mid, ' ', els, 'self')).toEqual({ x: 100, y: 118 });
  });

  it('ignores the arrow itself (selfId) when checking collisions', () => {
    const els = index(box('self', { x: 120, y: 90, width: 20, height: 10 }));
    expect(placeLabel(mid, ' ', els, 'self')).toEqual({ x: 124, y: 100 });
  });

  it('falls back to the first candidate when every slot collides', () => {
    const els = index(box('huge', { x: -1000, y: -1000, width: 5000, height: 5000 }));
    expect(placeLabel(mid, ' ', els, 'self')).toEqual({ x: 124, y: 100 });
  });
});
