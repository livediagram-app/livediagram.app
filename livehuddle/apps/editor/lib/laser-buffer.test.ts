import { describe, expect, it } from 'vitest';
import { DEFAULT_LASER_CONFIG, laserLifetimeMs } from './laser-config';
import {
  LASER_BUFFER_TTL_MS,
  LASER_MAX_POINTS,
  trimLaserBuffer,
  type LaserPoint,
} from './laser-buffer';

// trimLaserBuffer caps a per-participant laser trail in both
// dimensions: age (drop samples older than the TTL) and count
// (cap at LASER_MAX_POINTS most-recent). It runs on every append
// (local broadcast + remote receive) so a misbehaving peer can't
// grow the buffer without bound. Tests inject `now` so the
// deterministic-clock branches are easy to pin.

const pts = (...ts: number[]): LaserPoint[] => ts.map((t, i) => ({ x: i, y: i * 2, t }));

describe('trimLaserBuffer', () => {
  it('returns an empty array unchanged', () => {
    expect(trimLaserBuffer([], 1000)).toEqual([]);
  });

  it('keeps every point when all are within the TTL', () => {
    const now = 2000;
    // Two points well inside the window.
    const input = pts(now - 100, now - 50);
    expect(trimLaserBuffer(input, now)).toEqual(input);
  });

  it('drops points older than now - LASER_BUFFER_TTL_MS', () => {
    const now = 5000;
    const stale = pts(now - LASER_BUFFER_TTL_MS - 10);
    const fresh = pts(now - 200);
    const result = trimLaserBuffer([...stale, ...fresh], now);
    expect(result.map((p) => p.t)).toEqual(fresh.map((p) => p.t));
  });

  it('keeps a point sitting exactly at the cutoff (inclusive boundary)', () => {
    const now = 5000;
    const boundary = pts(now - LASER_BUFFER_TTL_MS);
    expect(trimLaserBuffer(boundary, now)).toEqual(boundary);
  });

  it('caps fresh points to the LASER_MAX_POINTS most recent', () => {
    const now = 10_000;
    // LASER_MAX_POINTS + 5 fresh points, each 1 ms apart.
    const input: LaserPoint[] = Array.from({ length: LASER_MAX_POINTS + 5 }, (_, i) => ({
      x: i,
      y: 0,
      t: now - (LASER_MAX_POINTS + 5 - i),
    }));
    const result = trimLaserBuffer(input, now);
    expect(result).toHaveLength(LASER_MAX_POINTS);
    // The 5 oldest dropped; the latest LASER_MAX_POINTS survive in
    // their original order.
    expect(result).toEqual(input.slice(5));
  });

  it('applies the TTL drop BEFORE the count cap', () => {
    const now = 10_000;
    // 10 stale points (would be dropped by TTL) + LASER_MAX_POINTS
    // fresh points. The fresh ones all survive, and the count cap
    // does nothing here because there are exactly LASER_MAX_POINTS
    // fresh.
    const stale: LaserPoint[] = Array.from({ length: 10 }, (_, i) => ({
      x: i,
      y: 0,
      t: now - LASER_BUFFER_TTL_MS - i - 1,
    }));
    const fresh: LaserPoint[] = Array.from({ length: LASER_MAX_POINTS }, (_, i) => ({
      x: 100 + i,
      y: 0,
      t: now - (LASER_MAX_POINTS - i),
    }));
    expect(trimLaserBuffer([...stale, ...fresh], now)).toEqual(fresh);
  });

  it('defaults the now reading to performance.now() when omitted', () => {
    // Smoke test: omitting `now` shouldn't throw and the default
    // behaviour matches an explicit-now call against the same
    // clock. We use a clearly-stale timestamp (well below any
    // realistic performance.now() reading minus TTL) for the
    // dropped point and a freshly-read performance.now() for the
    // kept point. t=0 is NOT a reliable "stale" choice because in
    // a fresh Node process performance.now() can still be under
    // LASER_BUFFER_TTL_MS, putting t=0 inside the cutoff window.
    const stale = -LASER_BUFFER_TTL_MS - 1_000_000;
    const result = trimLaserBuffer([
      { x: 0, y: 0, t: stale },
      { x: 1, y: 1, t: performance.now() },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBe(1);
  });

  // docs/specs/008-canvas/laser-panel.md: the Long trail fades over its whole lifetime, so a buffer drawn at the
  // ~30 Hz send rate keeps every sample of it.
  it('keeps a whole Long trail drawn at the send rate', () => {
    const now = 100_000;
    const lifetime = laserLifetimeMs({ ...DEFAULT_LASER_CONFIG, trail: 'long' });
    const samples: LaserPoint[] = Array.from({ length: Math.floor(lifetime / 33) + 1 }, (_, i) => ({
      x: i,
      y: 0,
      t: now - lifetime + i * 33,
    }));
    expect(trimLaserBuffer(samples, now)).toEqual(samples);
  });
});
