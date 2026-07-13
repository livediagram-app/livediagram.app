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
