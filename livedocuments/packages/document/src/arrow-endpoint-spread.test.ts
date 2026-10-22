import { describe, expect, it } from 'vitest';
import { arrowEndpointSpread } from './arrow-endpoint-spread';
import { createShape } from './factories';
import { anchorPosition } from './geometry';
import type { ArrowElement, Element, Endpoint } from './index';

// Deterministic ids (createShape mints UUIDs, tests want stable names).
function box(id: string, x: number, y: number, width = 120, height = 60) {
  return { ...createShape('square', x, y), id, width, height };
}

let arrowSeq = 0;
function arrow(from: Endpoint, to: Endpoint, id = `arrow-${++arrowSeq}`): ArrowElement {
  return { id, type: 'arrow', from, to };
}

function pinned(elementId: string, anchor: 's' | 'n' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') {
  return { kind: 'pinned', elementId, anchor } as const;
}

describe('arrowEndpointSpread', () => {
  it('leaves a lone pinned end unoffset', () => {
    const hub = box('hub', 400, 100);
    const a = arrow({ kind: 'free', x: 100, y: 400 }, pinned('hub', 's'), 'a1');
    const elements: Element[] = [hub, a];
    expect(arrowEndpointSpread('a1', 'to', elements)).toEqual({ x: 0, y: 0 });
  });

  it('fans two ends converging on a face anchor symmetrically along the edge', () => {
    const hub = box('hub', 400, 100);
    const left = arrow({ kind: 'free', x: 100, y: 400 }, pinned('hub', 's'), 'left');
    const right = arrow({ kind: 'free', x: 800, y: 400 }, pinned('hub', 's'), 'right');
    const elements: Element[] = [hub, left, right];
    const l = arrowEndpointSpread('left', 'to', elements);
    const r = arrowEndpointSpread('right', 'to', elements);
    // 's' anchor spreads horizontally, centred: -7 / +7 at 14px spacing.
    expect(l).toEqual({ x: -7, y: 0 });
    expect(r).toEqual({ x: 7, y: 0 });
  });

  // docs/specs/008-canvas/arrow-anchors.md "Converging-fan rendering": an arrow set to start at
  // its exact anchor sits out of the fan; the others fan without it.
  it('leaves an exact-start arrow on its anchor and fans the rest without it', () => {
    const hub = box('hub', 400, 100);
    const exact: ArrowElement = {
      ...arrow(pinned('hub', 's'), { kind: 'free', x: 100, y: 400 }, 'exact'),
      exactStart: true,
    };
    const b = arrow(pinned('hub', 's'), { kind: 'free', x: 500, y: 400 }, 'b');
    const c = arrow(pinned('hub', 's'), { kind: 'free', x: 800, y: 400 }, 'c');
    const elements: Element[] = [hub, exact, b, c];
    expect(arrowEndpointSpread('exact', 'from', elements)).toEqual({ x: 0, y: 0 });
    expect(arrowEndpointSpread('b', 'from', elements)).toEqual({ x: -7, y: 0 });
    expect(arrowEndpointSpread('c', 'from', elements)).toEqual({ x: 7, y: 0 });
  });

  it('still fans an exact-start arrow\u2019s far end, which only its start opts out', () => {
    const hub = box('hub', 400, 100);
    const a = {
      ...arrow({ kind: 'free', x: 100, y: 400 }, pinned('hub', 's'), 'a'),
      exactStart: true,
    };
    const b = arrow({ kind: 'free', x: 800, y: 400 }, pinned('hub', 's'), 'b');
    expect(arrowEndpointSpread('a', 'to', [hub, a, b])).toEqual({ x: -7, y: 0 });
  });

  it('keeps an exact end on its anchor, and fans the others among themselves', () => {
    const hub = box('hub', 400, 100);
    const exact = {
      ...arrow({ kind: 'free', x: 100, y: 400 }, pinned('hub', 's'), 'exact'),
      exactEnd: true,
    };
    const b = arrow({ kind: 'free', x: 500, y: 400 }, pinned('hub', 's'), 'b');
    const c = arrow({ kind: 'free', x: 800, y: 400 }, pinned('hub', 's'), 'c');
    const elements: Element[] = [hub, exact, b, c];
    expect(arrowEndpointSpread('exact', 'to', elements)).toEqual({ x: 0, y: 0 });
    expect(arrowEndpointSpread('b', 'to', elements)).toEqual({ x: -7, y: 0 });
    expect(arrowEndpointSpread('c', 'to', elements)).toEqual({ x: 7, y: 0 });
  });

  it('orders slots by where each arrow comes from so lines do not cross', () => {
    const hub = box('hub', 400, 100);
    // Declared right-source first: order in the array must not matter.
    const right = arrow({ kind: 'free', x: 900, y: 400 }, pinned('hub', 's'), 'right');
    const mid = arrow({ kind: 'free', x: 460, y: 400 }, pinned('hub', 's'), 'mid');
    const left = arrow({ kind: 'free', x: 100, y: 400 }, pinned('hub', 's'), 'left');
    const elements: Element[] = [hub, right, mid, left];
    expect(arrowEndpointSpread('left', 'to', elements).x).toBeLessThan(
      arrowEndpointSpread('mid', 'to', elements).x,
    );
    expect(arrowEndpointSpread('mid', 'to', elements).x).toBeLessThan(
      arrowEndpointSpread('right', 'to', elements).x,
    );
  });

  it('spreads e / w anchors vertically', () => {
    const hub = box('hub', 400, 100);
    const top = arrow({ kind: 'free', x: 800, y: 50 }, pinned('hub', 'e'), 'top');
    const bottom = arrow({ kind: 'free', x: 800, y: 300 }, pinned('hub', 'e'), 'bottom');
    const elements: Element[] = [hub, top, bottom];
    expect(arrowEndpointSpread('top', 'to', elements)).toEqual({ x: 0, y: -7 });
    expect(arrowEndpointSpread('bottom', 'to', elements)).toEqual({ x: 0, y: 7 });
  });

  it('marches inward from a corner anchor instead of centring', () => {
    const hub = box('hub', 400, 100);
    const a = arrow({ kind: 'free', x: 100, y: 400 }, pinned('hub', 'se'), 'a');
    const b = arrow({ kind: 'free', x: 900, y: 400 }, pinned('hub', 'se'), 'b');
    const elements: Element[] = [hub, a, b];
    const oa = arrowEndpointSpread('a', 'to', elements);
    const ob = arrowEndpointSpread('b', 'to', elements);
    // 'se' fans inward along the bottom edge (negative x): slots 0 / -14,
    // never off the box (no positive x).
    expect([oa.x, ob.x].sort((p, q) => p - q)).toEqual([-14, 0]);
    expect(oa.x).toBeLessThanOrEqual(0);
    expect(ob.x).toBeLessThanOrEqual(0);
  });

  it('clamps spacing so a big fan stays within the target edge', () => {
    const hub = box('hub', 400, 100, 60, 40); // narrow box
    const arrows = Array.from({ length: 7 }, (_, i) =>
      arrow({ kind: 'free', x: i * 150, y: 400 }, pinned('hub', 's'), `a${i}`),
    );
    const elements: Element[] = [hub, ...arrows];
    const xs = arrows.map((a) => arrowEndpointSpread(a.id, 'to', elements).x);
    const spanUsed = Math.max(...xs) - Math.min(...xs);
    expect(spanUsed).toBeLessThanOrEqual(60 * 0.8 + 1e-9);
  });

  it('rotates the fan with a rotated target element', () => {
    const hub = { ...box('hub', 400, 100), rotation: 90 };
    const a = arrow({ kind: 'free', x: 100, y: 400 }, pinned('hub', 's'), 'a');
    const b = arrow({ kind: 'free', x: 900, y: 400 }, pinned('hub', 's'), 'b');
    const elements: Element[] = [hub, a, b];
    const oa = arrowEndpointSpread('a', 'to', elements);
    // At 90° the horizontal fan turns vertical.
    expect(Math.abs(oa.x)).toBeLessThan(1e-9);
    expect(Math.abs(oa.y)).toBe(7);
  });

  it('does not offset free or on-arrow ends', () => {
    const hub = box('hub', 400, 100);
    const a = arrow({ kind: 'free', x: 100, y: 400 }, pinned('hub', 's'), 'a');
    const b = arrow({ kind: 'free', x: 800, y: 400 }, pinned('hub', 's'), 'b');
    const elements: Element[] = [hub, a, b];
    expect(arrowEndpointSpread('a', 'from', elements)).toEqual({ x: 0, y: 0 });
  });

  it('keeps the fanned point on the target edge (face anchor)', () => {
    const hub = box('hub', 400, 100);
    const a = arrow({ kind: 'free', x: 100, y: 400 }, pinned('hub', 's'), 'a');
    const b = arrow({ kind: 'free', x: 800, y: 400 }, pinned('hub', 's'), 'b');
    const elements: Element[] = [hub, a, b];
    const base = anchorPosition(hub, 's');
    const off = arrowEndpointSpread('a', 'to', elements);
    // Bottom edge: y stays put, x stays within the box.
    expect(base.y + off.y).toBe(base.y);
    expect(base.x + off.x).toBeGreaterThanOrEqual(hub.x);
    expect(base.x + off.x).toBeLessThanOrEqual(hub.x + hub.width);
  });
});

describe('quarter fans (docs/specs/008-canvas/arrow-anchors.md)', () => {
  it('centres a quarter fan on the quarter and keeps it within half the edge', () => {
    // 120 wide: half the edge is 60, 80% of it 48 across 9 ends = 6px spacing.
    const hub = box('hub', 400, 100);
    const ends = Array.from({ length: 9 }, (_, i) =>
      arrow(
        { kind: 'free', x: 100 + i * 100, y: 400 },
        { kind: 'pinned', elementId: 'hub', anchor: 'sse' },
        `q${i}`,
      ),
    );
    const elements: Element[] = [hub, ...ends];
    const xs = ends.map((e) => arrowEndpointSpread(e.id, 'to', elements).x);
    expect(xs[0]).toBeCloseTo(-24, 6);
    expect(xs[8]).toBeCloseTo(24, 6);
    expect(arrowEndpointSpread('q4', 'to', elements)).toEqual({ x: 0, y: 0 });
  });

  it('fans a quarter on a vertical side along y', () => {
    const hub = box('hub', 400, 100);
    const a = arrow(
      { kind: 'free', x: 800, y: 50 },
      { kind: 'pinned', elementId: 'hub', anchor: 'ene' },
      'a',
    );
    const b = arrow(
      { kind: 'free', x: 800, y: 300 },
      { kind: 'pinned', elementId: 'hub', anchor: 'ene' },
      'b',
    );
    const elements: Element[] = [hub, a, b];
    expect(arrowEndpointSpread('a', 'to', elements)).toEqual({ x: 0, y: -7 });
    expect(arrowEndpointSpread('b', 'to', elements)).toEqual({ x: 0, y: 7 });
  });
});

describe('ties in the fan', () => {
  it('puts the nearer of two arrows from one column on the side they come from, so neither crosses', () => {
    // Two steps in one column left of the target, both arriving on its top: the nearer (lower) takes the left slot.
    const target = box('t', 300, 300);
    const far = box('far', 0, 0);
    const near = box('near', 0, 150);
    const fromFar = arrow(pinned('far', 'e'), pinned('t', 'n'), 'a-far');
    const fromNear = arrow(pinned('near', 'e'), pinned('t', 'n'), 'z-near');
    const elements: Element[] = [target, far, near, fromFar, fromNear];
    const xNear = arrowEndpointSpread('z-near', 'to', elements).x;
    const xFar = arrowEndpointSpread('a-far', 'to', elements).x;
    expect(xNear).toBeLessThan(xFar);
    // And mirrored: from the right, the nearer takes the right slot, whatever the ids.
    const farR = box('farR', 600, 0);
    const nearR = box('nearR', 600, 150);
    const r1 = arrow(pinned('farR', 'w'), pinned('t', 'n'), 'z-farR');
    const r2 = arrow(pinned('nearR', 'w'), pinned('t', 'n'), 'a-nearR');
    const right: Element[] = [target, farR, nearR, r1, r2];
    expect(arrowEndpointSpread('a-nearR', 'to', right).x).toBeGreaterThan(
      arrowEndpointSpread('z-farR', 'to', right).x,
    );
  });
});

describe('fan order', () => {
  it('gives the same slots whatever order the arrows come in, for ends a pixel or so apart', () => {
    // Along the top edge: 0, 0.8 and 1.6 px apart, each next pair "level" but the outer pair not, and the nearer of
    // each level pair the later: a comparator that ties within a pixel then reads a < c, c < b and b < a.
    const hub = box('hub', 400, 300);
    const ends = [
      arrow({ kind: 'free', x: 100, y: 20 }, pinned('hub', 'n'), 'a'),
      arrow({ kind: 'free', x: 100.8, y: 100 }, pinned('hub', 'n'), 'b'),
      arrow({ kind: 'free', x: 101.6, y: 160 }, pinned('hub', 'n'), 'c'),
    ];
    const slotsOf = (order: number[]) => {
      const elements: Element[] = [hub, ...order.map((i) => ends[i]!)];
      return ['a', 'b', 'c'].map((id) => arrowEndpointSpread(id, 'to', elements).x);
    };
    const first = slotsOf([0, 1, 2]);
    for (const order of [
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ])
      expect(slotsOf(order), order.join('')).toEqual(first);
  });
});
