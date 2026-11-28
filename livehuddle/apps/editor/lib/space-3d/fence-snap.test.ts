// docs/specs/009-elements/fence.md "Placed on a lawn's edge, it fences the whole side".
import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { snapFenceToGrass } from './fence-snap';

const grass = {
  id: 'g',
  type: 'shape',
  shape: 'grass',
  x: 100,
  y: 100,
  width: 400,
  height: 200,
} as Element;
const fence = (x: number, y: number, shape = 'garden-fence') =>
  ({ id: 'f', type: 'shape', shape, x: x - 100, y: y - 14, width: 200, height: 28 }) as Element;
const box = (e: Element) => {
  const b = e as { x: number; y: number; width: number; height: number };
  return { x: b.x, y: b.y, width: b.width, height: b.height };
};

describe('snapFenceToGrass', () => {
  it('fences the whole top or bottom side, just inside the grass', () => {
    expect(box(snapFenceToGrass(fence(250, 90), [grass]))).toEqual({
      x: 100,
      y: 100,
      width: 400,
      height: 28,
    });
    expect(box(snapFenceToGrass(fence(300, 310, 'fence'), [grass]))).toEqual({
      x: 100,
      y: 272,
      width: 400,
      height: 28,
    });
  });

  it('turns to run down a left or right side', () => {
    expect(box(snapFenceToGrass(fence(480, 200), [grass]))).toEqual({
      x: 472,
      y: 100,
      width: 28,
      height: 200,
    });
    expect(box(snapFenceToGrass(fence(110, 150), [grass]))).toEqual({
      x: 100,
      y: 100,
      width: 28,
      height: 200,
    });
  });

  it('leaves a fence alone away from any lawn, a turned lawn, or another kind', () => {
    const far = fence(300, 200);
    expect(snapFenceToGrass(far, [grass])).toBe(far);
    const turned = { ...grass, rotation: 30 } as Element;
    const near = fence(250, 90);
    expect(snapFenceToGrass(near, [turned])).toBe(near);
    const plant = { ...near, shape: 'plant' } as Element;
    expect(snapFenceToGrass(plant, [grass])).toBe(plant);
  });
});
