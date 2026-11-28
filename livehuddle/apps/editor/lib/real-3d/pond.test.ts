// docs/specs/008-canvas/3d-engine.md "Models" (The Pond is sunk into the ground): a stone coping just proud of the
// lawn, the water below the floor, dark in its deep middle and light in its shallows, a sheen of sky on glass, and a
// bank that shelves more gently than the camera looks down, so no side shows what the ground would hide.
import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { buildModel, MODELS } from './models';
import { RISE } from './models/kit';
import { POND_WATER_Z, pondWaterHeight } from './models/pond';
import { pieceFrame } from './piece-frame';
import { pieceTones } from './piece-tones';
import { modelled, piecesMesh } from './scene-pieces';
import { SPACE_3D_TILT_DEG } from '@/lib/space-3d/space-3d-camera';
import { cpuBudgetMs, cpuLeastMsOf } from '@liveworkspace/vitest-config/cpu-time';

function pond(width = 240, height = 152): Element {
  return { ...createShape('pond', 0, 0), id: 'pond', width, height };
}

function build(width = 240, height = 152, fill = '#1e4f6e') {
  const el = pond(width, height) as Parameters<typeof pieceFrame>[0];
  const f = pieceFrame(el);
  return { f, m: buildModel('pond', { f, t: pieceTones(null, fill, '#334155'), seats: [] }) };
}

const zs = (p: readonly number[]) => p.filter((_, i) => i % 3 === 2);
const luma = (c: readonly number[], i: number) => c[i * 3]! + c[i * 3 + 1]! + c[i * 3 + 2]!;

describe('the Pond in 3D', () => {
  it('is modelled, its flat drawing standing in no longer', () => {
    expect(MODELS.pond).toBeTypeOf('function');
    expect(modelled(pond())).toBe(true);
  });

  it('sinks its water below the floor, its coping just proud of the lawn', () => {
    const { m } = build();
    const z = zs(m.positions);
    expect(Math.min(...z)).toBeLessThan(POND_WATER_Z);
    // The coping and pebbles stay low; only the reeds stand taller.
    const nearRim = z.filter((v) => v > 0 && v < 4);
    expect(nearRim.length).toBeGreaterThan(0);
    expect(pondWaterHeight(240, 152)).toBeCloseTo(POND_WATER_Z * RISE);
  });

  it('is darkest in its deep middle and lighter in its shallows', () => {
    const { m } = build();
    const water: { r: number; l: number }[] = [];
    for (let i = 0; i < m.positions.length / 3; i++) {
      if (Math.abs(m.positions[i * 3 + 2]! - POND_WATER_Z) > 1e-6) continue;
      const x = m.positions[i * 3]! / 120;
      const y = m.positions[i * 3 + 1]! / 76;
      water.push({ r: Math.hypot(x, y), l: luma(m.colours, i) });
    }
    const middle = water.filter((w) => w.r < 0.1);
    const edge = water.filter((w) => w.r > 0.8);
    expect(middle.length).toBeGreaterThan(0);
    expect(edge.length).toBeGreaterThan(0);
    const mean = (a: { l: number }[]) => a.reduce((s, w) => s + w.l, 0) / a.length;
    expect(mean(edge)).toBeGreaterThan(mean(middle) * 1.5);
  });

  it('lays a sheen of sky on the water as see-through streaks', () => {
    const { m } = build();
    expect(m.glassPositions.length).toBeGreaterThan(0);
    for (const z of zs(m.glassPositions)) expect(Math.abs(z - POND_WATER_Z)).toBeLessThan(0.2);
  });

  it('shelves its bank below the floor more gently than the camera looks down', () => {
    const { m } = build();
    // Every triangle under the floor that is not the flat water: its slope (rise over run, once risen) under the
    // camera's view from the vertical, so it always faces the camera from above.
    const limit = 1 / Math.tan((SPACE_3D_TILT_DEG * Math.PI) / 180);
    const p = m.positions;
    for (let t = 0; t < p.length / 9; t++) {
      const v = [0, 1, 2].map((k) => [
        p[t * 9 + k * 3]!,
        p[t * 9 + k * 3 + 1]!,
        p[t * 9 + k * 3 + 2]!,
      ]);
      // The bank alone: under the floor and outside the water's edge (what floats on the water is seen from above).
      const inWater = (c: number[]) =>
        (c[0]! / (120 - 15.2)) ** 2 + (c[1]! / (76 - 15.2)) ** 2 < 1.02;
      if (v.some((c) => c[2]! > 0 || inWater(c))) continue;
      const [a, b, c] = v as [number[], number[], number[]];
      const ux = b[0]! - a[0]!;
      const uy = b[1]! - a[1]!;
      const uz = (b[2]! - a[2]!) * RISE;
      const wx = c[0]! - a[0]!;
      const wy = c[1]! - a[1]!;
      const wz = (c[2]! - a[2]!) * RISE;
      const nx = uy * wz - uz * wy;
      const ny = uz * wx - ux * wz;
      const nz = ux * wy - uy * wx;
      const slope = Math.hypot(nx, ny) / Math.abs(nz || 1e-9);
      expect(slope).toBeLessThan(limit);
    }
  });

  it('builds a small pond without failing, and stays cheap at its largest', () => {
    expect(build(40, 30).m.positions.length).toBeGreaterThan(0);
    let big = piecesMesh([]);
    const ms = cpuLeastMsOf(() => {
      big = piecesMesh([pond(1200, 800)]);
    });
    const tris = (big.positions.length + big.glassPositions.length) / 9;
    expect(tris).toBeLessThan(5000);
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });

  it('keeps a pond without a fill of its own blue', () => {
    const { m } = build(240, 152, '#e6e9ee');
    let blue = 0;
    for (let i = 0; i < m.colours.length; i += 3)
      if (m.colours[i + 2]! > m.colours[i]! + 0.15) blue++;
    expect(blue).toBeGreaterThan(50);
  });
});
