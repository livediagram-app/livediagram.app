import { describe, expect, it } from 'vitest';
import type { PathElement, PathNode } from '@livedesign/design';
import { contourAt } from './path-contour-pick';

// docs/specs/023-draw-mode/path-tool.md "Combined paths": which contour a press means.
const square = (a: number, b: number): PathNode[] => [
  { nx: a, ny: a, mode: 'corner' },
  { nx: b, ny: a, mode: 'corner' },
  { nx: b, ny: b, mode: 'corner' },
  { nx: a, ny: b, mode: 'corner' },
];

// A 100 px frame with a 50 px hole, at (100, 100).
const ring: PathElement = {
  id: 'r',
  type: 'path',
  x: 100,
  y: 100,
  width: 100,
  height: 100,
  closed: true,
  nodes: square(0, 1),
  subpaths: [square(0.25, 0.75)],
};

describe('contourAt', () => {
  it('takes the outline within reach, nearest first', () => {
    expect(contourAt(ring, { x: 102, y: 150 }, 8)).toBe(0);
    expect(contourAt(ring, { x: 127, y: 150 }, 8)).toBe(1);
  });

  it('takes the innermost contour a press is inside when no outline is near', () => {
    expect(contourAt(ring, { x: 150, y: 150 }, 8)).toBe(1);
    expect(contourAt(ring, { x: 112, y: 112 }, 2)).toBe(0);
  });

  it('is null off the path, unless the nearest is wanted anyway', () => {
    expect(contourAt(ring, { x: 400, y: 400 }, 8)).toBeNull();
    expect(contourAt(ring, { x: 400, y: 400 }, 8, true)).toBe(0);
    expect(contourAt({ ...ring, closed: false }, { x: 150, y: 150 }, 2)).toBeNull();
  });

  it('reads a rotated path in its own frame', () => {
    // Turned a quarter: the square frame lands on itself, so the hole is still in the middle.
    expect(contourAt({ ...ring, rotation: 90 }, { x: 127, y: 150 }, 8)).toBe(1);
  });
});
