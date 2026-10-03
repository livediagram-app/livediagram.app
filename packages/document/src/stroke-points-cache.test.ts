import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STROKE_DECODE_CACHE_POINTS,
  clearStrokePointsCache,
  createStrokePointsDecoder,
  decodeStrokePoints,
} from './stroke-points-cache';
import { EMPTY_STROKE_POINTS, encodeStrokePoints, type NormalisedPoint } from './stroke-points';

function line(count: number, seed = 0): NormalisedPoint[] {
  return Array.from({ length: count }, (_, i) => ({ nx: i / Math.max(1, count), ny: seed / 1000 }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('decodeStrokePoints', () => {
  it('decodes a block', () => {
    const points = decodeStrokePoints(encodeStrokePoints(line(3), [0, 0.5, 1]));
    expect(points.count).toBe(3);
    expect([...points.pressures!]).toEqual([0, 128 / 255, 1]);
  });

  it('returns the same arrays for the same block', () => {
    const packed = encodeStrokePoints(line(10));
    const first = decodeStrokePoints(packed);
    // An equal string from elsewhere (a fresh JSON.parse) hits the same entry.
    const second = decodeStrokePoints(JSON.parse(JSON.stringify(packed)) as string);
    expect(second).toBe(first);
    expect(second.nx).toBe(first.nx);
  });

  it('has a budget well above the largest real board', () => {
    expect(STROKE_DECODE_CACHE_POINTS).toBe(500_000);
  });
});

describe('createStrokePointsDecoder', () => {
  it('stays within its point budget, evicting the least recently used first', () => {
    const decoder = createStrokePointsDecoder(30);
    const [a, b, c, d] = [0, 1, 2, 3].map((i) => encodeStrokePoints(line(10, i)));
    const first = decoder.decode(a!);
    decoder.decode(b!);
    decoder.decode(c!);
    expect(decoder.size()).toEqual({ entries: 3, points: 30 });
    decoder.decode(a!); // touched: now the most recent
    decoder.decode(d!); // over budget: b, the oldest untouched, goes
    expect(decoder.size()).toEqual({ entries: 3, points: 30 });
    expect(decoder.decode(a!)).toBe(first);
    expect(decoder.has(b!)).toBe(false);
    expect(decoder.has(c!)).toBe(true);
  });

  it('decodes a block bigger than the whole budget without caching it', () => {
    const decoder = createStrokePointsDecoder(5);
    const big = encodeStrokePoints(line(6));
    expect(decoder.decode(big).count).toBe(6);
    expect(decoder.size()).toEqual({ entries: 0, points: 0 });
  });

  it('gives the empty stroke for a corrupt block and logs it once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const decoder = createStrokePointsDecoder(100);
    expect(decoder.decode('AQ*=')).toBe(EMPTY_STROKE_POINTS);
    expect(decoder.decode('AQ*=')).toBe(EMPTY_STROKE_POINTS);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[stroke-points] undecodable', {
      rejection: 'not-base64',
      length: 4,
    });
  });

  it('clears', () => {
    const decoder = createStrokePointsDecoder(100);
    decoder.decode(encodeStrokePoints(line(4)));
    decoder.clear();
    expect(decoder.size()).toEqual({ entries: 0, points: 0 });
  });
});

describe('clearStrokePointsCache', () => {
  it('makes the next decode of a block a fresh one', () => {
    const packed = encodeStrokePoints(line(5));
    const first = decodeStrokePoints(packed);
    clearStrokePointsCache();
    const second = decodeStrokePoints(packed);
    expect(second).not.toBe(first);
    expect([...second.nx]).toEqual([...first.nx]);
  });
});
