import { describe, expect, it } from 'vitest';
import { sideInsetsOf } from './side-chrome-insets';

// docs/specs/007-editor/illustrate-pages.md "Contents": the sidebar's width is kept clear on its side.
const canvas = { left: 0, right: 1200, top: 60, bottom: 860 };

describe('sideInsetsOf', () => {
  it('covers the left up to a left sidebar, the right from a right one', () => {
    expect(sideInsetsOf(canvas, { left: 0, right: 236, top: 130, bottom: 860 })).toEqual({
      left: 236,
      right: 0,
    });
    expect(sideInsetsOf(canvas, { left: 964, right: 1200, top: 130, bottom: 860 })).toEqual({
      left: 0,
      right: 236,
    });
  });

  it('is nothing for a panel outside the canvas, or too short to be in the way', () => {
    expect(sideInsetsOf(canvas, { left: 1300, right: 1500, top: 130, bottom: 860 })).toEqual({
      left: 0,
      right: 0,
    });
    expect(sideInsetsOf(canvas, { left: 0, right: 236, top: 130, bottom: 200 })).toEqual({
      left: 0,
      right: 0,
    });
  });

  it('never covers more than half the canvas', () => {
    expect(sideInsetsOf(canvas, { left: 0, right: 900, top: 60, bottom: 860 }).left).toBe(600);
  });
});
