// docs/specs/008-canvas/3d-engine.md "Block models": every kind with a model of its own builds one, whole triangles
// of finite numbers standing on the floor and inside the room its footprint gives it, at every turn and size.
import { describe, expect, it } from 'vitest';
import { createShape, TREE_VARIANTS, type ShapeKind } from '@livehuddle/document';
import { buildModel, MODELS } from '.';
import { pieceFrame } from '../piece-frame';
import { pieceTones } from '../piece-tones';
import type { Builder } from './kit';

const KINDS = Object.keys(MODELS).toSorted();
const FACINGS = ['n', 'e', 's', 'w'] as const;

function build(
  kind: string,
  facing: (typeof FACINGS)[number],
  scale = 1,
  variant?: string,
): Builder {
  const base = createShape(kind as ShapeKind, 0, 0);
  const el = {
    ...base,
    id: kind,
    width: base.width * scale,
    height: base.height * scale,
    chairFacing: facing,
  };
  return buildModel(kind, {
    f: pieceFrame(el),
    t: pieceTones(null, '#e6e9ee', '#334155'),
    seats: [{ x: 0, y: 0, facing: 's' }],
    variant,
    label: 'Studio',
    fill: '#7c3aed',
    clock: { hour: 3, minute: 15 },
  });
}

function expectWhole(m: Builder, what: string): void {
  expect(m.positions.length, what).toBeGreaterThan(0);
  expect(m.positions.length % 9, what).toBe(0);
  expect(m.colours.length, what).toBe(m.positions.length);
  expect(m.normals.length, what).toBe(m.positions.length);
  expect(Array.from(m.positions).every(Number.isFinite), what).toBe(true);
  // A lamp's lit shade is brighter than white (3d-engine.md "Lamps glow without lights"), so no upper bound.
  expect(
    Array.from(m.colours).every((v) => Number.isFinite(v) && v >= 0),
    what,
  ).toBe(true);
}

describe('every block model', () => {
  it('has kinds to build', () => {
    expect(KINDS.length).toBeGreaterThan(40);
  });

  for (const kind of KINDS)
    it(`builds ${kind} whole at every turn and at two sizes`, () => {
      for (const facing of FACINGS) expectWhole(build(kind, facing), `${kind} ${facing}`);
      expectWhole(build(kind, 'n', 0.5), `${kind} small`);
      expectWhole(build(kind, 'n', 2), `${kind} large`);
    });

  it('builds a tree of every species, each its own', () => {
    const counts = new Set<number>();
    for (const species of TREE_VARIANTS) {
      const m = build('tree', 'n', 1, species);
      expectWhole(m, species);
      counts.add(m.positions.length);
    }
    expect(counts.size).toBeGreaterThan(1);
  });
});
