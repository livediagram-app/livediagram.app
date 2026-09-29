// Growing and re-laying out a mind map (docs/specs/009-elements/mind-node.md).
//
// The one entry point the editor calls for Tab / Enter / the "+" actions, and
// the one it calls for Tidy Map and a flow change. It decides between the two
// placements the spec describes: a map that is still exactly as the tidy
// layout left it is re-laid out around the new node; a map someone has
// arranged by hand gets the new node placed where it fits, with nothing of
// theirs moved.
//
// Everything is returned as a plan (the new node, its connector, what moves,
// which connectors re-anchor) rather than applied, so the editor can land it
// in ONE commit, against the elements as they stand in that commit.

import { createPinnedArrow, createShape } from './factories';
import { SHAPE_DEFAULT_SIZE } from './shape-factory';
import { mindConnectorAnchors, type MindFlow } from './mind-flow';
import {
  growMindSibling,
  isMindNode,
  makeRoom,
  mindChildren,
  mindFlowOf,
  mindRootOf,
  mindSubtree,
  nextMindChildPosition,
  treeIds,
  type MindShift,
} from './mind-map';
import {
  isMindTreeTidy,
  layoutMindTree,
  reanchorMindConnectors,
  type MindLayout,
} from './mind-layout';
import type { ArrowElement, Element, ElementId, ShapeElement } from './index';

/** An existing node's new top-left. */
export type MindMove = { id: ElementId; x: number; y: number };

export type MindGrowthPlan = {
  node: ShapeElement;
  /** Null for a new ROOT (Enter on a root): there is no parent to join. */
  arrow: ArrowElement | null;
  moves: MindMove[];
  /** Existing connectors whose faces change, as whole replacements. */
  reanchored: ArrowElement[];
  /** The node whose look the new one should copy, if any
   *  (docs/specs/009-elements/mind-node.md "A new node looks like its level"). */
  styleFrom: ShapeElement | null;
  /** The connector whose look the new one should copy, if any. */
  connectorStyleFrom: ArrowElement | null;
};

export type MindRelayout = { rootId: ElementId; moves: MindMove[]; reanchored: ArrowElement[] };

const parentOf = (elements: Element[], node: ShapeElement): ShapeElement | undefined => {
  const p = node.mindParentId
    ? elements.find((el) => el.id === node.mindParentId && isMindNode(el))
    : undefined;
  return p && isMindNode(p) ? p : undefined;
};

// Cycle-guarded, like every walk over `mindParentId`.
function depthOf(elements: Element[], node: ShapeElement): number {
  const seen = new Set<ElementId>([node.id]);
  let depth = 0;
  for (let at = parentOf(elements, node); at && !seen.has(at.id); at = parentOf(elements, at)) {
    seen.add(at.id);
    depth += 1;
  }
  return depth;
}

/**
 * Whose look a new child of `parent` copies: a sibling (the one Enter was
 * pressed on, else the last), else a cousin at the same depth of the same map,
 * else the parent itself, unless the parent is the root: a first branch copying
 * a bold root would give the map two roots, so it takes the defaults.
 */
export function mindStyleSource(
  elements: Element[],
  parent: ShapeElement,
  from: ShapeElement,
): ShapeElement | null {
  const siblings = mindChildren(elements, parent.id);
  if (siblings.length > 0)
    return siblings.find((s) => s.id === from.id) ?? siblings[siblings.length - 1]!;
  const root = mindRootOf(elements, parent);
  const depth = depthOf(elements, parent) + 1;
  const cousin = mindSubtree(elements, root.id).find((n) => depthOf(elements, n) === depth);
  if (cousin) return cousin;
  return root.id === parent.id ? null : parent;
}

// A pinned connector joining two nodes, whichever end it was drawn from.
function connectorBetween(elements: Element[], a: ElementId, b: ElementId) {
  return elements.find(
    (el): el is ArrowElement =>
      el.type === 'arrow' &&
      el.from.kind === 'pinned' &&
      el.to.kind === 'pinned' &&
      ((el.from.elementId === a && el.to.elementId === b) ||
        (el.from.elementId === b && el.to.elementId === a)),
  );
}

/** A sibling's connector, else the one into the parent. */
function connectorStyleSource(elements: Element[], parent: ShapeElement): ArrowElement | null {
  for (const kid of mindChildren(elements, parent.id)) {
    const c = connectorBetween(elements, parent.id, kid.id);
    if (c) return c;
  }
  const grand = parentOf(elements, parent);
  return (grand && connectorBetween(elements, grand.id, parent.id)) ?? null;
}

const toMoves = (elements: Element[], shifts: readonly MindShift[]): MindMove[] =>
  shifts.flatMap((s) => {
    const el = elements.find((e) => e.id === s.id);
    return el && isMindNode(el) ? [{ id: s.id, x: el.x, y: el.y + s.dy }] : [];
  });

/** Nodes of `layout` that are not where it puts them, as moves. */
function layoutMoves(elements: Element[], layout: MindLayout, skip?: ElementId): MindMove[] {
  const out: MindMove[] = [];
  for (const [id, p] of layout) {
    if (id === skip) continue;
    const el = elements.find((e) => e.id === id);
    if (el && isMindNode(el) && (el.x !== p.x || el.y !== p.y)) out.push({ id, ...p });
  }
  return out;
}

// Where the moved nodes will be, for pushing other trees out of the way.
function movedRects(elements: Element[], moves: readonly MindMove[]) {
  return moves.flatMap((m) => {
    const el = elements.find((e) => e.id === m.id);
    return el && isMindNode(el) ? [{ x: m.x, y: m.y, width: el.width, height: el.height }] : [];
  });
}

/**
 * Plan a new node grown from `fromId`: its child (Tab) or its sibling (Enter).
 * `ids` are minted by the caller so the plan is deterministic, which lets the
 * editor compute it inside a state updater that may run twice.
 */
export function planMindGrowth(
  elements: Element[],
  fromId: ElementId,
  kind: 'child' | 'sibling',
  ids: { node: ElementId; arrow: ElementId },
): MindGrowthPlan | null {
  const from = elements.find((el) => el.id === fromId);
  if (!from || !isMindNode(from)) return null;
  const parent = kind === 'child' ? from : parentOf(elements, from);

  if (!parent) {
    // Enter on a root makes another root, at the end of the root stack. It
    // has no map to lay out around, so free placement is the whole story.
    const grown = growMindSibling(elements, from);
    return {
      node: { ...grown.node, id: ids.node },
      arrow: null,
      moves: [],
      reanchored: [],
      styleFrom: from,
      connectorStyleFrom: null,
    };
  }

  const styleFrom = mindStyleSource(elements, parent, from);
  const fallback = SHAPE_DEFAULT_SIZE['mind-node'];
  // No level to match yet: the defaults, but never bigger than the root the
  // branch hangs off, or a small hand-sized root sprouts giant children.
  const size = styleFrom
    ? { width: styleFrom.width, height: styleFrom.height }
    : {
        width: Math.min(fallback.width, parent.width),
        height: Math.min(fallback.height, parent.height),
      };
  const base: ShapeElement = {
    ...(createShape('mind-node', 0, 0) as ShapeElement),
    ...size,
    id: ids.node,
    mindParentId: parent.id,
  };
  const root = mindRootOf(elements, parent);
  const flow = mindFlowOf(elements, parent);

  let node: ShapeElement;
  let moves: MindMove[];
  let reanchored: ArrowElement[] = [];
  let parentAt = parent;
  if (isMindTreeTidy(elements, root.id, flow)) {
    const withNode = [...elements, base];
    const layout = layoutMindTree(withNode, root.id, flow, {
      id: base.id,
      after: kind === 'sibling' ? from.id : undefined,
    });
    node = { ...base, ...layout.get(base.id)! };
    const own = layoutMoves(elements, layout, base.id);
    const mapIds = new Set(layout.keys());
    const pushed = makeRoom(elements, mapIds, [node, ...movedRects(elements, own)]);
    moves = [...own, ...toMoves(elements, pushed)];
    reanchored = reanchorMindConnectors(elements, mapIds, flow, layout);
    parentAt = { ...parent, ...layout.get(parent.id)! };
  } else {
    const at = nextMindChildPosition(elements, parent, size);
    node = { ...base, x: at.x, y: at.y };
    moves = toMoves(elements, makeRoom(elements, treeIds(elements, parent), node));
  }
  const [pa, ca] = mindConnectorAnchors(flow, parentAt, node);
  return {
    node,
    arrow: { ...createPinnedArrow(parent.id, pa, node.id, ca), id: ids.arrow },
    moves,
    reanchored,
    styleFrom,
    connectorStyleFrom: connectorStyleSource(elements, parent),
  };
}

/**
 * Lay out the whole map `nodeId` belongs to in `flow` (its root's flow when
 * omitted): Tidy Map, and a flow change. Order is read in `orderFlow`, the flow
 * the map is drawn in now, so switching from a tree to a downward map keeps the
 * branches in the order they were read top to bottom.
 */
export function relayoutMindMap(
  elements: Element[],
  nodeId: ElementId,
  flow?: MindFlow,
): MindRelayout | null {
  const node = elements.find((el) => el.id === nodeId);
  if (!node || !isMindNode(node)) return null;
  const root = mindRootOf(elements, node);
  const current = mindFlowOf(elements, root);
  const target = flow ?? current;
  const layout = layoutMindTree(elements, root.id, target, undefined, current);
  const own = layoutMoves(elements, layout);
  const mapIds = new Set(layout.keys());
  const pushed = makeRoom(elements, mapIds, movedRects(elements, own));
  return {
    rootId: root.id,
    moves: [...own, ...toMoves(elements, pushed)],
    reanchored: reanchorMindConnectors(elements, mapIds, target, layout),
  };
}

/**
 * The ids a drag of `ids` should carry (docs/specs/009-elements/mind-node.md "Moving a branch"): every
 * mind node's whole subtree comes along, the way a frame carries its contents.
 */
export function withMindSubtrees(elements: Element[], ids: ReadonlySet<ElementId>): Set<ElementId> {
  const out = new Set(ids);
  for (const id of ids) {
    const el = elements.find((e) => e.id === id);
    if (!el || !isMindNode(el)) continue;
    for (const n of mindSubtree(elements, id)) out.add(n.id);
  }
  return out;
}

/**
 * Apply a plan's moves and re-anchors to `elements` as PATCHES: position on a
 * moved node, faces on a re-anchored connector, nothing else. The editor runs
 * this inside its commit against the elements as they stand then, so a label
 * committed a moment earlier (the one typed before Tab) is never overwritten by
 * the copy the plan was computed from.
 */
export function applyMindMoves(
  elements: Element[],
  moves: readonly MindMove[],
  reanchored: readonly ArrowElement[] = [],
): Element[] {
  if (moves.length === 0 && reanchored.length === 0) return elements;
  const at = new Map(moves.map((m) => [m.id, m]));
  const faces = new Map(reanchored.map((a) => [a.id, a]));
  return elements.map((el) => {
    const m = at.get(el.id);
    if (m && isMindNode(el)) return { ...el, x: m.x, y: m.y };
    const a = faces.get(el.id);
    if (a && el.type === 'arrow' && el.from.kind === 'pinned' && el.to.kind === 'pinned') {
      if (a.from.kind !== 'pinned' || a.to.kind !== 'pinned') return el;
      return {
        ...el,
        from: { ...el.from, anchor: a.from.anchor },
        to: { ...el.to, anchor: a.to.anchor },
      };
    }
    return el;
  });
}
