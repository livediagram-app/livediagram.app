// docs/specs/008-canvas/3d-engine.md "Models" (the owner, 2026-11-27): the Tree by species, the Hammock and the Bar
// Stool built smooth, and the pieces used standing at a real height.
import { describe, expect, it } from 'vitest';
import { createShape, TREE_VARIANTS, type Element } from '@livehuddle/document';
import { buildModel, SEAT_Z } from './models';
import { hammockSurfaceZ } from './models/turned-seats';
import { pieceFrame } from './piece-frame';
import { pieceTones } from './piece-tones';
import { piecesMesh } from './scene-pieces';

const tones = pieceTones(null, '#e6e9ee', '#334155');

function build(
  kind: string,
  variant?: string,
  seats: { x: number; y: number; facing: string }[] = [],
) {
  const el = { ...createShape(kind as never, 0, 0), id: kind };
  const f = pieceFrame(el);
  return { f, m: buildModel(kind, { f, t: tones, seats, variant }) };
}

const zs = (p: number[]) => p.filter((_, i) => i % 3 === 2);
const top = (p: number[]) => zs(p).reduce((a, b) => Math.max(a, b), -Infinity);

describe('trees by species', () => {
  it('builds every species, each a model of its own, standing a tree tall', () => {
    const sizes = new Set<number>();
    for (const v of TREE_VARIANTS) {
      const { m } = build('tree', v);
      expect(m.positions.length, v).toBeGreaterThan(3000);
      expect(top(m.positions), v).toBeGreaterThan(120);
      expect(top(m.positions), v).toBeLessThan(170);
      sizes.add(m.positions.length);
    }
    expect(sizes.size).toBe(TREE_VARIANTS.length);
  });

  it('builds an absent or unknown species as the Oak, the tree as it always was', () => {
    const oak = build('tree', 'oak').m.positions;
    expect(build('tree').m.positions).toEqual(oak);
    expect(build('tree', 'baobab').m.positions).toEqual(oak);
  });

  it('reads the species from the stored variant when the scene builds a tree', () => {
    const el = (variant?: string) =>
      ({
        ...createShape('tree', 0, 0),
        id: `t-${variant}`,
        ...(variant ? { variant } : {}),
      }) as Element;
    expect(piecesMesh([el('palm')]).positions.length).not.toBe(piecesMesh([el()]).positions.length);
  });
});

describe('the Hammock and the Bar Stool are smooth', () => {
  it('slings the hammock lowest at seat height in its middle, rising to its ends and up its sides', () => {
    expect(hammockSurfaceZ(0, 0)).toBe(SEAT_Z);
    expect(hammockSurfaceZ(46, 0)).toBeGreaterThan(SEAT_Z + 10);
    expect(hammockSurfaceZ(0, 13)).toBeGreaterThan(SEAT_Z);
    const { m } = build('hammock');
    // Hundreds of faces of cloth, not a handful of steps.
    expect(m.positions.length / 9).toBeGreaterThan(1500);
  });

  it("turns the bar stool round at many segments, its seat top at the sitter's seat", () => {
    const { m } = build('bar-stool', undefined, [{ x: 0, y: 0, facing: 'down' }]);
    const z = top(m.positions);
    expect(z).toBeGreaterThanOrEqual(SEAT_Z);
    expect(z).toBeLessThan(SEAT_Z + 1);
    expect(m.positions.length / 9).toBeGreaterThan(1000);
  });
});

describe('pieces used standing stand at a real height', () => {
  it('lifts the Suggestion Box slot to chest height and the Coffee Machine and Printer onto a counter', () => {
    expect(top(build('suggestion-box').m.positions)).toBeGreaterThan(48);
    expect(top(build('coffee-machine').m.positions)).toBeGreaterThan(50);
    // The printer's body starts at its stand's top, not the floor.
    expect(top(build('printer').m.positions)).toBeGreaterThan(40);
  });
});
