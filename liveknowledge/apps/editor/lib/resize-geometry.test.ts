import { describe, expect, it } from 'vitest';
import {
  leadingAxis,
  MIN_SIZE,
  minUniformScale,
  nextBounds,
  snapLeadingAxis,
  unionResizeMember,
  type ShapeBounds,
} from './resize-geometry';

// Shift keeps the aspect ratio everywhere (docs/specs/008-canvas/canvas-and-palette.md "Resize"): the
// constrained branch of the resize geometry, for every handle.

const START: ShapeBounds = { x: 100, y: 200, width: 80, height: 40 };
const ratioOf = (b: ShapeBounds) => b.width / b.height;

describe('nextBounds, constrained edge handles', () => {
  it('scales both sides from the east edge, the west edge anchored and the height centred', () => {
    expect(nextBounds(START, 'resize-e', 40, 7, true)).toEqual({
      x: 100,
      y: 190,
      width: 120,
      height: 60,
    });
  });

  it('scales both sides from the west edge, the east edge anchored', () => {
    const out = nextBounds(START, 'resize-w', -40, 0, true);
    expect(out).toEqual({ x: 60, y: 190, width: 120, height: 60 });
    expect(out.x + out.width).toBe(START.x + START.width);
  });

  it('scales both sides from the north edge, the south edge anchored and the width centred', () => {
    expect(nextBounds(START, 'resize-n', 3, -20, true)).toEqual({
      x: 80,
      y: 180,
      width: 120,
      height: 60,
    });
  });

  it('scales both sides from the south edge, the north edge anchored', () => {
    expect(nextBounds(START, 'resize-s', 0, 20, true)).toEqual({
      x: 80,
      y: 200,
      width: 120,
      height: 60,
    });
  });

  it('keeps an unconstrained edge handle single-axis', () => {
    expect(nextBounds(START, 'resize-e', 40, 7, false)).toEqual({
      x: 100,
      y: 200,
      width: 120,
      height: 40,
    });
  });
});

describe('nextBounds, constrained floor', () => {
  it('stops a hard shrink where the shorter side reaches the minimum, ratio intact', () => {
    const out = nextBounds(START, 'resize-se', -200, -200, true);
    expect(out).toEqual({ x: 100, y: 200, width: 40, height: MIN_SIZE });
  });

  it('never bends the ratio of a stroke thinner than the minimum', () => {
    const line: ShapeBounds = { x: 0, y: 0, width: 200, height: 2 };
    expect(ratioOf(nextBounds(line, 'resize-se', 200, 0, true))).toBeCloseTo(100);
    expect(ratioOf(nextBounds(line, 'resize-se', -150, 0, true))).toBeCloseTo(100);
  });
});

describe('leadingAxis', () => {
  it('is the edge handle’s own axis', () => {
    expect(leadingAxis('resize-e', 1, 90)).toBe('x');
    expect(leadingAxis('resize-w', 1, 90)).toBe('x');
    expect(leadingAxis('resize-n', 90, 1)).toBe('y');
    expect(leadingAxis('resize-s', 90, 1)).toBe('y');
  });

  it('is the axis the pointer moved further along, for a corner', () => {
    expect(leadingAxis('resize-se', 40, 5)).toBe('x');
    expect(leadingAxis('resize-nw', 5, -40)).toBe('y');
  });
});

describe('minUniformScale', () => {
  it('lets the shorter side reach the minimum', () => {
    expect(minUniformScale({ width: 80, height: 40 })).toBe(MIN_SIZE / 40);
  });

  it('never shrinks a side that is already below the minimum', () => {
    expect(minUniformScale({ width: 200, height: 2 })).toBe(1);
  });
});

describe('snapLeadingAxis', () => {
  it('snaps only the leading side and re-derives the other from the ratio, anchored', () => {
    const candidate: ShapeBounds = { x: 0, y: 0, width: 100, height: 50 };
    const out = snapLeadingAxis(candidate, 'se', 'x', (c) => ({ ...c, width: 104, height: 9 }));
    expect(out).toEqual({ x: 0, y: 0, width: 104, height: 52 });
  });

  it('keeps the opposite corner of a north-west drag where it is', () => {
    const candidate: ShapeBounds = { x: 10, y: 20, width: 100, height: 50 };
    const out = snapLeadingAxis(candidate, 'nw', 'y', (c) => ({ ...c, y: 18, height: 52 }));
    expect(out).toEqual({ x: 6, y: 18, width: 104, height: 52 });
  });

  it('centres the other side of an edge drag', () => {
    const candidate: ShapeBounds = { x: 0, y: 0, width: 100, height: 50 };
    const out = snapLeadingAxis(candidate, 'e', 'x', (c) => ({ ...c, width: 104 }));
    expect(out).toEqual({ x: 0, y: -1, width: 104, height: 52 });
  });
});

describe('unionResizeMember', () => {
  it('never bumps a member that began below the minimum up to it', () => {
    const union: ShapeBounds = { x: 0, y: 0, width: 200, height: 100 };
    const thin: ShapeBounds = { x: 0, y: 50, width: 200, height: 2 };
    const out = unionResizeMember(thin, union, { x: 0, y: 0, width: 300, height: 150 }, 'se');
    expect(out.height).toBeCloseTo(3);
    expect(ratioOf(out)).toBeCloseTo(100);
  });
});
