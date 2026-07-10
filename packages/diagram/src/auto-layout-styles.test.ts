import { describe, it, expect } from 'vitest';
import { autoLayoutElements } from './auto-layout';
import { createShape, createPinnedArrow } from './factories';
import type { ArrowElement, BoxedElement, Element, ShapeElement } from './index';

// Same fixtures as auto-layout.test.ts: explicit ids + messy geometry so the
// styles prove they recompute everything.
function shape(id: string, x: number, y: number, w = 140, h = 60): ShapeElement {
  return { ...createShape('square', x, y), id, width: w, height: h };
}
function arrow(from: string, to: string): ArrowElement {
  return { ...createPinnedArrow(from, 'e', to, 'w'), id: `arr-${from}-${to}` };
}
function find(out: Element[], id: string): BoxedElement {
  return out.find((e) => e.id === id) as BoxedElement;
}
const centerOf = (b: BoxedElement) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

describe('forced flow direction', () => {
  it('lays a horizontal-trending chain TB when direction is forced', () => {
    // Without the option this chain auto-detects LR (see auto-layout.test.ts).
    const els = [
      shape('a', 0, 0),
      shape('b', 300, 0),
      shape('c', 600, 0),
      arrow('a', 'b'),
      arrow('b', 'c'),
    ];
    const out = autoLayoutElements(els, { style: 'flow', direction: 'TB' });
    const [a, b, c] = [find(out, 'a'), find(out, 'b'), find(out, 'c')];
    expect(b.y).toBeGreaterThan(a.y + a.height);
    expect(c.y).toBeGreaterThan(b.y + b.height);
    expect(a.x).toBe(c.x);
  });
});

describe('tree style', () => {
  const org = () => [
    shape('root', 0, 0),
    shape('l', 0, 200),
    shape('r', 300, 200),
    shape('l1', 0, 400),
    shape('l2', 150, 400),
    shape('l3', 300, 400),
    arrow('root', 'l'),
    arrow('root', 'r'),
    arrow('l', 'l1'),
    arrow('l', 'l2'),
    arrow('l', 'l3'),
  ];

  it('centres every parent over its own subtree', () => {
    const out = autoLayoutElements(org(), { style: 'tree' });
    // l has three children; l must sit at the midpoint of ITS children's
    // span (the property the layered flow layout does not guarantee).
    const kids = ['l1', 'l2', 'l3'].map((id) => find(out, id));
    const span =
      (Math.min(...kids.map((k) => k.x)) + Math.max(...kids.map((k) => k.x + k.width))) / 2;
    expect(centerOf(find(out, 'l')).x).toBeCloseTo(span, 5);
    // And the root over the two branches.
    const branches = ['l', 'r'].map((id) => find(out, id));
    const rootSpan =
      (Math.min(...branches.map((k) => k.x)) + Math.max(...branches.map((k) => k.x + k.width))) / 2;
    expect(centerOf(find(out, 'root')).x).toBeCloseTo(rootSpan, 5);
  });

  it('stacks depths top-to-bottom without overlap', () => {
    const out = autoLayoutElements(org(), { style: 'tree' });
    expect(find(out, 'l').y).toBeGreaterThan(find(out, 'root').y + find(out, 'root').height);
    expect(find(out, 'l1').y).toBeGreaterThan(find(out, 'l').y + find(out, 'l').height);
    // Siblings share a row and don't overlap horizontally.
    const [l1, l2] = [find(out, 'l1'), find(out, 'l2')];
    expect(l1.y).toBe(l2.y);
    expect(l2.x).toBeGreaterThan(l1.x + l1.width);
  });

  it('degrades gracefully on a non-tree graph (extra cross edge)', () => {
    const els = [...org(), arrow('r', 'l3')]; // l3 now has two parents
    const out = autoLayoutElements(els, { style: 'tree' });
    // Still a valid placement: every node has finite coords and no NaNs.
    for (const id of ['root', 'l', 'r', 'l1', 'l2', 'l3']) {
      const n = find(out, id);
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });
});

describe('mindmap style', () => {
  const map = () => [
    shape('hub', 0, 0),
    shape('n', 0, -200),
    shape('e', 200, 0),
    shape('s', 0, 200),
    shape('w', -200, 0),
    arrow('hub', 'n'),
    arrow('hub', 'e'),
    arrow('hub', 's'),
    arrow('hub', 'w'),
  ];

  it('puts the highest-degree node at the centre with branches equidistant', () => {
    const out = autoLayoutElements(map(), { style: 'mindmap' });
    const hub = centerOf(find(out, 'hub'));
    const dists = ['n', 'e', 's', 'w'].map((id) => {
      const c = centerOf(find(out, id));
      return Math.hypot(c.x - hub.x, c.y - hub.y);
    });
    // All first-ring branches sit on one ring around the hub.
    for (const d of dists) expect(d).toBeCloseTo(dists[0]!, 5);
    expect(dists[0]!).toBeGreaterThan(0);
    // The hub is strictly inside the branch bounding box (centre, not a rank).
    const xs = ['n', 'e', 's', 'w'].map((id) => centerOf(find(out, id)).x);
    const ys = ['n', 'e', 's', 'w'].map((id) => centerOf(find(out, id)).y);
    expect(hub.x).toBeGreaterThan(Math.min(...xs));
    expect(hub.x).toBeLessThan(Math.max(...xs));
    expect(hub.y).toBeGreaterThan(Math.min(...ys));
    expect(hub.y).toBeLessThan(Math.max(...ys));
  });

  it('places grandchildren on a wider ring than children', () => {
    const els = [...map(), shape('n1', 0, -400), arrow('n', 'n1')];
    const out = autoLayoutElements(els, { style: 'mindmap' });
    const hub = centerOf(find(out, 'hub'));
    const n = centerOf(find(out, 'n'));
    const n1 = centerOf(find(out, 'n1'));
    const r1 = Math.hypot(n.x - hub.x, n.y - hub.y);
    const r2 = Math.hypot(n1.x - hub.x, n1.y - hub.y);
    expect(r2).toBeGreaterThan(r1);
  });

  it('keeps a crowded ring collision-free', () => {
    // 12 branches off one hub: the ring must grow so none of the uniform
    // 140x60 nodes overlap.
    const branches = Array.from({ length: 12 }, (_, i) => `b${i}`);
    const els: Element[] = [
      shape('hub', 0, 0),
      ...branches.map((id, i) => shape(id, Math.cos(i) * 50, Math.sin(i) * 50)),
      ...branches.map((id) => arrow('hub', id)),
    ];
    const out = autoLayoutElements(els, { style: 'mindmap' });
    const boxes = branches.map((id) => find(out, id));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlap =
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height;
        expect(overlap).toBe(false);
      }
    }
  });

  it('is deterministic', () => {
    const a = autoLayoutElements(map(), { style: 'mindmap' });
    const b = autoLayoutElements(map(), { style: 'mindmap' });
    expect(a).toEqual(b);
  });
});
