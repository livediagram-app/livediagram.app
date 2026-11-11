import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livehuddle/document';
import { checkoutFlow, fixedIds } from './fixtures/checkout-flow';
import {
  defaultSpot,
  firstOverlapIn,
  nudgeUntilFree,
  resolvePlacement,
  type Box,
} from './placement';
import { createState, putElement } from './state';
import type { Placement } from './types';
import { PLACEMENT_GAP } from './vocabulary';

const stateOf = (tab: Tab = checkoutFlow()) => createState(tab, { makeId: fixedIds() }, () => {});
const size = { width: 100, height: 40 };
const place = (placement: Placement | undefined, tab?: Tab, moving: string[] = []) => {
  const out = resolvePlacement(stateOf(tab), placement, size, new Set(moving), 1);
  if ('rejection' in out) throw new Error(out.rejection.details.join('\n'));
  return out;
};
const refusal = (placement: Placement, moving: string[] = []) => {
  const out = resolvePlacement(stateOf(), placement, size, new Set(moving), 1);
  if (!('rejection' in out)) throw new Error('expected a refusal');
  return out.rejection;
};
const box = (id: string, x: number, y: number, w = 100, h = 40): Element => ({
  id,
  type: 'shape',
  shape: 'signpost',
  x,
  y,
  width: w,
  height: h,
});
const withElements = (...extra: Element[]): Tab => ({
  ...checkoutFlow(),
  elements: [...checkoutFlow().elements, ...extra],
});

describe('the four sides (n3 is 0,200 140x60)', () => {
  it('puts the box the gap past the reference, centred on it', () => {
    expect(place({ rel: 'right-of', ref: 'n3' })).toMatchObject({
      x: 140 + PLACEMENT_GAP,
      y: 210,
      ref: { id: 'n3' },
    });
    expect(place({ rel: 'left-of', ref: 'n3', gap: 10 })).toMatchObject({ x: -110, y: 210 });
    expect(place({ rel: 'below', ref: 'n8', gap: 20 })).toMatchObject({ x: 20, y: 800 });
    expect(place({ rel: 'above', ref: 'n1', gap: 0 })).toMatchObject({ x: 20, y: -40 });
  });

  it('moves along the side past each element in the way', () => {
    // Touching an edge is not overlapping: with no gap the box rests on n4; with a gap it walks the column.
    expect(place({ rel: 'below', ref: 'n3', gap: 0 })).toMatchObject({ x: 20, y: 260 });
    expect(place({ rel: 'below', ref: 'n3', gap: 10 })).toMatchObject({ x: 20, y: 790 });
    const blocked = withElements(box('r1', 140, 200), box('r2', 240, 200));
    expect(place({ rel: 'right-of', ref: 'n3', gap: 0 }, blocked)).toMatchObject({ x: 340 });
    expect(
      place({ rel: 'left-of', ref: 'n3', gap: 0 }, withElements(box('l1', -100, 210))),
    ).toMatchObject({ x: -200 });
    expect(place({ rel: 'above', ref: 'n2', gap: 10 })).toMatchObject({ y: -50 });
  });

  it('never lands on what moves with it, nor minds a stored backdrop', () => {
    expect(
      place({ rel: 'below', ref: 'n3', gap: 10 }, undefined, ['n4', 'n5', 'n6', 'n7', 'n8']),
    ).toMatchObject({ y: 270 });
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: a stored lane, stack, boundary or
// frame is a backdrop. What sat on it sits over it, so a box placed beside one of those lands on the backdrop too.
describe('a stored backdrop', () => {
  it('is not in the way of a box placed beside what sits on it', () => {
    // n4 (0,300 140x60) sits on the stored boundary f2 (-40,280 220x200).
    expect(place({ rel: 'right-of', ref: 'n4' })).toMatchObject({
      x: 140 + PLACEMENT_GAP,
      y: 330 - size.height / 2,
    });
    for (const shape of ['lane', 'stack', 'frame']) {
      const backdrop = { ...box('back', -100, 250, 2000, 400), shape } as unknown as Element;
      expect(place({ rel: 'right-of', ref: 'n4' }, withElements(backdrop)), shape).toMatchObject({
        x: 140 + PLACEMENT_GAP,
      });
    }
  });

  it('is in the way when it is a stored kind that is no backdrop', () => {
    const card = { ...box('card', 150, 300, 200, 60), shape: 'card' } as unknown as Element;
    expect(place({ rel: 'right-of', ref: 'n4' }, withElements(card)).x).toBeGreaterThanOrEqual(350);
  });
});

describe('align and at', () => {
  it("shares the reference's centre on the nearer axis, the column on a tie", () => {
    const state = stateOf();
    const near = (start: { x: number; y: number }) => {
      const out = resolvePlacement(state, { rel: 'align', ref: 'n3' }, size, new Set(), 1, {
        ...start,
        ...size,
      });
      if ('rejection' in out) throw new Error('refused');
      return { x: out.x, y: out.y };
    };
    expect(near({ x: 500, y: 190 })).toEqual({ x: 500, y: 210 });
    expect(near({ x: 30, y: 900 })).toEqual({ x: 20, y: 900 });
    expect(near({ x: 420, y: 610 })).toEqual({ x: 20, y: 610 });
  });

  it('aligns the default spot when no start is given', () => {
    expect(place({ rel: 'align', ref: 'n1' })).toMatchObject({ y: 10 });
  });

  it('takes at: from the content origin, exactly', () => {
    expect(place({ rel: 'at', x: 0, y: 0 })).toEqual({ x: -40, y: 0 });
    expect(place({ rel: 'at', x: 50, y: 210 })).toEqual({ x: 10, y: 210 });
  });
});

describe('the default spot (EO26)', () => {
  it('goes right of the content at its top, past what is there', () => {
    expect(place(undefined)).toEqual({ x: 310 + PLACEMENT_GAP, y: 0 });
  });

  it('goes right of the element this changeset added last', () => {
    const state = stateOf();
    putElement(state, box('made', 1000, 500), 1);
    state.created.push('made');
    expect(defaultSpot(state, size, new Set())).toEqual({
      x: 1100 + PLACEMENT_GAP,
      y: 500,
      ...size,
    });
  });

  it('goes to the origin on an empty tab', () => {
    expect(place(undefined, { id: 't', name: 'T', elements: [] })).toEqual({ x: 0, y: 0 });
  });
});

describe('placement refusals', () => {
  it('refuses an arrow, a reference that moves, and a reference that is not there', () => {
    expect(refusal({ rel: 'below', ref: 'a1' }).details).toEqual([
      'below:a1: a1 is an arrow; place against a box',
    ]);
    expect(refusal({ rel: 'below', ref: 'n3' }, ['n3']).details).toEqual([
      'below:n3: n3 moves with it',
    ]);
    expect(refusal({ rel: 'below', ref: 'nope' }).code).toBe('target_not_found');
  });
});

describe('nudgeUntilFree', () => {
  it('stops after passing every occupier', () => {
    const start = { x: 0, y: 0, width: 10, height: 10 };
    const wall = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 15, y: 0, width: 10, height: 10 },
    ];
    expect(nudgeUntilFree(start, 'right-of', 5, wall)).toEqual({
      x: 30,
      y: 0,
      width: 10,
      height: 10,
    });
  });
});

describe('firstOverlapIn', () => {
  // A seeded walk over boxes, so the comparison is deterministic.
  function boxes(seed: number, count: number): Box[] {
    let s = seed;
    const next = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    return Array.from({ length: count }, () => ({
      x: Math.round(next() * 4000 - 2000),
      y: Math.round(next() * 4000 - 2000),
      width: Math.round(10 + next() * 300),
      height: Math.round(10 + next() * 200),
    }));
  }
  const naive = (taken: readonly Box[], box: Box) =>
    taken.find(
      (o) =>
        box.x < o.x + o.width &&
        o.x < box.x + box.width &&
        box.y < o.y + o.height &&
        o.y < box.y + box.height,
    );

  it('finds the first overlapping box in order, as a scan would', () => {
    const taken = [
      ...boxes(7, 300),
      { x: -5000, y: -5000, width: 10_000, height: 10_000 },
      ...boxes(9, 50),
    ];
    const first = firstOverlapIn(taken);
    for (const box of boxes(11, 200)) expect(first(box)).toBe(naive(taken, box));
    const sparse = boxes(13, 300);
    const firstSparse = firstOverlapIn(sparse);
    for (const box of boxes(17, 200)) expect(firstSparse(box)).toBe(naive(sparse, box));
  });

  it('checks everything for a query box spanning the board', () => {
    const taken = boxes(19, 40);
    expect(firstOverlapIn(taken)({ x: -3000, y: -3000, width: 6000, height: 6000 })).toBe(taken[0]);
  });
});
