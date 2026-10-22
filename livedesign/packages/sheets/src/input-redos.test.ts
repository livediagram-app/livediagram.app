// Typed input is read in time linear in its length, however it is crafted: the patterns CodeQL flagged as
// polynomial (js/polynomial-redos) stay well inside a budget on their worst inputs.
import { describe, expect, it } from 'vitest';
import { parseDateText } from './dates';
import { parsePlainNumber } from './input';
import { fillSeries } from './fill';

const N = 50_000;
const BUDGET_MS = 250;
const timed = (fn: () => unknown) => {
  const t = performance.now();
  fn();
  return performance.now() - t;
};

describe('reading typed input', () => {
  it('reads a date with a long run of spaces quickly', () => {
    for (const head of ['2026-10-09', '9/10/2026', '9 Oct 2026', 'Oct 9 2026'])
      expect(timed(() => parseDateText(`${head}${' '.repeat(N)}x`, true))).toBeLessThan(BUDGET_MS);
    // A time after the date still reads, even after extra spaces.
    expect(parseDateText('2026-10-09  14:30', true)?.hasTime).toBe(true);
  });

  it('reads a long run of digits as a number quickly', () => {
    expect(timed(() => parsePlainNumber(`${'0'.repeat(N)}x`))).toBeLessThan(BUDGET_MS);
    expect(parsePlainNumber('12.5e3')).toBe(12500);
    expect(parsePlainNumber('1.')).toBe(1);
  });

  it('fills a series from texts ending in long runs of digits quickly', () => {
    const long = `Item ${'0'.repeat(N)}`;
    expect(timed(() => fillSeries([{ s: long }, { s: `${long}x` }] as never, 3))).toBeLessThan(
      BUDGET_MS,
    );
  });
});
