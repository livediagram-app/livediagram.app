import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import {
  CAR_SPEED,
  CAR_STRIDE,
  HEADWAY_S,
  laneCars,
  roadLanes,
  roadSeed,
  TRAFFIC_TONES,
  trafficKey,
  trafficRoads,
} from './road-traffic';
import { CAR_LENGTH } from './models/road';

// The Road's traffic (docs/specs/009-elements/road.md "Traffic").
const shape = (id: string, kind: string, x: number, y: number, width: number, height: number) =>
  ({ id, type: 'shape', shape: kind, x, y, width, height }) as unknown as Element;

/** Every car on a lane at time t, as [s, fade, tone] triples. */
function cars(seed: number, lane: number, length: number, t: number): [number, number, number][] {
  const out = new Float32Array(64 * CAR_STRIDE);
  const n = laneCars(seed, lane, length, t, out, 0, 64);
  return Array.from({ length: n }, (_, i) => [out[i * 3]!, out[i * 3 + 1]!, out[i * 3 + 2]!]);
}

describe('roadLanes', () => {
  it('keeps right across the canvas: the bottom lane drives right, the top lane left', () => {
    const [near, far] = roadLanes({ x: 0, y: 0, width: 480, height: 136 });
    expect(near).toMatchObject({ x0: 0, x1: 480, length: 480 });
    expect(far).toMatchObject({ x0: 480, x1: 0 });
    expect(near!.y0).toBeGreaterThan(68);
    expect(far!.y0).toBeLessThan(68);
  });

  it('keeps right down the canvas: the left lane drives down, the right lane up', () => {
    const [left, right] = roadLanes({ x: 0, y: 0, width: 136, height: 600 });
    expect(left).toMatchObject({ y0: 0, y1: 600 });
    expect(right).toMatchObject({ y0: 600, y1: 0 });
    expect(left!.x0).toBeLessThan(68);
    expect(right!.x0).toBeGreaterThan(68);
  });

  it('has no lanes on a road too narrow for a car, or of no size', () => {
    expect(roadLanes({ x: 0, y: 0, width: 480, height: 90 })).toEqual([]);
    expect(roadLanes({ x: 0, y: 0, width: 0, height: 136 })).toEqual([]);
  });
});

describe('laneCars', () => {
  const seed = roadSeed('road-1');

  it('gives every viewer the same cars for the same road and time', () => {
    for (const t of [1_700_000_000, 1_700_000_123.4, 1_800_000_000.9])
      expect(cars(seed, 0, 1600, t)).toEqual(cars(seed, 0, 1600, t));
  });

  it('sets off different cars on different roads and lanes', () => {
    const at = (s: number, lane: number) =>
      Array.from(
        { length: 200 },
        (_, i) => cars(s, lane, 1600, 1_700_000_000 + i * 3).length,
      ).join();
    expect(at(seed, 0)).not.toBe(at(roadSeed('road-2'), 0));
    expect(at(seed, 0)).not.toBe(at(seed, 1));
  });

  it('keeps cars on a lane at least the headway apart, inside the road, in palette tones', () => {
    let seen = 0;
    for (let i = 0; i < 2000; i++) {
      const now = cars(seed, 0, 3000, 1_700_000_000 + i * 0.37).sort((a, b) => a[0] - b[0]);
      seen += now.length;
      for (const [s, fade, tone] of now) {
        expect(s).toBeGreaterThanOrEqual(CAR_LENGTH / 2);
        expect(s).toBeLessThanOrEqual(3000 - CAR_LENGTH / 2 + 1e-3);
        expect(fade).toBeGreaterThanOrEqual(0);
        expect(fade).toBeLessThanOrEqual(1);
        expect(Number.isInteger(tone)).toBe(true);
        expect(tone).toBeLessThan(TRAFFIC_TONES.length);
      }
      for (let k = 1; k < now.length; k++)
        expect(now[k]![0] - now[k - 1]![0]).toBeGreaterThanOrEqual(HEADWAY_S * CAR_SPEED - 1);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('fades a car in at its start, holds it full, and fades it out at its end', () => {
    // Follow cars through a minute: each one's fade rises from near 0, reaches 1 and falls near 0.
    const length = 1600;
    let starts = 0;
    let ends = 0;
    let full = 0;
    for (let i = 0; i < 6000; i++)
      for (const [s, fade] of cars(seed, 1, length, 1_700_000_000 + i * 0.02)) {
        if (s < CAR_LENGTH / 2 + 30) {
          expect(fade).toBeLessThan(0.25);
          starts++;
        } else if (s > length - CAR_LENGTH / 2 - 30) {
          expect(fade).toBeLessThan(0.25);
          ends++;
        } else if (s > 200 && s < length - 200) {
          expect(fade).toBe(1);
          full++;
        }
      }
    expect(starts).toBeGreaterThan(0);
    expect(ends).toBeGreaterThan(0);
    expect(full).toBeGreaterThan(0);
  });

  it('has no cars on a road shorter than a car, and writes no more than its room', () => {
    expect(cars(seed, 0, CAR_LENGTH, 1_700_000_000)).toEqual([]);
    const out = new Float32Array(CAR_STRIDE);
    for (let i = 0; i < 500; i++)
      expect(laneCars(seed, 0, 20_000, 1_700_000_000 + i, out, 0, 1)).toBeLessThanOrEqual(1);
    expect(laneCars(seed, 0, 20_000, 1_700_000_000, out, 0, 0)).toBe(0);
  });

  it('works out ten long roads for a minute of frames well within a frame budget', () => {
    const roads = Array.from({ length: 10 }, (_, i) => roadSeed(`road-${i}`));
    const out = new Float32Array(96 * CAR_STRIDE);
    const t0 = performance.now();
    for (let f = 0; f < 60 * 30; f++)
      for (const s of roads)
        for (let lane = 0; lane < 2; lane++)
          laneCars(s, lane, 1600, 1_700_000_000 + f / 30, out, 0, 96);
    const perFrame = (performance.now() - t0) / (60 * 30);
    // About a microsecond a frame measured; 0.2 ms is a generous ceiling for a slow CI runner.
    expect(perFrame).toBeLessThan(0.2);
  });
});

describe('trafficRoads', () => {
  it('drives the roads out of doors only, wide enough for a car', () => {
    const els = [
      shape('room', 'room', 0, 0, 800, 600),
      shape('in', 'road', 100, 200, 480, 136),
      shape('out', 'road', 100, 900, 480, 136),
      shape('thin', 'road', 100, 1200, 480, 60),
      shape('path', 'garden-path', 0, 0, 200, 64),
    ];
    const roads = trafficRoads(els);
    expect(roads.map((r) => r.id)).toEqual(['out']);
    expect(roads[0]!.seed).toBe(roadSeed('out'));
    expect(roads[0]!.lanes).toHaveLength(2);
  });

  it('keys on roads, rooms and corridors only', () => {
    const a = [shape('r', 'road', 0, 0, 480, 136), shape('b', 'bench', 0, 0, 40, 40)];
    const b = [shape('r', 'road', 0, 0, 480, 136), shape('b', 'bench', 50, 50, 40, 40)];
    expect(trafficKey(a)).toBe(trafficKey(b));
    expect(trafficKey(a)).not.toBe(trafficKey([shape('r', 'road', 10, 0, 480, 136)]));
  });
});
