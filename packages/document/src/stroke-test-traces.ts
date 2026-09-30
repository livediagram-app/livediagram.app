// Seeded synthetic pen traces and curve metrics for the stroke pipeline's
// tests (docs/research/stroke-smoothing.md "Test plan"). Test-only: nothing in
// the package barrel imports it. Units are screen px and milliseconds.

import type { Point } from './geometry-primitives';

export type TraceSample = { x: number; y: number; t: number };

/** A small, fast, seeded PRNG (mulberry32): the same seed, the same trace. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal samples from a seeded uniform source (Box-Muller). */
export function seededGaussian(seed: number): () => number {
  const rand = seededRandom(seed);
  return () => {
    const u = Math.max(rand(), 1e-12);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

export type TraceNoise = {
  /** White noise, sigma in px, per axis. */
  white?: number;
  /** A 10 Hz tremor of this amplitude in px, perpendicular-ish (both axes, phase-shifted). */
  tremor?: number;
  seed?: number;
};

/**
 * Samples a trajectory `at(tMs)` at `hz` from 0 to `durationMs` inclusive of the end, with optional
 * noise. The last sample lands exactly at the end so every rate ends on the same point.
 */
export function sampleTrace(
  at: (t: number) => Point,
  durationMs: number,
  hz: number,
  noise: TraceNoise = {},
): TraceSample[] {
  const gauss = seededGaussian(noise.seed ?? 1);
  const step = 1000 / hz;
  const out: TraceSample[] = [];
  const count = Math.floor(durationMs / step);
  for (let i = 0; i <= count + 1; i++) {
    const t = Math.min(i * step, durationMs);
    if (out.length > 0 && t <= out[out.length - 1]!.t) break;
    const p = at(t);
    const tremor = noise.tremor ?? 0;
    const white = noise.white ?? 0;
    out.push({
      x: p.x + white * gauss() + tremor * Math.sin((2 * Math.PI * 10 * t) / 1000),
      y: p.y + white * gauss() + tremor * Math.cos((2 * Math.PI * 10 * t) / 1000),
      t,
    });
  }
  return out;
}

/** A straight line along +x at `speed` px/s. */
export const lineAt =
  (speed: number) =>
  (t: number): Point => ({ x: (speed * t) / 1000, y: 0 });

/** A circle of radius `r` about (0, 0) drawn at `speed` px/s, starting at (r, 0). */
export const circleAt =
  (r: number, speed: number) =>
  (t: number): Point => {
    const a = (speed * t) / 1000 / r;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  };

/**
 * A V: in along one leg to the vertex at (0, 0), out along the other, the legs `angleDeg` apart,
 * each `leg` px long. The pen slows near the vertex, down to a fifth of `speed` there, as a hand
 * does at a deliberate corner. Returns the trajectory and its duration.
 */
export function vAt(
  angleDeg: number,
  leg: number,
  speed: number,
): { at: (t: number) => Point; durationMs: number } {
  const half = (angleDeg * Math.PI) / 360;
  // Leg 1 arrives from up-left of the vertex, leg 2 leaves to the up-right, symmetric about -y.
  const inDir = { x: Math.sin(half), y: Math.cos(half) };
  const outDir = { x: Math.sin(half), y: -Math.cos(half) };
  const start = { x: -inDir.x * leg, y: -inDir.y * leg };
  // Arc length s along the whole V (0..2 leg) as a function of time, by integrating the speed.
  const vAtS = (s: number) => {
    const d = Math.abs(s - leg);
    const k = Math.min(1, d / 40);
    const smooth = k * k * (3 - 2 * k);
    return (speed / 1000) * (0.2 + 0.8 * smooth);
  };
  const dt = 0.05;
  const ts: number[] = [0];
  const ss: number[] = [0];
  let s = 0;
  let t = 0;
  while (s < 2 * leg) {
    s = Math.min(2 * leg, s + vAtS(s) * dt);
    t += dt;
    ts.push(t);
    ss.push(s);
  }
  const posAtS = (sv: number): Point =>
    sv <= leg
      ? { x: start.x + inDir.x * sv, y: start.y + inDir.y * sv }
      : { x: outDir.x * (sv - leg), y: outDir.y * (sv - leg) };
  const at = (time: number): Point => {
    const i = Math.min(ts.length - 1, Math.max(0, Math.round(time / dt)));
    return posAtS(ss[i]!);
  };
  return { at, durationMs: t };
}

/**
 * Handwriting-like loops: a prolate cycloid ("llll") moving along +x at `advance` px/s, loop
 * radius `r` px, one loop every `periodMs`.
 */
export const loopsAt =
  (advance: number, r: number, periodMs: number) =>
  (t: number): Point => {
    const w = (2 * Math.PI * t) / periodMs;
    return { x: (advance * t) / 1000 - r * Math.sin(w), y: -r * Math.cos(w) + r };
  };

/** Samples one cubic Bezier at `steps` + 1 points. */
function cubic(p0: Point, c1: Point, c2: Point, p1: Point, steps: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const v = 1 - u;
    out.push({
      x: v * v * v * p0.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * p1.x,
      y: v * v * v * p0.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * p1.y,
    });
  }
  return out;
}

/** Densely samples an `M ... C ...` path (as `catmullRomToBezierPath` writes it). */
export function samplePath(d: string, stepsPerSegment = 16): Point[] {
  const nums = d.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 2) return [];
  let cur = { x: nums[0]!, y: nums[1]! };
  const out: Point[] = [cur];
  for (let i = 2; i + 5 < nums.length; i += 6) {
    const c1 = { x: nums[i]!, y: nums[i + 1]! };
    const c2 = { x: nums[i + 2]!, y: nums[i + 3]! };
    const p = { x: nums[i + 4]!, y: nums[i + 5]! };
    out.push(...cubic(cur, c1, c2, p, stepsPerSegment).slice(1));
    cur = p;
  }
  return out;
}

function distToSeg(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = vx * vx + vy * vy;
  const u = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len));
  return Math.hypot(p.x - a.x - u * vx, p.y - a.y - u * vy);
}

/** Distance from `p` to the nearest point of polyline `line`. */
export function distToPolyline(p: Point, line: Point[]): number {
  if (line.length === 1) return Math.hypot(p.x - line[0]!.x, p.y - line[0]!.y);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) best = Math.min(best, distToSeg(p, line[i - 1]!, line[i]!));
  return best;
}

/** The largest distance from any point of `a` to polyline `b`. */
export function maxDistance(a: Point[], b: Point[]): number {
  let worst = 0;
  for (const p of a) worst = Math.max(worst, distToPolyline(p, b));
  return worst;
}

/** Symmetric Hausdorff distance between two densely sampled curves. */
export function hausdorff(a: Point[], b: Point[]): number {
  return Math.max(maxDistance(a, b), maxDistance(b, a));
}
