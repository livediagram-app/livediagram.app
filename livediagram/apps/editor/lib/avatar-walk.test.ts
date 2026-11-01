import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import { elementUnderFeet } from '@liveworkspace/avatar/walk';

describe('elementUnderFeet', () => {
  const box: Element = { ...createShape('square', 100, 100), id: 'a', width: 200, height: 100 };
  const overlapping: Element = {
    ...createShape('square', 150, 120),
    id: 'b',
    width: 200,
    height: 100,
  };
  const frame: Element = { ...createShape('frame', 0, 0), id: 'f', width: 900, height: 900 };

  // docs/specs/009-elements/office.md: a room or a rug is where you stand, and a plant or a bookshelf is walked
  // round; none is a destination. A water cooler is.
  it('never rings the office’s floor or scenery, but does ring a machine', () => {
    const at = (shape: 'room' | 'rug' | 'plant' | 'bookshelf' | 'water-cooler') => ({
      ...createShape(shape, 0, 0),
      id: shape,
      width: 300,
      height: 300,
    });
    for (const shape of ['room', 'rug', 'plant', 'bookshelf'] as const)
      expect(elementUnderFeet([at(shape)], { x: 150, y: 150 })).toBeNull();
    expect(elementUnderFeet([at('water-cooler')], { x: 150, y: 150 })).toBe('water-cooler');
  });

  it('finds the element the feet are inside', () => {
    expect(elementUnderFeet([box], { x: 150, y: 150 })).toBe('a');
  });

  it('returns null when standing on bare canvas', () => {
    expect(elementUnderFeet([box], { x: 500, y: 500 })).toBeNull();
  });

  it('picks the frontmost of two overlapping elements', () => {
    expect(elementUnderFeet([box, overlapping], { x: 200, y: 150 })).toBe('b');
  });

  it('ignores frames, which would otherwise ring on every step', () => {
    expect(elementUnderFeet([frame], { x: 400, y: 400 })).toBeNull();
    expect(elementUnderFeet([frame, box], { x: 150, y: 150 })).toBe('a');
  });
});
