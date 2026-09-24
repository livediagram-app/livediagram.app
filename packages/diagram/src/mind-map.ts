// Mind-map growth (spec/118): where a new node goes, and what connects it.
//
// Pure geometry + tree walking, in the diagram package so the editor's
// keyboard handler and any future auto-arrange share one definition of
// "where does the next node go".

import { createPinnedArrow, createShape } from './factories';
import type { ArrowElement, Element, ElementId, ShapeElement } from './index';

/** Gap between a parent and its child, left to right. */
export const MIND_CHILD_GAP_X = 64;
/** Gap between stacked siblings, top to bottom. */
export const MIND_SIBLING_GAP_Y = 18;

export function isMindNode(el: Element): el is ShapeElement {
  return el.type === 'shape' && el.shape === 'mind-node';
}

/** The nodes whose `mindParentId` is `id`, in document order. */
export function mindChildren(elements: Element[], id: ElementId): ShapeElement[] {
  return elements.filter((el) => isMindNode(el) && el.mindParentId === id) as ShapeElement[];
}

/**
 * Every node under `id`, excluding `id` itself.
 *
 * Walks iteratively with a seen-set rather than recursing: `mindParentId` is
 * plain stored data, so a hand-edited or round-tripped file could contain a
 * cycle, and a recursive walk would blow the stack instead of drawing a
 * diagram.
 */
export function mindSubtree(elements: Element[], id: ElementId): ShapeElement[] {
  const out: ShapeElement[] = [];
  const seen = new Set<ElementId>([id]);
  let frontier = mindChildren(elements, id);
  while (frontier.length > 0) {
    const next: ShapeElement[] = [];
    for (const node of frontier) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      out.push(node);
      next.push(...mindChildren(elements, node.id));
    }
    frontier = next;
  }
  return out;
}

/** A node grown from another, plus what had to move to fit it in. */
export type MindGrowth = {
  node: ShapeElement;
  arrow: ArrowElement | null;
  /** Existing nodes to move, by id, so the new one has somewhere to sit. */
  shifts: MindShift[];
};

/** How far down one existing node moves to make room. */
export type MindShift = { id: ElementId; dy: number };

type Rect = { x: number; y: number; width: number; height: number };

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const boundsOf = (nodes: readonly ShapeElement[]): Rect => {
  const x = Math.min(...nodes.map((n) => n.x));
  const y = Math.min(...nodes.map((n) => n.y));
  return {
    x,
    y,
    width: Math.max(...nodes.map((n) => n.x + n.width)) - x,
    height: Math.max(...nodes.map((n) => n.y + n.height)) - y,
  };
};

/**
 * The topmost node of `node`'s own tree.
 *
 * Cycle-guarded for the same reason `mindSubtree` is: `mindParentId` is stored
 * data, and a dangling or looping pointer should still draw something.
 */
function mindRootOf(elements: Element[], node: ShapeElement): ShapeElement {
  const seen = new Set<ElementId>([node.id]);
  let current = node;
  for (;;) {
    const parent = current.mindParentId
      ? elements.find((el) => el.id === current.mindParentId && isMindNode(el))
      : undefined;
    if (!parent || !isMindNode(parent) || seen.has(parent.id)) return current;
    seen.add(parent.id);
    current = parent;
  }
}

/**
 * Move whatever is in the way DOWN, rather than sending the new node to the
 * bottom of the map.
 *
 * A second tree parked under the one you are growing owns the space the next
 * child wants. Dropping the child below everything keeps it clear but puts it
 * nowhere near its parent, with its connector raking across the map; what you
 * actually meant was "make room here". So the new node keeps its natural slot
 * and every OTHER tree it collides with slides down, as a whole tree, so no
 * branch is torn away from its own parent.
 *
 * Trees are handled top-down and each displaced tree becomes an obstacle
 * itself, so a shove cascades through a column of trees instead of stacking
 * them on each other.
 */
function mindTrees(elements: Element[], skip?: Set<ElementId>): Tree[] {
  const grouped = new Map<ElementId, ShapeElement[]>();
  for (const el of elements) {
    if (!isMindNode(el) || skip?.has(el.id)) continue;
    const root = mindRootOf(elements, el).id;
    const group = grouped.get(root);
    if (group) group.push(el);
    else grouped.set(root, [el]);
  }
  return [...grouped.values()]
    .map((nodes) => ({ nodes, bounds: boundsOf(nodes) }))
    .sort((a, b) => a.bounds.y - b.bounds.y);
}

type Tree = { nodes: ShapeElement[]; bounds: Rect };

function makeRoom(elements: Element[], fixed: Set<ElementId>, room: Rect): MindShift[] {
  const ordered = mindTrees(elements, fixed);
  const shifts: MindShift[] = [];
  const obstacles: Rect[] = [room];
  for (const tree of ordered) {
    let dy = 0;
    for (const obstacle of obstacles) {
      if (!overlaps(obstacle, { ...tree.bounds, y: tree.bounds.y + dy })) continue;
      dy = obstacle.y + obstacle.height + MIND_SIBLING_GAP_Y - tree.bounds.y;
    }
    if (dy <= 0) continue;
    for (const n of tree.nodes) shifts.push({ id: n.id, dy });
    obstacles.push({ ...tree.bounds, y: tree.bounds.y + dy });
  }
  return shifts;
}

/**
 * Push a candidate box down past the nodes that CANNOT move.
 *
 * Its own tree stays put (moving the branch you are growing from would be
 * absurd), so when a cousin branch already holds the natural slot the new node
 * is the one that gives way. Everything else is handled by `makeRoom`.
 */
function clearOfFixedNodes(
  elements: Element[],
  fixed: Set<ElementId>,
  at: { x: number; y: number },
  size: { width: number; height: number },
): { x: number; y: number } {
  const blockers = elements.filter((el) => isMindNode(el) && fixed.has(el.id)) as ShapeElement[];
  let { y } = at;
  // Each pass drops past at least one node, so the count bounds the loop; the
  // cap is belt and braces against duplicates stacked at one spot.
  for (let pass = 0; pass <= blockers.length; pass++) {
    let moved = false;
    for (const n of blockers) {
      if (!overlaps({ ...size, x: at.x, y }, n)) continue;
      y = n.y + n.height + MIND_SIBLING_GAP_Y;
      moved = true;
    }
    if (!moved) break;
  }
  return { x: at.x, y };
}

/**
 * Where a new child of `parent` should sit.
 *
 * Stacks against the bottom of the parent's whole SUBTREE, not just its
 * immediate children: a branch that has already grown down past its own
 * parent would otherwise have the next sibling land on top of a grandchild.
 */
export function nextMindChildPosition(
  elements: Element[],
  parent: ShapeElement,
  size: { width: number; height: number },
): { x: number; y: number } {
  const x = parent.x + parent.width + MIND_CHILD_GAP_X;
  const subtree = mindSubtree(elements, parent.id);
  // First child: centred on the parent, which is what makes a lone branch look
  // deliberate rather than dropped. Later ones stack against the bottom of the
  // whole subtree, not just the immediate children, so a branch that has grown
  // down past its own parent doesn't drop the next sibling on a grandchild.
  const y =
    subtree.length === 0
      ? parent.y + parent.height / 2 - size.height / 2
      : Math.max(...subtree.map((n) => n.y + n.height)) + MIND_SIBLING_GAP_Y;
  return clearOfFixedNodes(elements, treeIds(elements, parent), { x, y }, size);
}

/** Every node of `node`'s tree, the ones a growth may not move. */
function treeIds(elements: Element[], node: ShapeElement): Set<ElementId> {
  const root = mindRootOf(elements, node);
  return new Set([root.id, ...mindSubtree(elements, root.id).map((n) => n.id)]);
}

/**
 * Build a node attached to `parent`, plus the arrow that connects them.
 *
 * The connector is an ordinary pinned arrow: the tree is the arrows you can
 * already see plus a pointer saying which node owns which, not a second graph
 * model that could drift from what is drawn.
 */
export function growMindChild(
  elements: Element[],
  parent: ShapeElement,
  // The node the user grew FROM, when that isn't the parent — pressing Enter
  // on a child makes a sibling, and the size should match the sibling you were
  // standing on, not its parent.
  sizeFrom: ShapeElement = parent,
): MindGrowth & { arrow: ArrowElement } {
  const base = createShape('mind-node', 0, 0) as ShapeElement;
  // Inherit the source node's size. Resizing one node (or letting a long
  // label widen it) and then growing from it otherwise produced a branch of
  // mismatched boxes, which reads as a mistake rather than a hierarchy.
  const size = { width: sizeFrom.width, height: sizeFrom.height };
  const at = nextMindChildPosition(elements, parent, size);
  const node: ShapeElement = { ...base, ...size, x: at.x, y: at.y, mindParentId: parent.id };
  // East to west: the arrow always leaves the parent's right edge and enters
  // the child's left, so a branch reads as one continuous run regardless of
  // how far the child has been stacked down.
  return {
    node,
    arrow: createPinnedArrow(parent.id, 'e', node.id, 'w'),
    shifts: makeRoom(elements, treeIds(elements, parent), { ...size, ...at }),
  };
}

/**
 * Build a sibling of `node` — i.e. another child of its parent.
 *
 * A root has no parent to attach to, so `Enter` on one makes another ROOT,
 * offset below. Returning no arrow is the signal for that.
 */
export function growMindSibling(elements: Element[], node: ShapeElement): MindGrowth {
  const parent = node.mindParentId
    ? elements.find((el) => el.id === node.mindParentId && isMindNode(el))
    : undefined;
  if (parent && isMindNode(parent)) return growMindChild(elements, parent, node);
  const base = createShape('mind-node', 0, 0) as ShapeElement;
  const size = { width: node.width, height: node.height };
  // A new root joins the END of the root stack, not the gap directly under
  // the node you pressed Enter on: taking that gap wedges it between two
  // trees and leaves the one below with nowhere to put its own siblings. A
  // child appends to its parent's list, and a root is no different, so it
  // clears every tree sharing this column (a map parked well off to the side
  // is a separate map and stays out of the sum).
  const right = node.x + size.width;
  const bottom = Math.max(
    ...mindTrees(elements)
      .filter((t) => t.bounds.x < right && t.bounds.x + t.bounds.width > node.x)
      .map((t) => t.bounds.y + t.bounds.height),
    node.y + node.height,
  );
  return {
    node: { ...base, ...size, x: node.x, y: bottom + MIND_SIBLING_GAP_Y },
    arrow: null,
    shifts: [],
  };
}
