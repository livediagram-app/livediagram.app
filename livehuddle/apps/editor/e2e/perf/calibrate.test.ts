import { describe, expect, it } from 'vitest';
import { REFERENCE_BENCH_MS, TARGET_SLOWDOWN, calibratedThrottle } from './calibrate';

// docs/specs/008-canvas/canvas-performance.md "The budget": the probe slows the machine it runs on
// to the reference speed, the reference machine throttled 4x.

describe('calibratedThrottle', () => {
  it('throttles the reference machine 4x', () => {
    expect(calibratedThrottle(REFERENCE_BENCH_MS)).toEqual({
      rate: TARGET_SLOWDOWN,
      slowerThanTarget: false,
    });
  });

  it('throttles a machine twice as slow half as much', () => {
    expect(calibratedThrottle(REFERENCE_BENCH_MS * 2).rate).toBeCloseTo(TARGET_SLOWDOWN / 2);
  });

  it('runs a machine slower than the reference speed unthrottled, and says so', () => {
    expect(calibratedThrottle(REFERENCE_BENCH_MS * 6)).toEqual({ rate: 1, slowerThanTarget: true });
  });

  it('refuses a benchmark that did not run', () => {
    expect(() => calibratedThrottle(0)).toThrow('BadBenchmark');
    expect(() => calibratedThrottle(Number.NaN)).toThrow('BadBenchmark');
  });
});
