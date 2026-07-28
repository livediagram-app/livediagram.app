import { describe, expect, it } from 'vitest';
import { ROUTE_BEHIND_MARGIN, arrowRoutesBehind, routeBehindHoles } from './arrow-behind';
import type { ArrowElement, Element, ShapeElement } from './index';

const M = ROUTE_BEHIND_MARGIN;

const box = (id: string, x: number, y: number, over: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 100,
  height: 100,
  ...over,
});

// A long horizontal arrow from (0,50) to (600,50), free at both ends
// unless a test pins it.
const arrow = (over: Partial<ArrowElement> = {}): ArrowElement => ({
  id: 'a1',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 50 },
  to: { kind: 'free', x: 600, y: 50 },
  ...over,
});

const from = { x: 0, y: 50 };
const to = { x: 600, y: 50 };

describe('arrowRoutesBehind', () => {
  it('is on unless explicitly turned off — absent means the default', () => {
    expect(arrowRoutesBehind(arrow())).toBe(true);
    expect(arrowRoutesBehind(arrow({ routeBehind: true }))).toBe(true);
    expect(arrowRoutesBehind(arrow({ routeBehind: false }))).toBe(false);
  });
});

describe('routeBehindHoles', () => {
  it('punches a margin-inflated hole for a box in the way', () => {
    const holes = routeBehindHoles(arrow(), from, to, [box('b', 200, 0)]);
    expect(holes).toEqual([{ x: 200 - M, y: 0 - M, width: 100 + 2 * M, height: 100 + 2 * M }]);
  });

  it('returns nothing when the arrow has opted out', () => {
    const holes = routeBehindHoles(arrow({ routeBehind: false }), from, to, [box('b', 200, 0)]);
    expect(holes).toEqual([]);
  });

  it('cuts every box in the way, not just the first', () => {
    const holes = routeBehindHoles(arrow(), from, to, [
      box('b1', 150, 0),
      box('b2', 320, 0),
      box('b3', 470, 0),
    ]);
    expect(holes).toHaveLength(3);
  });

  it('never cuts the elements the arrow connects', () => {
    // The line has to reach their edges, and the arrowhead sits on one.
    const pinned = arrow({
      from: { kind: 'pinned', elementId: 'src', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'dst', anchor: 'w' },
    });
    const holes = routeBehindHoles(pinned, from, to, [
      box('src', 0, 0),
      box('dst', 500, 0),
      box('mid', 250, 0),
    ]);
    expect(holes).toHaveLength(1);
    expect(holes[0]!.x).toBe(250 - M);
  });

  it('never cuts a box that CONTAINS an endpoint', () => {
    // An arrow drawn out of an overlapping element: cutting its container
    // would erase the line at its own start.
    const holes = routeBehindHoles(arrow(), from, to, [box('wrap', -50, -50, { width: 200 })]);
    expect(holes).toEqual([]);
  });

  it('never cuts a box the arrow merely stops SHORT of — that would eat the arrowhead', () => {
    // The endpoint sits in the margin ring rather than inside the box: an
    // unpinned arrow ending a few units shy of it. The arrowhead lives at
    // that endpoint, so punching the hole erased the head and left the
    // line running into nothing.
    const nearTo = box('target', to.x + 4, 0);
    expect(routeBehindHoles(arrow(), from, to, [nearTo])).toEqual([]);
    // Same at the tail end.
    const nearFrom = box('src', from.x - 100 - 4, 0);
    expect(routeBehindHoles(arrow(), from, to, [nearFrom])).toEqual([]);
    // But a box a clear distance past the endpoint is still fair game
    // (it just won't intersect the arrow's bounds, so no hole either).
    const wellPast = box('far', to.x + 5 * ROUTE_BEHIND_MARGIN, 0);
    expect(routeBehindHoles(arrow(), from, to, [wellPast])).toEqual([]);
  });

  it('ignores frames — a section backdrop must never break the arrows inside it', () => {
    const holes = routeBehindHoles(arrow(), from, to, [
      box('section', -100, -100, { shape: 'frame', width: 800, height: 400 }),
    ]);
    expect(holes).toEqual([]);
  });

  it('ignores text and annotations, which have no fill to hide behind', () => {
    const text: Element = {
      id: 't',
      type: 'text',
      x: 200,
      y: 0,
      width: 80,
      height: 30,
      label: 'x',
    };
    const note: Element = { id: 'n', type: 'annotation', x: 300, y: 0, width: 44, height: 44 };
    expect(routeBehindHoles(arrow(), from, to, [text, note])).toEqual([]);
  });

  it('cuts stickies, images and tables — they are opaque boxes', () => {
    const sticky: Element = { id: 's', type: 'sticky', x: 150, y: 0, width: 80, height: 80 };
    const image: Element = {
      id: 'i',
      type: 'image',
      x: 300,
      y: 0,
      width: 80,
      height: 80,
      imageId: null,
    };
    expect(routeBehindHoles(arrow(), from, to, [sticky, image])).toHaveLength(2);
  });

  it('ignores boxes nowhere near the arrow', () => {
    const holes = routeBehindHoles(arrow(), from, to, [box('far', 200, 900)]);
    expect(holes).toEqual([]);
  });

  it('ignores arrows and freehand — neither is a box', () => {
    const other: Element = {
      id: 'a2',
      type: 'arrow',
      from: { kind: 'free', x: 100, y: 0 },
      to: { kind: 'free', x: 200, y: 100 },
    };
    expect(routeBehindHoles(arrow(), from, to, [other])).toEqual([]);
  });
});
