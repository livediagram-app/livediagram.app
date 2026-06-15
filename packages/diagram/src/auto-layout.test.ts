import { describe, it, expect } from 'vitest';
import { autoLayoutElements, isLayoutCandidate } from './auto-layout';
import { createShape, createPinnedArrow } from './factories';
import type { ArrowElement, BoxedElement, Element, ShapeElement } from './index';

// Build a shape with an explicit id + messy size so we can prove normalisation.
function shape(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  kind = 'square',
): ShapeElement {
  return { ...createShape(kind as ShapeElement['shape'], x, y), id, width: w, height: h };
}
function arrow(from: string, to: string): ArrowElement {
  return { ...createPinnedArrow(from, 'e', to, 'w'), id: `arr-${from}-${to}` };
}
function box(el: Element): BoxedElement {
  return el as BoxedElement;
}

describe('isLayoutCandidate', () => {
  it('is true for ≥3 connected nodes', () => {
    const els = [
      shape('a', 0, 0, 140, 60),
      shape('b', 0, 0, 140, 60),
      shape('c', 0, 0, 140, 60),
      arrow('a', 'b'),
      arrow('b', 'c'),
    ];
    expect(isLayoutCandidate(els)).toBe(true);
  });
  it('is false for a small additive edit (2 nodes)', () => {
    expect(
      isLayoutCandidate([shape('a', 0, 0, 140, 60), shape('b', 0, 0, 140, 60), arrow('a', 'b')]),
    ).toBe(false);
  });
  it('is false when there are no connecting arrows', () => {
    expect(
      isLayoutCandidate([
        shape('a', 0, 0, 140, 60),
        shape('b', 0, 0, 140, 60),
        shape('c', 0, 0, 140, 60),
      ]),
    ).toBe(false);
  });
});

describe('autoLayoutElements', () => {
  it('normalises peers in a tier to one uniform size', () => {
    // Three square/md peers at mismatched sizes → all become the tier max.
    const els = [
      shape('a', 0, 0, 140, 60),
      shape('b', 500, 0, 220, 90),
      shape('c', 0, 400, 120, 50),
      arrow('a', 'b'),
      arrow('a', 'c'),
    ];
    const out = autoLayoutElements(els);
    const boxes = out.filter((e) => e.type === 'shape').map(box);
    const widths = new Set(boxes.map((b) => b.width));
    const heights = new Set(boxes.map((b) => b.height));
    expect(widths.size).toBe(1);
    expect(heights.size).toBe(1);
    expect([...widths][0]).toBe(220); // tier max width, rounded to 10
    expect([...heights][0]).toBe(90);
  });

  it('lays a vertical chain out in stacked, non-overlapping ranks', () => {
    // a→b→c with the model trending vertical → TB ranks.
    const els = [
      shape('a', 0, 0, 140, 60),
      shape('b', 0, 200, 140, 60),
      shape('c', 0, 400, 140, 60),
      arrow('a', 'b'),
      arrow('b', 'c'),
    ];
    const out = autoLayoutElements(els, { originX: 0, originY: 0 });
    const a = box(out.find((e) => e.id === 'a')!);
    const b = box(out.find((e) => e.id === 'b')!);
    const c = box(out.find((e) => e.id === 'c')!);
    // Each successive rank sits strictly below the previous, with a gap.
    expect(b.y).toBeGreaterThan(a.y + a.height);
    expect(c.y).toBeGreaterThan(b.y + b.height);
    // Single chain stays vertically aligned (same x).
    expect(a.x).toBe(b.x);
    expect(b.x).toBe(c.x);
  });

  it('re-anchors arrows to face the flow (s→n down a TB chain)', () => {
    const els = [
      shape('a', 0, 0, 140, 60),
      shape('b', 0, 200, 140, 60),
      shape('c', 0, 400, 140, 60),
      arrow('a', 'b'),
      arrow('b', 'c'),
    ];
    const out = autoLayoutElements(els);
    const ab = out.find((e) => e.id === 'arr-a-b') as ArrowElement;
    expect(ab.from).toMatchObject({ kind: 'pinned', anchor: 's' });
    expect(ab.to).toMatchObject({ kind: 'pinned', anchor: 'n' });
    expect(ab.arrowStyle).toBe('straight');
  });

  it('honours the requested origin (top-left of the block)', () => {
    const els = [
      shape('a', 999, 999, 140, 60),
      shape('b', 999, 999, 140, 60),
      shape('c', 999, 999, 140, 60),
      arrow('a', 'b'),
      arrow('b', 'c'),
    ];
    const out = autoLayoutElements(els, { originX: 50, originY: 80 });
    const boxes = out.filter(isBoxedLike);
    expect(Math.min(...boxes.map((b) => b.x))).toBe(50);
    expect(Math.min(...boxes.map((b) => b.y))).toBe(80);
  });

  it('places a sideways tree LR when the model trends horizontal', () => {
    const els = [
      shape('a', 0, 0, 140, 60),
      shape('b', 300, 0, 140, 60),
      shape('c', 600, 0, 140, 60),
      arrow('a', 'b'),
      arrow('b', 'c'),
    ];
    const out = autoLayoutElements(els);
    const a = box(out.find((e) => e.id === 'a')!);
    const c = box(out.find((e) => e.id === 'c')!);
    // LR: c ends up to the right of a.
    expect(c.x).toBeGreaterThan(a.x + a.width);
    expect(a.y).toBe(c.y); // single chain shares the cross axis
  });

  it('squares circle/diamond shapes', () => {
    const els = [
      shape('a', 0, 0, 200, 60, 'circle'),
      shape('b', 0, 0, 140, 60, 'circle'),
      shape('c', 0, 0, 140, 60, 'circle'),
      arrow('a', 'b'),
      arrow('b', 'c'),
    ];
    const out = autoLayoutElements(els);
    for (const e of out.filter((x) => x.type === 'shape').map(box)) {
      expect(e.width).toBe(e.height);
    }
  });
});

function isBoxedLike(e: Element): e is BoxedElement {
  return e.type !== 'arrow';
}
