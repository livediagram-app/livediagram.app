// docs/specs/009-elements/office-amenities.md "Lamps" and 3d-engine.md "Lamps glow without lights": each lamp builds a
// lit shade (its inside brighter than its outside), a bulb, and a pool of light on glass, the floor lamp on the floor
// and the table and desk lamps on a desk's top.
import { describe, expect, it } from 'vitest';
import { createShape } from '@livehuddle/document';
import { buildModel, KIND_HEIGHT, MODELS } from './models';
import { LAMP_DESK_Z, LAMP_SHADE_Z } from './models/lamps';
import { pieceFrame } from './piece-frame';
import { pieceTones } from './piece-tones';

const KINDS = ['floor-lamp', 'table-lamp', 'desk-lamp'] as const;

function build(kind: (typeof KINDS)[number]) {
  const el = { ...createShape(kind, 0, 0), id: kind };
  const f = pieceFrame(el);
  return { f, m: buildModel(kind, { f, t: pieceTones(null, '#e6e9ee', '#334155'), seats: [] }) };
}

const zs = (p: number[]) => p.filter((_, i) => i % 3 === 2);
const brightness = (c: number[]) => {
  const out: number[] = [];
  for (let i = 0; i < c.length; i += 3) out.push(c[i]! + c[i + 1]! + c[i + 2]!);
  return out;
};

describe('the lamps in 3D', () => {
  it('has a model of its own for each lamp, with a pool of light on the glass', () => {
    for (const kind of KINDS) {
      expect(MODELS[kind], kind).toBeTypeOf('function');
      const { m } = build(kind);
      expect(m.positions.length, kind).toBeGreaterThan(300);
      expect(m.glassPositions.length, kind).toBeGreaterThan(0);
      // The glass is the pool: it lies flat and low, on the floor or the desk.
      const ground = kind === 'floor-lamp' ? 0 : LAMP_DESK_Z;
      for (const z of zs(m.glassPositions)) {
        expect(z, kind).toBeGreaterThanOrEqual(ground);
        expect(z, kind).toBeLessThan(ground + 1);
      }
    }
  });

  it('stands the floor lamp on the floor, and the table and desk lamps on a desk, each about its height', () => {
    const floor = build('floor-lamp').m;
    expect(Math.min(...zs(floor.positions))).toBeCloseTo(0);
    expect(Math.max(...zs(floor.positions))).toBeCloseTo(KIND_HEIGHT['floor-lamp']!, -1);
    for (const kind of ['table-lamp', 'desk-lamp'] as const) {
      const { m } = build(kind);
      expect(Math.min(...zs(m.positions)), kind).toBeGreaterThanOrEqual(LAMP_DESK_Z - 0.01);
      expect(Math.max(...zs(m.positions)) - LAMP_DESK_Z, kind).toBeCloseTo(KIND_HEIGHT[kind]!, -1);
    }
  });

  it('lights each shade from within: its brightest faces sit at its light, brighter than the theme body', () => {
    for (const kind of KINDS) {
      const { m } = build(kind);
      const b = brightness(m.colours);
      const top = Math.max(...b);
      // Warm and near white: the inside of the shade, the bulb.
      expect(top, kind).toBeGreaterThan(2.7);
      const lit = zs(m.positions).filter((_, i) => b[i]! >= top - 0.01);
      const mid = lit.reduce((a, z) => a + z, 0) / lit.length;
      expect(Math.abs(mid - LAMP_SHADE_Z[kind]!), kind).toBeLessThan(12);
    }
  });
});
