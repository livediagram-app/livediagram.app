import { describe, expect, it } from 'vitest';
import { FIND_BAR_CLEARANCE, findBarTop } from './find-bar-top';

// docs/specs/007-editor/find-and-replace.md "The bar": the open bar never covers a page's title bar (Work Tracker
// 1052, where it hid Lock page and the cog).

const bar = { left: 859, right: 1279, height: 46 };
const titleBar = (left: number, right: number, top = 85, bottom = 119) => ({
  left,
  right,
  top,
  bottom,
});

describe('findBarTop', () => {
  it('keeps its place under the strip with no title bar in the way', () => {
    expect(findBarTop(68, bar, [], 800)).toBe(68);
    // Beside it, above it or below it: not in the way.
    expect(findBarTop(68, bar, [titleBar(400, 800), titleBar(900, 1200, 10, 60)], 800)).toBe(68);
    expect(findBarTop(68, bar, [titleBar(900, 1200, 300, 334)], 800)).toBe(68);
  });

  it('steps under a title bar it would cover (the 1295 px wide case from the card)', () => {
    const top = findBarTop(68, bar, [titleBar(653, 973), titleBar(1119, 1439)], 800);
    expect(top).toBe(119 + FIND_BAR_CLEARANCE);
  });

  it('steps under title bars stacked so that the first step lands on the next', () => {
    const top = findBarTop(68, bar, [titleBar(900, 1000), titleBar(1000, 1100, 140, 174)], 800);
    expect(top).toBe(174 + FIND_BAR_CLEARANCE);
  });

  it('ignores a title bar with no size (hidden)', () => {
    expect(findBarTop(68, bar, [{ left: 900, right: 900, top: 85, bottom: 85 }], 800)).toBe(68);
  });

  it('keeps its place when there is no room under the title bars', () => {
    expect(findBarTop(68, bar, [titleBar(900, 1000)], 150)).toBe(68);
  });

  it('settles within its bound even with title bars all the way down', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      titleBar(900, 1000, 70 + i * 40, 104 + i * 40),
    );
    const top = findBarTop(68, bar, many, 10_000);
    expect(top).toBeGreaterThan(68);
    expect(Number.isFinite(top)).toBe(true);
  });
});
