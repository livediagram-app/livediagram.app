import { describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape } from './factories';
import {
  MIND_CHILD_GAP_X,
  MIND_CHILD_GAP_Y,
  MIND_SIBLING_GAP_Y,
  MIND_FLOWS,
  type MindFlow,
} from './mind-flow';
import { isMindTreeTidy, layoutMindTree, reanchorMindConnectors } from './mind-layout';
import type { ArrowElement, Element, ShapeElement } from './index';

// docs/specs/009-elements/mind-node.md "A tidy map stays tidy".

const node = (
  id: string,
  parent?: string,
  at: { x?: number; y?: number; w?: number; h?: number } = {},
): ShapeElement => ({
  ...(createShape('mind-node', at.x ?? 0, at.y ?? 0) as ShapeElement),
  id,
  width: at.w ?? 200,
  height: at.h ?? 60,
  ...(parent ? { mindParentId: parent } : {}),
});

const apply = (els: Element[], layout: Map<string, { x: number; y: number }>): Element[] =>
  els.map((el) => (layout.has(el.id) ? { ...el, ...layout.get(el.id)! } : el));

const box = (els: Element[], id: string) => els.find((e) => e.id === id) as ShapeElement;
const cy = (n: ShapeElement) => n.y + n.height / 2;
const cx = (n: ShapeElement) => n.x + n.width / 2;

// A root with three children, the middle one carrying two grandchildren.
const map = (): Element[] => [
  node('r', undefined, { x: 100, y: 300 }),
  node('a', 'r'),
  node('b', 'r'),
  node('c', 'r'),
  node('b1', 'b'),
  node('b2', 'b'),
];

describe('layoutMindTree: tree flow', () => {
  const laid = () => apply(map(), layoutMindTree(map(), 'r', 'tree'));

  it('keeps the root where it is', () => {
    expect(box(laid(), 'r')).toMatchObject({ x: 100, y: 300 });
  });

  it('puts children one gap to the right of their parent', () => {
    const els = laid();
    for (const id of ['a', 'b', 'c']) expect(box(els, id).x).toBe(100 + 200 + MIND_CHILD_GAP_X);
    expect(box(els, 'b1').x).toBe(box(els, 'b').x + 200 + MIND_CHILD_GAP_X);
  });

  it('centres every parent on the block of its children', () => {
    const els = laid();
    expect(cy(box(els, 'r'))).toBe((cy(box(els, 'a')) + cy(box(els, 'c'))) / 2);
    expect(cy(box(els, 'b'))).toBe((cy(box(els, 'b1')) + cy(box(els, 'b2'))) / 2);
  });

  it('stacks sibling subtrees with exactly the sibling gap and no overlap', () => {
    const els = laid();
    const a = box(els, 'a');
    const b1 = box(els, 'b1');
    // a's subtree is just a; b's block starts at b1.
    expect(b1.y - (a.y + a.height)).toBe(MIND_SIBLING_GAP_Y);
  });

  it('is a fixed point, so a laid-out map reads as tidy', () => {
    const els = laid();
    expect(isMindTreeTidy(els, 'r', 'tree')).toBe(true);
    expect(apply(els, layoutMindTree(els, 'r', 'tree'))).toEqual(els);
  });

  it('reads sibling order from the drawing, not the document', () => {
    // c is drawn above a, so it stays above a.
    const els = map().map((el) => (el.id === 'c' ? { ...el, y: -500 } : el));
    const out = apply(els, layoutMindTree(els, 'r', 'tree'));
    expect(box(out, 'c').y).toBeLessThan(box(out, 'a').y);
  });

  it('inserts a hinted node right after the sibling it names', () => {
    const els = laid();
    const withNew = [...els, node('n', 'r')];
    const out = apply(withNew, layoutMindTree(withNew, 'r', 'tree', { id: 'n', after: 'a' }));
    const ys = ['a', 'n', 'b', 'c'].map((id) => box(out, id).y);
    expect([...ys].sort((p, q) => p - q)).toEqual(ys);
  });

  it('puts a hinted node with no `after` at the end', () => {
    const els = laid();
    const withNew = [...els, node('n', 'r')];
    const out = apply(withNew, layoutMindTree(withNew, 'r', 'tree', { id: 'n' }));
    expect(box(out, 'n').y).toBeGreaterThan(box(out, 'c').y);
  });
});

describe('layoutMindTree: other flows', () => {
  it('downward stacks levels vertically, siblings across', () => {
    const out = apply(map(), layoutMindTree(map(), 'r', 'downward'));
    expect(box(out, 'a').y).toBe(300 + 60 + MIND_CHILD_GAP_Y);
    expect(cx(box(out, 'r'))).toBe((cx(box(out, 'a')) + cx(box(out, 'c'))) / 2);
  });

  it('balanced keeps each branch on the side it is drawn on', () => {
    const els = map().map((el) =>
      el.id === 'c' ? { ...el, x: -600 } : el.id === 'r' ? el : { ...el, x: 600 },
    );
    const out = apply(els, layoutMindTree(els, 'r', 'balanced'));
    expect(box(out, 'c').x + 200).toBe(100 - MIND_CHILD_GAP_X);
    expect(box(out, 'a').x).toBe(100 + 200 + MIND_CHILD_GAP_X);
  });

  it('balanced deals branches out to both sides when switched to from a one-sided flow', () => {
    const tree = apply(map(), layoutMindTree(map(), 'r', 'tree'));
    const out = apply(tree, layoutMindTree(tree, 'r', 'balanced', undefined, 'tree'));
    const sides = ['a', 'b', 'c'].map((id) => cx(box(out, id)) < cx(box(out, 'r')));
    expect(sides).toContain(true);
    expect(sides).toContain(false);
  });

  it('bubble sends a lone first branch east', () => {
    const els: Element[] = [node('r', undefined, { x: 0, y: 0 }), node('a', 'r')];
    const out = apply(els, layoutMindTree(els, 'r', 'bubble'));
    expect(cy(box(out, 'a'))).toBe(cy(box(out, 'r')));
    expect(box(out, 'a').x).toBeGreaterThan(200);
  });

  it('bubble keeps every node clear of every other', () => {
    const out = apply(map(), layoutMindTree(map(), 'r', 'bubble'));
    const nodes = out as ShapeElement[];
    for (const p of nodes)
      for (const q of nodes) {
        if (p === q) continue;
        const clear =
          p.x + p.width <= q.x ||
          q.x + q.width <= p.x ||
          p.y + p.height <= q.y ||
          q.y + q.height <= p.y;
        expect(clear, `${p.id} overlaps ${q.id}`).toBe(true);
      }
  });

  it.each(MIND_FLOWS.map((f) => [f]))('%s is a fixed point', (flow: MindFlow) => {
    const once = apply(map(), layoutMindTree(map(), 'r', flow));
    expect(isMindTreeTidy(once, 'r', flow)).toBe(true);
  });
});

describe('isMindTreeTidy', () => {
  it('is false once a node has been dragged', () => {
    const laid = apply(map(), layoutMindTree(map(), 'r', 'tree'));
    const moved = laid.map((el) => (el.id === 'b1' ? { ...el, x: box(laid, 'b1').x + 40 } : el));
    expect(isMindTreeTidy(moved, 'r', 'tree')).toBe(false);
  });

  it('is true for a lone root', () => {
    expect(isMindTreeTidy([node('r')], 'r', 'tree')).toBe(true);
  });

  it('survives a cycle in the parent pointers', () => {
    const els: Element[] = [node('r'), node('a', 'b'), node('b', 'a')];
    expect(() => isMindTreeTidy(els, 'r', 'tree')).not.toThrow();
  });
});

describe('reanchorMindConnectors', () => {
  it('joins a tree child by east and west however far down it sits', () => {
    const parent = node('p', undefined, { x: 0, y: 0 });
    const child = node('c', 'p', { x: 300, y: 600 });
    const arrow = createPinnedArrow('p', 's', 'c', 'n') as ArrowElement;
    const out = reanchorMindConnectors(
      [parent, child, arrow],
      new Set(['p', 'c']),
      'tree',
      new Map(),
    );
    expect(out[0]).toMatchObject({ from: { anchor: 'e' }, to: { anchor: 'w' } });
  });

  it('leaves a connector that is already right alone', () => {
    const parent = node('p', undefined, { x: 0, y: 0 });
    const child = node('c', 'p', { x: 300, y: 0 });
    const arrow = createPinnedArrow('p', 'e', 'c', 'w') as ArrowElement;
    expect(
      reanchorMindConnectors([parent, child, arrow], new Set(['p', 'c']), 'tree', new Map()),
    ).toEqual([]);
  });

  it('handles a connector drawn child-to-parent', () => {
    const parent = node('p', undefined, { x: 0, y: 0 });
    const child = node('c', 'p', { x: 0, y: 300 });
    const arrow = createPinnedArrow('c', 'e', 'p', 'e') as ArrowElement;
    const out = reanchorMindConnectors(
      [parent, child, arrow],
      new Set(['p', 'c']),
      'downward',
      new Map(),
    );
    expect(out[0]).toMatchObject({ from: { anchor: 'n' }, to: { anchor: 's' } });
  });
});
