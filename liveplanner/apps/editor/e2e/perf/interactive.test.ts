import { describe, expect, it } from 'vitest';
import { interactiveMs, OPEN_QUIET_MS } from './interactive';

// Opening counts every long frame (docs/specs/008-canvas/canvas-performance.md "Measuring", D68).
describe('interactiveMs', () => {
  it('is zero when nothing long runs after the response', () => {
    expect(interactiveMs(1000, [{ start: 100, end: 900 }])).toBe(0);
  });

  it('ends at the first gap of the quiet length', () => {
    const busy = [
      { start: 1000, end: 1800 },
      { start: 2000, end: 2100 },
      { start: 2100 + OPEN_QUIET_MS, end: 3000 },
    ];
    expect(interactiveMs(1000, busy)).toBe(1100);
  });

  it('keeps going through a gap shorter than the quiet length', () => {
    const busy = [
      { start: 1000, end: 1500 },
      { start: 1500 + OPEN_QUIET_MS - 1, end: 2200 },
    ];
    expect(interactiveMs(1000, busy)).toBe(1200);
  });

  it('counts a render-only long frame that no long task covers', () => {
    const tasks = [{ start: 1000, end: 1400 }];
    const frames = [{ start: 1700, end: 2300 }];
    expect(interactiveMs(1000, [...tasks, ...frames])).toBe(1300);
  });

  it('merges overlapping tasks and frames in any order', () => {
    const busy = [
      { start: 1300, end: 1600 },
      { start: 1000, end: 1500 },
      { start: 1100, end: 1200 },
    ];
    expect(interactiveMs(1000, busy)).toBe(600);
  });

  it('counts only the part of a task that runs after the response', () => {
    expect(interactiveMs(1000, [{ start: 500, end: 1250 }])).toBe(250);
  });
});
