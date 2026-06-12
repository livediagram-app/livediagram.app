import {
  createAnnotation,
  createShape,
  type ArrowElement,
  type Element,
} from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import {
  arrowReferencesAny,
  cornerOf,
  inheritedSizeFor,
  MIN_SIZE,
  nextBounds,
  snapRotation,
  unionOfBounds,
  unionResizeMember,
  withFrameContents,
  type ShapeBounds,
} from './canvas';

const baseBounds: ShapeBounds = { x: 100, y: 200, width: 80, height: 40 };

describe('nextBounds — move', () => {
  it('translates the box by the cursor delta and leaves dimensions untouched', () => {
    const out = nextBounds(baseBounds, 'move', 50, -25, false);
    expect(out).toEqual({ x: 150, y: 175, width: 80, height: 40 });
  });

  it('ignores aspectLocked for move (no resize axis to compress onto)', () => {
    const out = nextBounds(baseBounds, 'move', 50, -25, true);
    expect(out).toEqual({ x: 150, y: 175, width: 80, height: 40 });
  });
});

describe('nextBounds — free corner resize', () => {
  it('grows SE corner outward, leaving x/y pinned to the NW corner', () => {
    const out = nextBounds(baseBounds, 'resize-se', 20, 10, false);
    expect(out).toEqual({ x: 100, y: 200, width: 100, height: 50 });
  });

  it('pulls SW corner inward by adjusting x to keep the eastern edge fixed', () => {
    const out = nextBounds(baseBounds, 'resize-sw', 20, 10, false);
    // signX is -1 here, so dx=20 shrinks width by 20 → 60; x slides right
    // by (80 - 60) = 20 so the east edge (x=180) stays put.
    expect(out).toEqual({ x: 120, y: 200, width: 60, height: 50 });
  });

  it('pulls NE corner inward in y, keeping the south edge fixed', () => {
    const out = nextBounds(baseBounds, 'resize-ne', 20, 10, false);
    // signY is -1 here, so dy=10 shrinks height by 10 → 30; y slides
    // down by (40 - 30) = 10 so the south edge (y=240) stays put.
    expect(out).toEqual({ x: 100, y: 210, width: 100, height: 30 });
  });

  it('pulls NW corner inward in both axes, keeping the south-east corner pinned', () => {
    const out = nextBounds(baseBounds, 'resize-nw', 20, 10, false);
    expect(out).toEqual({ x: 120, y: 210, width: 60, height: 30 });
  });

  it('clamps each side at MIN_SIZE when the cursor would shrink past it', () => {
    const out = nextBounds(baseBounds, 'resize-se', -200, -200, false);
    expect(out.width).toBe(MIN_SIZE);
    expect(out.height).toBe(MIN_SIZE);
  });
});

describe('nextBounds — aspect-locked corner resize', () => {
  it('lets the dominant axis (x here) drive both dimensions', () => {
    // baseBounds is 80×40 (ratio 2:1). dx=40 > dy=5, so width wins.
    const out = nextBounds(baseBounds, 'resize-se', 40, 5, true);
    expect(out.width).toBe(120);
    expect(out.height).toBe(60); // 120 / 2
    expect(out.x).toBe(100);
    expect(out.y).toBe(200);
  });

  it('lets the dominant axis (y here) drive both dimensions when dy wins', () => {
    // dx=5 < dy=40, so height wins. candH = 80; newW = 80 * (80/40) = 160.
    const out = nextBounds(baseBounds, 'resize-se', 5, 40, true);
    expect(out.height).toBe(80);
    expect(out.width).toBe(160);
  });

  it('clamps locked resize at MIN_SIZE on each axis', () => {
    const out = nextBounds(baseBounds, 'resize-se', -200, -200, true);
    expect(out.width).toBeGreaterThanOrEqual(MIN_SIZE);
    expect(out.height).toBeGreaterThanOrEqual(MIN_SIZE);
  });
});

const freeArrow: ArrowElement = {
  type: 'arrow',
  id: 'a1',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 100, y: 100 },
};

const pinnedFromArrow: ArrowElement = {
  ...freeArrow,
  from: { kind: 'pinned', elementId: 'el-from', anchor: 'e' },
};

const pinnedToArrow: ArrowElement = {
  ...freeArrow,
  to: { kind: 'pinned', elementId: 'el-to', anchor: 'w' },
};

const bothPinnedArrow: ArrowElement = {
  type: 'arrow',
  id: 'a2',
  from: { kind: 'pinned', elementId: 'el-from', anchor: 'e' },
  to: { kind: 'pinned', elementId: 'el-to', anchor: 'w' },
};

describe('inheritedSizeFor', () => {
  it('inherits the selected element size for a normal shape', () => {
    const newShape = createShape('square', 0, 0);
    const selected = { ...createShape('square', 0, 0), width: 300, height: 90 };
    expect(inheritedSizeFor(newShape, selected)).toEqual({ width: 300, height: 90 });
  });

  it('keeps an annotation at its fixed marker size regardless of selection (spec/38)', () => {
    const marker = createAnnotation(0, 0);
    const bigSelected = { ...createShape('square', 0, 0), width: 400, height: 250 };
    // A marker added while a big shape is selected must NOT balloon.
    expect(inheritedSizeFor(marker, bigSelected)).toEqual({ width: 44, height: 44 });
    expect(inheritedSizeFor(marker, null)).toEqual({ width: 44, height: 44 });
  });
});

describe('withFrameContents', () => {
  const frame: Element = { ...createShape('frame', 100, 100), width: 200, height: 200 };
  // Centre at (150,150): inside the 100..300 frame box.
  const inside: Element = { ...createShape('square', 130, 130), width: 40, height: 40 };
  // Centre at (500,500): outside.
  const outside: Element = { ...createShape('square', 480, 480), width: 40, height: 40 };
  const elements = [frame, inside, outside];

  it('expands a frame move set with the elements whose centre is inside it', () => {
    const out = withFrameContents(elements, new Set([frame.id]));
    expect(out.has(frame.id)).toBe(true);
    expect(out.has(inside.id)).toBe(true);
    expect(out.has(outside.id)).toBe(false);
  });

  it('returns the same set untouched when no id is a frame (cheap no-op)', () => {
    const ids = new Set([inside.id]);
    expect(withFrameContents(elements, ids)).toBe(ids);
  });
});

describe('arrowReferencesAny', () => {
  it('returns false for an arrow with no pinned endpoints', () => {
    expect(arrowReferencesAny(freeArrow, new Set(['el-from', 'el-to']))).toBe(false);
  });

  it('matches when the `from` endpoint is pinned to a listed id', () => {
    expect(arrowReferencesAny(pinnedFromArrow, new Set(['el-from']))).toBe(true);
  });

  it('matches when the `to` endpoint is pinned to a listed id', () => {
    expect(arrowReferencesAny(pinnedToArrow, new Set(['el-to']))).toBe(true);
  });

  it('matches when either endpoint of a fully-pinned arrow is listed', () => {
    expect(arrowReferencesAny(bothPinnedArrow, new Set(['el-from']))).toBe(true);
    expect(arrowReferencesAny(bothPinnedArrow, new Set(['el-to']))).toBe(true);
  });

  it('returns false when the pinned endpoints are not in the id set', () => {
    expect(arrowReferencesAny(bothPinnedArrow, new Set(['unrelated']))).toBe(false);
  });

  it('returns false against an empty id set', () => {
    expect(arrowReferencesAny(bothPinnedArrow, new Set())).toBe(false);
  });
});

describe('cornerOf', () => {
  it('maps each resize mode to its diagonal corner letter', () => {
    expect(cornerOf('resize-nw')).toBe('nw');
    expect(cornerOf('resize-ne')).toBe('ne');
    expect(cornerOf('resize-sw')).toBe('sw');
    expect(cornerOf('resize-se')).toBe('se');
  });

  it('returns null for move (no corner is being pulled)', () => {
    expect(cornerOf('move')).toBeNull();
  });
});

describe('unionOfBounds', () => {
  it('returns null for an empty iterable so callers can short-circuit', () => {
    expect(unionOfBounds([])).toBeNull();
  });

  it('returns the same bounds back for a single-element union', () => {
    const only: ShapeBounds = { x: 10, y: 20, width: 30, height: 40 };
    expect(unionOfBounds([only])).toEqual(only);
  });

  it('takes the outermost edges across multiple disjoint bounds', () => {
    const a: ShapeBounds = { x: 0, y: 0, width: 50, height: 30 };
    const b: ShapeBounds = { x: 80, y: 100, width: 20, height: 40 };
    expect(unionOfBounds([a, b])).toEqual({ x: 0, y: 0, width: 100, height: 140 });
  });

  it('survives overlapping bounds without double-counting size', () => {
    const a: ShapeBounds = { x: 0, y: 0, width: 60, height: 60 };
    const b: ShapeBounds = { x: 40, y: 40, width: 60, height: 60 };
    expect(unionOfBounds([a, b])).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });
});

describe('unionResizeMember', () => {
  // Union starts at (0,0) - (100,100). The two members are:
  //   - top-left quadrant: (0,0) - (40,40)
  //   - bottom-right quadrant: (60,60) - (100,100)
  // so we can pin both the corner-at-anchor and the corner-far-from-anchor
  // members at the same time and assert each one moves the right way.
  const unionStart: ShapeBounds = { x: 0, y: 0, width: 100, height: 100 };
  const memberAtNW: ShapeBounds = { x: 0, y: 0, width: 40, height: 40 };
  const memberAtSE: ShapeBounds = { x: 60, y: 60, width: 40, height: 40 };

  it('with SE corner drag (NW anchor fixed), scales every member outward from the NW corner', () => {
    // Double the union: (0,0) - (200,200).
    const unionNext: ShapeBounds = { x: 0, y: 0, width: 200, height: 200 };
    const newNW = unionResizeMember(memberAtNW, unionStart, unionNext, 'se');
    const newSE = unionResizeMember(memberAtSE, unionStart, unionNext, 'se');
    // NW member sits on the anchor: position stays, size doubles.
    expect(newNW).toEqual({ x: 0, y: 0, width: 80, height: 80 });
    // SE member doubles in distance from the anchor AND in size.
    expect(newSE).toEqual({ x: 120, y: 120, width: 80, height: 80 });
  });

  it('with NW corner drag (SE anchor fixed), scales every member inward toward the SE corner', () => {
    // Halve the union from the SE side: (50,50) - (100,100).
    const unionNext: ShapeBounds = { x: 50, y: 50, width: 50, height: 50 };
    const newNW = unionResizeMember(memberAtNW, unionStart, unionNext, 'nw');
    const newSE = unionResizeMember(memberAtSE, unionStart, unionNext, 'nw');
    // NW member halves and slides toward the SE anchor.
    expect(newNW).toEqual({ x: 50, y: 50, width: 20, height: 20 });
    // SE member's bottom-right was AT the anchor — it stays put at the
    // anchor and halves its size.
    expect(newSE.x).toBeCloseTo(80);
    expect(newSE.y).toBeCloseTo(80);
    expect(newSE.width).toBe(MIN_SIZE);
    expect(newSE.height).toBe(MIN_SIZE);
  });

  it('with SW corner drag (NE anchor fixed), keeps the east edge of east-side members put', () => {
    // Pull SW down + left: (-50, 0) - (100, 150). Width grew from 100 to 150.
    const unionNext: ShapeBounds = { x: -50, y: 0, width: 150, height: 150 };
    const newSE = unionResizeMember(memberAtSE, unionStart, unionNext, 'sw');
    // The east edge of memberAtSE was at x=100, which IS the anchor x.
    // Its right edge should still land at x=100 (anchor = unionStart.x + width).
    expect(newSE.x + newSE.width).toBeCloseTo(100);
  });

  it('with NE corner drag (SW anchor fixed), keeps the west edge of west-side members put', () => {
    // Pull NE up + right: (0,-50) - (150, 100). Width grew 100→150.
    const unionNext: ShapeBounds = { x: 0, y: -50, width: 150, height: 150 };
    const newNW = unionResizeMember(memberAtNW, unionStart, unionNext, 'ne');
    // The west edge of memberAtNW was at x=0, which IS the anchor x.
    expect(newNW.x).toBeCloseTo(0);
  });

  it('floors each member at MIN_SIZE on collapse so tiny members survive a hard shrink', () => {
    const tinyUnion: ShapeBounds = { x: 0, y: 0, width: 1, height: 1 };
    const out = unionResizeMember(memberAtSE, unionStart, tinyUnion, 'nw');
    expect(out.width).toBe(MIN_SIZE);
    expect(out.height).toBe(MIN_SIZE);
  });

  it('handles a zero-width union without dividing by zero', () => {
    const flat: ShapeBounds = { x: 10, y: 10, width: 0, height: 50 };
    // sx falls back to unionNext.width / 1 so the math stays finite.
    const out = unionResizeMember(flat, flat, { ...flat, width: 30 }, 'se');
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.width)).toBe(true);
  });
});

describe('snapRotation', () => {
  it('normalises into [0, 360) including negative + over-360 inputs', () => {
    expect(snapRotation(-90, true)).toBe(270);
    expect(snapRotation(370, true)).toBe(10);
    expect(snapRotation(720, true)).toBe(0);
  });

  it('snaps to the nearest 15-degree increment when within threshold', () => {
    expect(snapRotation(3, false)).toBe(0);
    expect(snapRotation(43, false)).toBe(45);
    expect(snapRotation(92, false)).toBe(90);
    // 358 is within 7 of 360 -> snaps to 360 % 360 = 0.
    expect(snapRotation(358, false)).toBe(0);
  });

  it('leaves angles outside the snap threshold untouched', () => {
    // Midpoints between 15-degree multiples sit 7.5 from either, just
    // outside the 7-degree snap window.
    expect(snapRotation(22.5, false)).toBe(22.5);
    expect(snapRotation(52.5, false)).toBe(52.5);
  });

  it('bypasses snapping entirely when free (Shift held)', () => {
    expect(snapRotation(3, true)).toBe(3);
    expect(snapRotation(43, true)).toBe(43);
  });
});
