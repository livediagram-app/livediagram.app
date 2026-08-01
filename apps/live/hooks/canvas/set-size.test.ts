import { describe, expect, it } from 'vitest';

import { MAX_SIZE_PX, MIN_SIZE_PX } from './useShapeStyleSetters';

// The typed-size rule (spec/134), exercised as the pure function it is. The
// hook itself needs a React tree and a commit handle; what is worth pinning is
// the arithmetic, which is where a floorplan gets the wrong wall length.

type Box = { width: number; height: number; aspectLocked?: boolean };

const clamp = (n: number): number =>
  Math.round(Math.min(MAX_SIZE_PX, Math.max(MIN_SIZE_PX, Number.isFinite(n) ? n : MIN_SIZE_PX)));

// Mirrors the body of setSizeSelected's map callback.
function resize(el: Box, size: { width?: number; height?: number }): Box {
  const locked = el.aspectLocked === true;
  const ratio = el.height > 0 ? el.width / el.height : 1;
  let width = size.width ?? el.width;
  let height = size.height ?? el.height;
  if (locked && ratio > 0) {
    if (size.width !== undefined && size.height === undefined) {
      height = Math.round(width / ratio);
    } else if (size.height !== undefined && size.width === undefined) {
      width = Math.round(height * ratio);
    }
  }
  return { ...el, width: clamp(width), height: clamp(height) };
}

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
    // diagram nobody can pan out of.
    expect(resize({ width: 100, height: 100 }, { width: 0 }).width).toBe(MIN_SIZE_PX);
    expect(resize({ width: 100, height: 100 }, { width: -50 }).width).toBe(MIN_SIZE_PX);
    expect(resize({ width: 100, height: 100 }, { width: 9_000_000 }).width).toBe(MAX_SIZE_PX);
  });

  it('survives a zero-height element without dividing by zero', () => {
    const out = resize({ width: 100, height: 0, aspectLocked: true }, { width: 50 });
    expect(Number.isFinite(out.height)).toBe(true);
    expect(out.height).toBeGreaterThanOrEqual(MIN_SIZE_PX);
  });

  it('rounds to whole pixels', () => {
    expect(resize({ width: 100, height: 100 }, { width: 33.7 }).width).toBe(34);
  });
});
