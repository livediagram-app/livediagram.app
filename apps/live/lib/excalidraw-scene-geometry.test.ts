import { describe, expect, it } from 'vitest';
import {
  absolutePoints,
  closeIfLoop,
  EXCALIDRAW_CLOSE_EPSILON_PX,
} from './excalidraw-scene-geometry';
import { excalidrawBuilder } from './excalidraw-fixtures';

const b = excalidrawBuilder();

describe('absolutePoints', () => {
  it('offsets points by the element position', () => {
    const el = b.line(
      [
        [0, 0],
        [10, 5],
      ],
      { x: 100, y: 200 },
    );
    expect(absolutePoints(el)).toEqual([
      { x: 100, y: 200 },
      { x: 110, y: 205 },
    ]);
  });

  it('handles points that start away from the origin', () => {
    const el = b.freedraw(
      [
        [-4, -3],
        [0, 0],
      ],
      { x: 10, y: 10 },
    );
    expect(absolutePoints(el)).toEqual([
      { x: 6, y: 7 },
      { x: 10, y: 10 },
    ]);
  });

  it('bakes the angle in, about the element centre', () => {
    // A 10 x 0 line from (0,0) turned a quarter clockwise about its centre (5, 0).
    const el = b.line(
      [
        [0, 0],
        [10, 0],
      ],
      { x: 0, y: 0, width: 10, height: 0, angle: Math.PI / 2 },
    );
    const [a, c] = absolutePoints(el);
    expect(a!.x).toBeCloseTo(5);
    expect(a!.y).toBeCloseTo(-5);
    expect(c!.x).toBeCloseTo(5);
    expect(c!.y).toBeCloseTo(5);
  });

  it('attaches pressures when given, clamped to 0..1', () => {
    const el = b.freedraw(
      [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
      { x: 0, y: 0 },
    );
    expect(absolutePoints(el, [0.5, 2, -1]).map((p) => p.p)).toEqual([0.5, 1, 0]);
  });

  it('drops malformed points', () => {
    const el = b.line(
      [
        [0, 0],
        [10, 0],
      ],
      {
        points: [[0, 0], [Number.NaN, 1], [1] as unknown as [number, number], [3, 4]],
      },
    );
    expect(absolutePoints(el)).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ]);
  });

  it('is empty without points', () => {
    expect(absolutePoints(b.line([[0, 0]], { points: undefined }))).toEqual([]);
  });
});

describe('closeIfLoop', () => {
  it('closes a loop of 3+ points whose ends coincide, dropping the repeated end', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: EXCALIDRAW_CLOSE_EPSILON_PX },
    ];
    expect(closeIfLoop(pts)).toEqual({ points: pts.slice(0, -1), closed: true });
  });

  it('leaves an open stroke or a short one alone', () => {
    const open = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(closeIfLoop(open)).toEqual({ points: open, closed: false });
    const two = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(closeIfLoop(two)).toEqual({ points: two, closed: false });
  });

  it('forces closure when asked (a polygon), dropping a repeated end only', () => {
    const tri = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 8 },
    ];
    expect(closeIfLoop(tri, true)).toEqual({ points: tri, closed: true });
    expect(closeIfLoop([...tri, { x: 0, y: 0 }], true)).toEqual({ points: tri, closed: true });
  });
});
