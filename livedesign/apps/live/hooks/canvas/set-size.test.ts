import { describe, expect, it } from 'vitest';

import { MAX_SIZE_PX, MIN_SIZE_PX, typedSize } from './useShapeStyleSetters';

// The typed-size rule (docs/specs/008-canvas/element-size.md), exercised as the pure function setSizeSelected
// calls. What is worth pinning is the arithmetic, which is where a floorplan gets the wrong wall length.

type Box = { width: number; height: number; aspectLocked?: boolean };

const resize = (el: Box, size: { width?: number; height?: number }): Box => ({
  ...el,
  ...typedSize(el, size),
});

describe('typed element size', () => {
  it('sets exactly what was typed', () => {
    // The whole point: a floorplan wall is the number you asked for, not the
    // number a drag handle happened to land on.
    expect(resize({ width: 120, height: 120 }, { width: 340 })).toMatchObject({
      width: 340,
      height: 120,
    });
  });

  it('leaves the other dimension alone when the lock is off', () => {
    expect(resize({ width: 200, height: 80 }, { height: 30 })).toMatchObject({
      width: 200,
      height: 30,
    });
  });

  it('carries the other dimension when the lock is on', () => {
    // 340x120 is a 2.833 ratio; a 170 width therefore wants a 60 height.
    const out = resize({ width: 340, height: 120, aspectLocked: true }, { width: 170 });
    expect(out).toMatchObject({ width: 170, height: 60 });
  });

  it('carries width from a typed height too', () => {
    const out = resize({ width: 340, height: 120, aspectLocked: true }, { height: 60 });
    expect(out).toMatchObject({ width: 170, height: 60 });
  });

  it('does not carry when both dimensions are given at once', () => {
    // Setting both IS the intent; the lock must not overrule it.
    const out = resize({ width: 340, height: 120, aspectLocked: true }, { width: 50, height: 400 });
    expect(out).toMatchObject({ width: 50, height: 400 });
  });

  it('clamps a zero, a negative and a runaway number', () => {
    // A zero box is not a shape, and a stray extra digit should not produce a
    // canvas nobody can pan out of.
    expect(resize({ width: 100, height: 100 }, { width: 0 }).width).toBe(MIN_SIZE_PX);
    expect(resize({ width: 100, height: 100 }, { width: -50 }).width).toBe(MIN_SIZE_PX);
    expect(resize({ width: 100, height: 100 }, { width: 9_000_000 }).width).toBe(MAX_SIZE_PX);
  });

  it('survives a zero-height element without dividing by zero', () => {
    const out = resize({ width: 100, height: 0, aspectLocked: true }, { width: 50 });
    expect(Number.isFinite(out.height)).toBe(true);
    expect(out.height).toBeGreaterThanOrEqual(MIN_SIZE_PX);
  });

  it('keeps the locked ratio when the typed side is clamped', () => {
    // A runaway width on a locked 2:1 box stops at the cap with its ratio, not at 20000 x 15000.
    expect(
      resize({ width: 200, height: 100, aspectLocked: true }, { width: 30_000 }),
    ).toMatchObject({ width: MAX_SIZE_PX, height: MAX_SIZE_PX / 2 });
    // And a tiny one stops where the short side meets the floor, still 4:1.
    expect(resize({ width: 400, height: 100, aspectLocked: true }, { width: 12 })).toMatchObject({
      width: 32,
      height: MIN_SIZE_PX,
    });
  });

  it('rounds to whole pixels', () => {
    expect(resize({ width: 100, height: 100 }, { width: 33.7 }).width).toBe(34);
  });
});
