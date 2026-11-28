import { describe, expect, it } from 'vitest';
import { buildModel } from './models';
import { pieceFrame } from './piece-frame';
import { CAR_LENGTH, CAR_WIDTH, KERB_Z, roadCar } from './models/road';
import { RISE } from './models/kit';

// The Road's 3D parts (docs/specs/009-elements/road.md "The piece", "Traffic").
describe('roadCar', () => {
  const { body, trim } = roadCar();

  it('splits the car into a body to tint and trim that keeps its colours, whole triangles each', () => {
    expect(body.positions.length).toBeGreaterThan(0);
    expect(trim.positions.length).toBeGreaterThan(0);
    for (const part of [body, trim]) {
      expect(part.positions.length % 9).toBe(0);
      expect(part.colours.length).toBe(part.positions.length);
      expect(part.normals.length).toBe(part.positions.length);
    }
    // The body is built in shades of white (tinted per car); the trim keeps its darker tyres and glass.
    const grey = (c: Float32Array, i: number) =>
      Math.abs(c[i]! - c[i + 1]!) < 1e-6 && Math.abs(c[i]! - c[i + 2]!) < 1e-6;
    for (let i = 0; i < body.colours.length; i += 3) expect(grey(body.colours, i)).toBe(true);
    expect(Math.min(...trim.colours)).toBeLessThan(0.3);
  });

  it('is about its size, nose to +y, standing on the floor and risen as the pieces are', () => {
    let x = 0;
    let y = 0;
    let z0 = Infinity;
    let z1 = 0;
    for (const p of [body.positions, trim.positions])
      for (let i = 0; i < p.length; i += 3) {
        x = Math.max(x, Math.abs(p[i]!));
        y = Math.max(y, Math.abs(p[i + 1]!));
        z0 = Math.min(z0, p[i + 2]!);
        z1 = Math.max(z1, p[i + 2]!);
      }
    expect(x).toBeLessThan(CAR_WIDTH / 2 + 4);
    expect(y).toBeLessThan(CAR_LENGTH / 2 + 2);
    expect(z0).toBeGreaterThanOrEqual(-0.01);
    expect(z1).toBeGreaterThan(30 * RISE * 0.9);
  });
});

describe('the road model', () => {
  for (const [w, h] of [
    [480, 136],
    [136, 480],
  ] as const)
    it(`stands two low kerbs along its length (${w} x ${h})`, () => {
      const f = pieceFrame({ id: 'r', shape: 'road', x: 0, y: 0, width: w, height: h });
      const m = buildModel('road', { f, t: {} as never, seats: [] });
      let zMax = 0;
      for (let i = 0; i < m.positions.length; i += 3) zMax = Math.max(zMax, m.positions[i + 2]!);
      const xs = [];
      const ys = [];
      for (let i = 0; i < m.positions.length; i += 3) {
        xs.push(m.positions[i]!);
        ys.push(m.positions[i + 1]!);
      }
      const longest = Math.max(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      );
      expect(zMax).toBeCloseTo(KERB_Z, 3);
      expect(longest).toBeCloseTo(Math.max(f.W, f.D), 0);
    });
});
