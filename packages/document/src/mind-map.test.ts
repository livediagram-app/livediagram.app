import { describe, expect, it } from 'vitest';
import { createShape } from './factories';
import { SHAPE_DEFAULT_SIZE } from './shape-factory';
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

// The size a new node is actually created at, so these tests keep exercising
// the real default rather than a number that was the default once.
const SIZE = SHAPE_DEFAULT_SIZE['mind-node'];

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
    const at = nextMindChildPosition([parent], parent, SIZE);
    expect(at.x).toBe(parent.x + parent.width + MIND_CHILD_GAP_X);
    expect(at.y).toBe(parent.y + parent.height / 2 - SIZE.height / 2);
  });

  it('stacks a second child below the first', () => {
    const first = node('c1', 334, 100, 'p');
    const at = nextMindChildPosition([parent, first], parent, SIZE);
    expect(at.y).toBe(first.y + first.height + MIND_SIBLING_GAP_Y);
  });

  it('gives way to a cousin in the same tree, which cannot be moved', () => {
    // Nodes of the growing tree are fixed, so when one of them already holds
    // the natural slot the NEW node is the one that drops. (A node from
    // another tree is moved instead: see makeRoom.)
    const root = node('root', 0, 0);
    const ours = { ...parent, mindParentId: 'root' };
    const cousin = node('x', parent.x + parent.width + MIND_CHILD_GAP_X, 100, 'root');
    const at = nextMindChildPosition([root, ours, cousin], ours, SIZE);
    expect(at.y).toBe(cousin.y + cousin.height + MIND_SIBLING_GAP_Y);
  });

  it('clears a GRANDCHILD that hangs below its own parent', () => {
    // The reason it measures the subtree and not just the direct children: a
    // branch that grew downward would otherwise get the next sibling dropped
    // on top of it.
    const child = node('c1', 334, 100, 'p');
    const deep = node('c1a', 560, 400, 'c1');
    const at = nextMindChildPosition([parent, child, deep], parent, SIZE);
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

  it('joins the END of the root stack rather than taking the next gap', () => {
    // Reported: a new root wedged between two trees left the one below with
    // nowhere to put its own siblings. A sibling appends to the end of the
    // relationship, and a root's siblings are the other roots.
    const first = node('r1', 10, 20);
    const second = node('r2', 10, first.y + first.height + MIND_SIBLING_GAP_Y);
    const { node: sib, shifts } = growMindSibling([first, second], first);
    expect(sib.y).toBe(second.y + second.height + MIND_SIBLING_GAP_Y);
    // Nothing needs to move to append at the bottom.
    expect(shifts).toEqual([]);
  });

  it('clears the CHILDREN of the trees it stacks under, not just their roots', () => {
    const first = node('r1', 0, 0);
    const second = node('r2', 0, 200);
    const deepChild = node('r2-c', 400, 400, 'r2');
    const { node: sib } = growMindSibling([first, second, deepChild], first);
    expect(sib.y).toBe(deepChild.y + deepChild.height + MIND_SIBLING_GAP_Y);
  });

  it('leaves a tree that is out of the way alone', () => {
    const root = node('r', 0, 0);
    const far = node('f', 4000, 0);
    const { node: sib, shifts } = growMindSibling([root, far], root);
    expect(sib.y).toBe(root.y + root.height + MIND_SIBLING_GAP_Y);
    expect(shifts).toEqual([]);
  });

  it('makes another root when the parent id points at nothing', () => {
    // A deleted parent leaves a dangling pointer; the child behaves as a root
    // rather than throwing or attaching to a ghost.
    const orphan = node('o', 0, 0, 'gone');
    expect(growMindSibling([orphan], orphan).arrow).toBeNull();
  });
});

describe('size inheritance', () => {
  // A node widened by a long label (or resized by hand) should hand that size
  // on, or a branch comes out as a row of mismatched boxes.
  const wide = (id: string, parent?: string): ShapeElement => ({
    ...node(id, 0, 0, parent),
    width: 260,
    height: 70,
  });

  it('a child takes its parent size', () => {
    const p = wide('p');
    const { node: child } = growMindChild([p], p);
    expect([child.width, child.height]).toEqual([260, 70]);
  });

  it('a sibling takes the size of the node you grew FROM, not the parent', () => {
    const p = node('p', 0, 0);
    const from = wide('c1', 'p');
    const { node: sib } = growMindSibling([p, from], from);
    expect([sib.width, sib.height]).toEqual([260, 70]);
  });

  it('a second root takes the first root size', () => {
    const root = wide('r');
    const { node: sib } = growMindSibling([root], root);
    expect([sib.width, sib.height]).toEqual([260, 70]);
  });
});

describe('making room', () => {
  // Reported: two children added to one root, and the second appeared at the
  // bottom of the map past a second root's branch, with its connector raking
  // back across everything. The expectation was the obvious one: the child
  // goes where it belongs and the tree in the way moves down.
  //
  // A root with one child already, so the NEXT child stacks down into the
  // space the neighbouring tree is parked in.
  const root = node('root', 0, 0);
  const firstChild = node('c1', root.width + MIND_CHILD_GAP_X, 0, 'root');
  const slotY = firstChild.y + firstChild.height + MIND_SIBLING_GAP_Y;
  const treeAt = (id: string, y: number) => [
    node(id, 0, y),
    node(`${id}-c`, root.width + MIND_CHILD_GAP_X, y, id),
  ];

  it('slides a whole neighbouring tree, parent and children together', () => {
    const other = treeAt('other', slotY + 20);
    const { node: child, shifts } = growMindChild([root, firstChild, ...other], root);
    expect(child.y).toBe(slotY);
    // Both members move by the same amount, so the branch stays intact.
    const dy = shifts[0]!.dy;
    expect(shifts).toEqual([
      { id: 'other', dy },
      { id: 'other-c', dy },
    ]);
    expect(other[0]!.y + dy).toBe(child.y + child.height + MIND_SIBLING_GAP_Y);
  });

  it('cascades the shove through a column of trees', () => {
    // Pushing the first tree onto the second is not "making room", it is
    // moving the pile-up one place down.
    const near = treeAt('near', slotY + 20);
    const far = treeAt('far', slotY + 20 + SIZE.height + MIND_SIBLING_GAP_Y);
    const { node: child, shifts } = growMindChild([root, firstChild, ...near, ...far], root);
    const moved = new Map(shifts.map((sh) => [sh.id, sh.dy]));
    expect([...moved.keys()].sort()).toEqual(['far', 'far-c', 'near', 'near-c']);
    const nearTop = near[0]!.y + moved.get('near')!;
    expect(nearTop).toBe(child.y + child.height + MIND_SIBLING_GAP_Y);
    expect(far[0]!.y + moved.get('far')!).toBe(nearTop + near[0]!.height + MIND_SIBLING_GAP_Y);
  });

  it('moves nothing when the new node has the space to itself', () => {
    expect(growMindChild([root], root).shifts).toEqual([]);
  });

  it('never moves the tree being grown', () => {
    const { shifts } = growMindChild([root, firstChild], root);
    expect(shifts).toEqual([]);
  });
});
