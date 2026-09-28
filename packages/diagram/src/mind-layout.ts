// Tidy mind-map layout (docs/specs/009-elements/mind-node.md "A tidy map stays tidy").
//
// Where every node of ONE map goes when the map is laid out in its flow: each
// parent centred on the block of its children, siblings stacked along the
// flow's axis with no gaps and no overlaps, the root left exactly where it is.
//
// Growth uses it twice: once to ask whether the map is still tidy (every node
// already where this would put it), and once more, with the new node in, to
// lay the map out around it. Tidy Map and a flow change use it directly.
//
// Pure geometry over the element list. Deterministic, and a FIXED POINT: laying
// out an already-laid-out map returns the same positions, which is what makes
// "is it tidy?" a meaningful question. That is why sibling order is read back
// from the positions as drawn (so the layout never reorders what it placed) and
// why every coordinate is rounded.

import {
  MIND_CHILD_GAP_X,
  MIND_CHILD_GAP_Y,
  MIND_SIBLING_GAP_Y,
  mindConnectorAnchors,
  type MindFlow,
} from './mind-flow';
import { isMindNode, mindChildren } from './mind-map';
import type { ArrowElement, Element, ElementId, ShapeElement } from './index';

/** How far a node may sit from its laid-out slot and still count as tidy.
 *  Rounding in the layout itself is the only drift a tidy map ever has. */
export const MIND_TIDY_TOLERANCE = 1;

/** Where a node that is not on the canvas yet slots into its siblings: right
 *  after `after` (Enter inserts the next line), else at the end (Tab). */
export type MindOrderHint = { id: ElementId; after?: ElementId };

export type MindPoint = { x: number; y: number };
/** Top-left position per node of the map, root included. */
export type MindLayout = Map<ElementId, MindPoint>;

const centre = (n: ShapeElement): MindPoint => ({ x: n.x + n.width / 2, y: n.y + n.height / 2 });
const TAU = Math.PI * 2;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;

// The map as a tree of nodes, children in their drawn order. Cycle-guarded
// like the rest of the mind-map walkers: `mindParentId` is stored data.
type Tree = Map<ElementId, ShapeElement[]>;

function buildTree(
  elements: Element[],
  root: ShapeElement,
  orderKey: (node: ShapeElement, parent: ShapeElement) => number,
  hint?: MindOrderHint,
): Tree {
  const tree: Tree = new Map();
  const seen = new Set<ElementId>([root.id]);
  const frontier = [root];
  while (frontier.length > 0) {
    const parent = frontier.shift()!;
    const kids = mindChildren(elements, parent.id).filter((k) => !seen.has(k.id));
    for (const k of kids) seen.add(k.id);
    // The hinted node has no meaningful position yet, so it is kept out of
    // the positional sort and inserted where the hint says.
    const hinted = hint ? kids.find((k) => k.id === hint.id) : undefined;
    const placed = kids
      .filter((k) => k !== hinted)
      .map((k, i) => ({ k, key: orderKey(k, parent), i }))
      // Stable on ties (document order), so nodes stacked on one spot still
      // come out in a deterministic order.
      .sort((a, b) => a.key - b.key || a.i - b.i)
      .map((e) => e.k);
    if (hinted) {
      const at = hint?.after ? placed.findIndex((k) => k.id === hint.after) : -1;
      placed.splice(at === -1 ? placed.length : at + 1, 0, hinted);
    }
    tree.set(parent.id, placed);
    frontier.push(...placed);
  }
  return tree;
}

const kidsOf = (tree: Tree, id: ElementId) => tree.get(id) ?? [];

// --- Tree, balanced, downward: stacked layouts ------------------------------

// The stacked flows are one layout with two parameters: which axis the levels
// run along (x for a tree, y for a downward map) and which way (a balanced
// map's left side runs backwards).
type Axis = 'x' | 'y';
const cross = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x');
const extent = (n: ShapeElement, axis: Axis) => (axis === 'x' ? n.width : n.height);

function stackLayout(
  tree: Tree,
  out: MindLayout,
  parent: ShapeElement,
  kids: readonly ShapeElement[],
  axis: Axis,
  dir: 1 | -1,
) {
  const across = cross(axis);
  const gap = axis === 'x' ? MIND_CHILD_GAP_X : MIND_CHILD_GAP_Y;
  // The room a whole subtree needs across the stacking axis: its own node, or
  // its children's blocks stacked, whichever is bigger.
  const span = (n: ShapeElement): number => {
    const k = kidsOf(tree, n.id);
    const block =
      k.reduce((s, c) => s + span(c), 0) + MIND_SIBLING_GAP_Y * Math.max(0, k.length - 1);
    return Math.max(extent(n, across), block);
  };
  const place = (p: ShapeElement, children: readonly ShapeElement[]) => {
    const at = out.get(p.id)!;
    const block =
      children.reduce((s, c) => s + span(c), 0) +
      MIND_SIBLING_GAP_Y * Math.max(0, children.length - 1);
    let cursor = at[across] + extent(p, across) / 2 - block / 2;
    for (const c of children) {
      const s = span(c);
      const main = dir === 1 ? at[axis] + extent(p, axis) + gap : at[axis] - gap - extent(c, axis);
      const side = cursor + s / 2 - extent(c, across) / 2;
      out.set(c.id, (axis === 'x' ? { x: main, y: side } : { x: side, y: main }) as MindPoint);
      cursor += s + MIND_SIBLING_GAP_Y;
    }
    for (const c of children) place(c, kidsOf(tree, c.id));
  };
  place(parent, kids);
}

// --- Bubble: radial wedges --------------------------------------------------

// The root's children share the full circle equally, and every deeper level
// splits its parent's wedge by leaf count, on rings around the ROOT that grow
// until the nodes on them clear each other. The
// circle is cut on the root's WEST side and runs clockwise, so a lone first
// branch points east, the way a tree would start.
const BUBBLE_SEAM = Math.PI;

function bubbleLayout(tree: Tree, out: MindLayout, root: ShapeElement) {
  const leaves = new Map<ElementId, number>();
  const count = (n: ShapeElement): number => {
    const k = kidsOf(tree, n.id);
    const v = k.length === 0 ? 1 : k.reduce((s, c) => s + count(c), 0);
    leaves.set(n.id, v);
    return v;
  };
  count(root);
  const byDepth: ShapeElement[][] = [];
  const walk = (n: ShapeElement, d: number) => {
    (byDepth[d] ??= []).push(n);
    for (const c of kidsOf(tree, n.id)) walk(c, d + 1);
  };
  walk(root, 0);
  // A box's worst-case reach from its centre in any direction, so a ring
  // clears the one inside it whichever way its nodes face.
  const footprint = (n: ShapeElement) => Math.max(n.width, n.height);
  const radius: number[] = [0];
  for (let d = 1; d < byDepth.length; d++) {
    const ring = byDepth[d]!;
    const inner = Math.max(...byDepth[d - 1]!.map(footprint));
    const outer = Math.max(...ring.map(footprint));
    const clear = radius[d - 1]! + inner / 2 + outer / 2 + MIND_CHILD_GAP_X;
    const around = ring.reduce((s, n) => s + footprint(n) + MIND_SIBLING_GAP_Y, 0) / TAU;
    radius.push(Math.max(clear, around));
  }
  const origin = centre(root);
  const place = (n: ShapeElement, start: number, share: number, depth: number) => {
    let a = start;
    const kids = kidsOf(tree, n.id);
    for (const c of kids) {
      // The root's branches share the circle EQUALLY: weighting them by leaf
      // count swung every other branch round the dial each time one of them
      // grew a leaf. Below the root, a wedge is split by leaves, so a busy
      // sub-branch gets the room it needs without moving its neighbours' parents.
      const s = depth === 0 ? share / kids.length : (share * leaves.get(c.id)!) / leaves.get(n.id)!;
      const mid = a + s / 2;
      const r = radius[depth + 1]!;
      out.set(c.id, {
        x: origin.x + Math.cos(mid) * r - c.width / 2,
        y: origin.y + Math.sin(mid) * r - c.height / 2,
      });
      place(c, a, s, depth + 1);
      a += s;
    }
  };
  place(root, BUBBLE_SEAM, TAU, 0);
}

// --- Public API ---------------------------------------------------------------

/**
 * The sibling-order key for `node` under `parent`, read from where it is drawn.
 * Stacked flows: along the stacking axis. Bubble: clockwise around the ROOT
 * from the seam opposite the parent's own direction, which is outside the
 * parent's wedge, so the order a layout produces reads back unchanged.
 */
function orderKeyFor(
  flow: MindFlow,
  root: ShapeElement,
): (node: ShapeElement, parent: ShapeElement) => number {
  if (flow === 'downward') return (n) => centre(n).x;
  if (flow !== 'bubble') return (n) => centre(n).y;
  const o = centre(root);
  const angle = (n: ShapeElement) => Math.atan2(centre(n).y - o.y, centre(n).x - o.x);
  return (n, parent) => {
    const towards = parent.id === root.id ? 0 : angle(parent);
    return wrap(angle(n) - (towards + BUBBLE_SEAM));
  };
}

/**
 * Lay out the map rooted at `rootId` in `flow`. The root stays put; every
 * other node of the map gets a rounded top-left position. Nodes that are not
 * part of the map are not in the result.
 *
 * Balanced sides are read from where branches are drawn, except when switching
 * TO a balanced map from another flow: then no branch has a side yet, and they
 * are dealt out to whichever side has less, in order.
 */
export function layoutMindTree(
  elements: Element[],
  rootId: ElementId,
  flow: MindFlow,
  hint?: MindOrderHint,
  // The flow the map is DRAWN in, which is what sibling order is read in.
  // Differs from `flow` only when switching flows: a tree's branches read top
  // to bottom, and that is the order the new arrangement should keep.
  orderFlow: MindFlow = flow,
): MindLayout {
  const out: MindLayout = new Map();
  const root = elements.find((el) => el.id === rootId);
  if (!root || !isMindNode(root)) return out;
  const tree = buildTree(elements, root, orderKeyFor(orderFlow, root), hint);
  out.set(root.id, { x: root.x, y: root.y });
  if (flow === 'bubble') bubbleLayout(tree, out, root);
  else if (flow === 'downward') stackLayout(tree, out, root, kidsOf(tree, root.id), 'y', 1);
  else if (flow === 'tree') stackLayout(tree, out, root, kidsOf(tree, root.id), 'x', 1);
  else {
    const { left, right } = balancedSides(tree, root, hint, orderFlow !== 'balanced');
    stackLayout(tree, out, root, right, 'x', 1);
    stackLayout(tree, out, root, left, 'x', -1);
  }
  for (const [id, p] of out) out.set(id, { x: Math.round(p.x), y: Math.round(p.y) });
  return out;
}

// A balanced map's two sides. A branch keeps the side it is drawn on; a new
// root child goes where there is less, or beside the sibling Enter was pressed
// on.
function balancedSides(
  tree: Tree,
  root: ShapeElement,
  hint: MindOrderHint | undefined,
  fresh: boolean,
): { left: ShapeElement[]; right: ShapeElement[] } {
  const kids = kidsOf(tree, root.id);
  const rootX = centre(root).x;
  // Less on the left, by total height, sends a branch left; a tie goes right,
  // which is where the very first branch always goes.
  const height = (side: ShapeElement[]) => side.reduce((s, n) => s + n.height, 0);
  const hinted = hint ? kids.find((k) => k.id === hint.id) : undefined;
  const left: ShapeElement[] = [];
  const right: ShapeElement[] = [];
  const dealt = new Set<ElementId>();
  for (const k of kids) {
    if (k === hinted) continue;
    const goLeft = fresh ? height(left) < height(right) : centre(k).x < rootX;
    (goLeft ? left : right).push(k);
    if (goLeft) dealt.add(k.id);
  }
  const isLeft = (n: ShapeElement) => dealt.has(n.id);
  if (hinted) {
    const after = kids.find((k) => k.id === hint?.after);
    const goLeft = after ? isLeft(after) : height(left) < height(right);
    const side = goLeft ? left : right;
    const at = after ? side.indexOf(after) + 1 : side.length;
    side.splice(at, 0, hinted);
  }
  return { left, right };
}

/** Whether every node of the map already sits where the layout puts it. */
export function isMindTreeTidy(elements: Element[], rootId: ElementId, flow: MindFlow): boolean {
  const layout = layoutMindTree(elements, rootId, flow);
  for (const [id, p] of layout) {
    const el = elements.find((e) => e.id === id);
    if (!el || !isMindNode(el)) return false;
    if (Math.abs(el.x - p.x) > MIND_TIDY_TOLERANCE || Math.abs(el.y - p.y) > MIND_TIDY_TOLERANCE)
      return false;
  }
  return true;
}

/**
 * Re-anchor every parent-child connector of the map by the flow's rule, given
 * where its nodes are (or are about to be). Returns only the arrows that
 * change, as whole replacements.
 */
export function reanchorMindConnectors(
  elements: Element[],
  nodeIds: ReadonlySet<ElementId>,
  flow: MindFlow,
  at: MindLayout,
): ArrowElement[] {
  const moved = (n: ShapeElement): ShapeElement => {
    const p = at.get(n.id);
    return p ? { ...n, ...p } : n;
  };
  const nodes = new Map<ElementId, ShapeElement>();
  for (const el of elements) if (isMindNode(el) && nodeIds.has(el.id)) nodes.set(el.id, moved(el));
  const out: ArrowElement[] = [];
  for (const el of elements) {
    if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    const a = nodes.get(el.from.elementId);
    const b = nodes.get(el.to.elementId);
    if (!a || !b) continue;
    // Either direction: the connector is the tree's edge whichever end the
    // person who drew it started from.
    const aIsParent = b.mindParentId === a.id;
    if (!aIsParent && a.mindParentId !== b.id) continue;
    const [pa, ca] = aIsParent
      ? mindConnectorAnchors(flow, a, b)
      : mindConnectorAnchors(flow, b, a);
    const [fromA, toA] = aIsParent ? [pa, ca] : [ca, pa];
    if (el.from.anchor === fromA && el.to.anchor === toA) continue;
    out.push({ ...el, from: { ...el.from, anchor: fromA }, to: { ...el.to, anchor: toA } });
  }
  return out;
}
