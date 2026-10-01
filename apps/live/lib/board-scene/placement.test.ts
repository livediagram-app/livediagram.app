import { describe, expect, it } from 'vitest';
import { placementOffset, sceneBounds, translateItem } from './placement';
import type { SceneItem } from './scene';
import { inkStroke } from './test-scenes';

// docs/specs/020-import-export/board-scene.md "Placement".
const box: SceneItem = { key: 'b', kind: 'frame', x: 0, y: 0, width: 100, height: 40 };
const ink: SceneItem = {
  key: 'i',
  kind: 'ink',
  points: [
    { x: -50, y: 10, p: 0.5 },
    { x: 10, y: 90 },
  ],
  stroke: inkStroke(),
};

describe('sceneBounds', () => {
  it('unions boxes and points', () => {
    expect(sceneBounds([box, ink])).toEqual({ x: -50, y: 0, width: 150, height: 90 });
    expect(sceneBounds([])).toBeNull();
  });

  it('reads a rotated box by its turned corners', () => {
    const b = sceneBounds([{ ...box, rotationDeg: 90 } as SceneItem])!;
    expect(b.x).toBeCloseTo(30);
    expect(b.width).toBeCloseTo(40);
    expect(b.height).toBeCloseTo(100);
  });
});

describe('placementOffset', () => {
  it('centres the bounds on the point, or stays at the origin', () => {
    expect(placementOffset([box], { kind: 'at', x: 0, y: 0 })).toEqual({ dx: -50, dy: -20 });
    expect(placementOffset([box], { kind: 'origin' })).toEqual({ dx: 0, dy: 0 });
    expect(placementOffset([], { kind: 'at', x: 5, y: 5 })).toEqual({ dx: 0, dy: 0 });
  });
});

describe('translateItem', () => {
  it('moves boxes and points, pressure kept', () => {
    expect(translateItem(box, 5, 6)).toMatchObject({ x: 5, y: 6 });
    expect(translateItem(ink, 5, 6)).toMatchObject({
      points: [
        { x: -45, y: 16, p: 0.5 },
        { x: 15, y: 96 },
      ],
    });
    expect(translateItem(box, 0, 0)).toBe(box);
  });
});
