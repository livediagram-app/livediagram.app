import { describe, expect, it } from 'vitest';
import { createShape } from './factories';
import type { Element, ShapeElement } from './index';
import {
  growMindChild,
  growMindSibling,
  MIND_CHILD_GAP_X,
  MIND_SIBLING_GAP_Y,
  mindChildren,
  mindSubtree,
  nextMindChildPosition,
} from './mind-map';

const node = (id: string, x: number, y: number, parent?: string): ShapeElement => ({
  ...(createShape('mind-node', x, y) as ShapeElement),
  id,
  ...(parent ? { mindParentId: parent } : {}),
});

describe('mindChildren', () => {
  it('finds only the direct children', () => {
    const els: Element[] = [node('root', 0, 0), node('a', 0, 0, 'root'), node('b', 0, 0, 'a')];
    expect(mindChildren(els, 'root').map((n) => n.id)).toEqual(['a']);
  });

  it('ignores non-mind elements that happen to carry the id', () => {
    const square = { ...(createShape('square', 0, 0) as ShapeElement), id: 's', mindParentId: 'r' };
    expect(mindChildren([node('r', 0, 0), square], 'r')).toEqual([]);
  });
});

describe('mindSubtree', () => {
  it('walks the whole tree, excluding the root itself', () => {
    const els: Element[] = [
      node('root', 0, 0),
      node('a', 0, 0, 'root'),
      node('b', 0, 0, 'root'),
      node('a1', 0, 0, 'a'),
      node('a1x', 0, 0, 'a1'),
    ];
    expect(
      mindSubtree(els, 'root')
        .map((n) => n.id)
        .sort(),
    ).toEqual(['a', 'a1', 'a1x', 'b']);
  });

  it('terminates on a cycle instead of recursing forever', () => {
    // mindParentId is stored data, so a round-tripped or hand-edited file can
    // contain one. Drawing something is better than blowing the stack.
    const els: Element[] = [node('a', 0, 0, 'b'), node('b', 0, 0, 'a')];
    expect(mindSubtree(els, 'a').map((n) => n.id)).toEqual(['b']);
  });
});

describe('nextMindChildPosition', () => {
  const parent = node('p', 100, 100);

  it('puts a first child to the right, vertically centred on the parent', () => {
    const at = nextMindChildPosition([parent], parent, { width: 170, height: 48 });
    expect(at.x).toBe(parent.x + parent.width + MIND_CHILD_GAP_X);
    expect(at.y).toBe(parent.y + parent.height / 2 - 24);
  });

  it('stacks a second child below the first', () => {
    const first = node('c1', 334, 100, 'p');
    const at = nextMindChildPosition([parent, first], parent, { width: 170, height: 48 });
    expect(at.y).toBe(first.y + first.height + MIND_SIBLING_GAP_Y);
  });

  it('clears a GRANDCHILD that hangs below its own parent', () => {
    // The reason it measures the subtree and not just the direct children: a
    // branch that grew downward would otherwise get the next sibling dropped
    // on top of it.
    const child = node('c1', 334, 100, 'p');
    const deep = node('c1a', 560, 400, 'c1');
    const at = nextMindChildPosition([parent, child, deep], parent, { width: 170, height: 48 });
    expect(at.y).toBe(deep.y + deep.height + MIND_SIBLING_GAP_Y);
  });
});

describe('growMindChild', () => {
  it('parents the node and connects it east to west', () => {
    const parent = node('p', 0, 0);
    const { node: child, arrow } = growMindChild([parent], parent);
    expect(child.shape).toBe('mind-node');
    expect(child.mindParentId).toBe('p');
    expect(arrow.from).toEqual({ kind: 'pinned', elementId: 'p', anchor: 'e' });
    expect(arrow.to).toEqual({ kind: 'pinned', elementId: child.id, anchor: 'w' });
  });
});

describe('growMindSibling', () => {
  it('makes another child of the same parent', () => {
    const parent = node('p', 0, 0);
    const first = node('c1', 234, 0, 'p');
    const { node: sib, arrow } = growMindSibling([parent, first], first);
    expect(sib.mindParentId).toBe('p');
    expect(arrow?.from).toEqual({ kind: 'pinned', elementId: 'p', anchor: 'e' });
  });

  it('makes another ROOT when the node has no parent', () => {
    // A root has nothing to attach to, so Enter starts a second tree rather
    // than silently doing nothing.
    const root = node('r', 10, 20);
    const { node: sib, arrow } = growMindSibling([root], root);
    expect(sib.mindParentId).toBeUndefined();
    expect(arrow).toBeNull();
    expect(sib.y).toBe(root.y + root.height + MIND_SIBLING_GAP_Y);
  });

  it('makes another root when the parent id points at nothing', () => {
    // A deleted parent leaves a dangling pointer; the child behaves as a root
    // rather than throwing or attaching to a ghost.
    const orphan = node('o', 0, 0, 'gone');
    expect(growMindSibling([orphan], orphan).arrow).toBeNull();
  });
});
