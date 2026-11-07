import { describe, expect, it } from 'vitest';
import { fenceSegments, fenceStep } from './collision';
import { CORRIDOR_ARM, corridorShape, corridorVariant, corridorWalls } from './corridor';

// livehuddle's docs/specs/009-elements/corridor.md: walls down its sides, open ends, turned by its rotation.

const shape = (extra: Record<string, unknown>) => ({
  id: 'c',
  type: 'shape' as const,
  shape: 'corridor',
  x: 0,
  y: 0,
  width: 480,
  height: 120,
  ...extra,
});
const round = (v: number) => Math.round(v * 1000) / 1000;

describe('corridorVariant', () => {
  it('reads a type it takes, and the Straight for anything else', () => {
    expect(corridorVariant('tee')).toBe('tee');
    expect(corridorVariant(undefined)).toBe('straight');
    expect(corridorVariant('spiral')).toBe('straight');
  });
});

describe('corridorShape', () => {
  it('runs a wide Straight along its top and bottom, a tall one down its sides', () => {
    expect(corridorShape(480, 120, undefined).walls).toEqual([
      [
        { x: 0, y: 5 },
        { x: 480, y: 5 },
      ],
      [
        { x: 0, y: 115 },
        { x: 480, y: 115 },
      ],
    ]);
    expect(corridorShape(120, 480, 'straight').walls.map((r) => r[0])).toEqual([
      { x: 5, y: 0 },
      { x: 115, y: 0 },
    ]);
  });

  it('keeps a Corner, T-Junction and Crossroads arm CORRIDOR_ARM wide in a big box', () => {
    const corner = corridorShape(600, 600, 'corner');
    expect(corner.floor).toContainEqual({ x: CORRIDOR_ARM, y: 0 });
    expect(corner.walls).toHaveLength(2);
    const tee = corridorShape(480, 360, 'tee');
    expect(tee.walls).toHaveLength(3);
    expect(tee.floor).toContainEqual({ x: 300, y: 360 });
    const cross = corridorShape(480, 480, 'cross');
    expect(cross.walls).toHaveLength(4);
    expect(cross.floor).toHaveLength(12);
  });

  it('narrows the arms to a box smaller than one, and never draws a negative size', () => {
    expect(corridorShape(80, 300, 'corner').floor[1]).toEqual({ x: 80, y: 0 });
    expect(corridorShape(-10, -10, 'tee').floor.every((p) => p.x >= 0 && p.y >= 0)).toBe(true);
  });
});

describe('corridorWalls', () => {
  it('puts the walls in canvas px, one segment per run step', () => {
    const walls = corridorWalls(
      shape({ x: 100, y: 50, variant: 'corner', width: 360, height: 360 }),
    );
    expect(walls).toHaveLength(4);
    expect(walls[0]).toEqual({ a: { x: 105, y: 50 }, b: { x: 105, y: 405 } });
  });

  it('turns them with the rotation about the centre', () => {
    const [top] = corridorWalls(shape({ rotation: 90 }));
    // A quarter turn about (240, 60): the top wall (y = 5) stands upright at x = 295.
    expect(round(top!.a.x)).toBe(295);
    expect(round(top!.b.x)).toBe(295);
  });

  it('drops a run step of no length', () => {
    expect(corridorWalls(shape({ width: 0, height: 0 }))).toEqual([]);
  });
});

describe('a corridor in the walk', () => {
  it('blocks a step through its wall and lets one along it', () => {
    const fences = fenceSegments([shape({})]);
    expect(fences).toHaveLength(2);
    expect(fenceStep({ x: 200, y: 60 }, { x: 200, y: -20 }, fences).blocked).toBe(true);
    expect(fenceStep({ x: 200, y: 60 }, { x: 260, y: 60 }, fences).blocked).toBe(false);
  });

  it('is cut where an open Door stands on its wall, and whole where a shut one does', () => {
    const door = { id: 'd', type: 'shape', shape: 'door', x: 152, y: -7, width: 96, height: 24 };
    expect(fenceSegments([shape({}), door])).toHaveLength(3);
    const shut = { ...door, doorClosed: true } as typeof door;
    expect(fenceSegments([shape({}), shut])).toHaveLength(2);
  });
});
