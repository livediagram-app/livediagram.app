import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { floorPieceAt } from './floor-pick';

const shape = (id: string, kind: string, x: number, y: number, w: number, h: number, more = {}) =>
  ({ id, type: 'shape', shape: kind, x, y, width: w, height: h, ...more }) as unknown as Element;

describe('floorPieceAt', () => {
  it('picks the smallest room whose floor holds the point, and nothing outside', () => {
    const els = [
      shape('wing', 'room', 0, 0, 400, 400),
      shape('pod', 'room', 100, 100, 100, 100),
      shape('desk', 'desk', 0, 0, 50, 50),
    ];
    expect(floorPieceAt(els, { x: 150, y: 150 })).toBe('pod');
    expect(floorPieceAt(els, { x: 20, y: 20 })).toBe('wing');
    expect(floorPieceAt(els, { x: 500, y: 20 })).toBeNull();
  });

  it('follows a turned room and a drawn outline', () => {
    // Turned a quarter: a 200 x 40 room stands 40 x 200 about its middle (100, 20).
    const turned = shape('t', 'corridor', 0, 0, 200, 40, { rotation: 90 });
    expect(floorPieceAt([turned], { x: 100, y: 100 })).toBe('t');
    expect(floorPieceAt([turned], { x: 10, y: 20 })).toBeNull();
    // A triangle filling the box's top-left half.
    const tri = shape('tri', 'room', 0, 0, 100, 100, {
      roomOutline: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
    });
    expect(floorPieceAt([tri], { x: 20, y: 20 })).toBe('tri');
    expect(floorPieceAt([tri], { x: 90, y: 90 })).toBeNull();
  });
});
