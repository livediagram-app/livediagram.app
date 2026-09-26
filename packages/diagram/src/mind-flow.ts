// Mind-map flows (docs/specs/009-elements/mind-node.md): the shape a map grows in.
//
// Growth started with one arrangement, the one a keyboard-driven outline wants:
// a child to the right, siblings stacked down it. That is a TREE, and it is
// only one of the shapes people draw. A bubble map fans its branches around
// the centre; a downward tree is what an org chart or a decision tree looks
// like; a balanced map throws branches both ways off the root, which is the
// classic hand-drawn mind map. The keystrokes are the same in all of them, so
// the flow changes where a node lands and nothing else.
//
// The flow lives on the map's ROOT node and applies to the whole tree: a map
// half tree and half bubble is not a map anyone meant to draw.
//
// Pure geometry. It takes the parent, the size of the node to place, and the
// branch as it already stands, and returns a position plus the axis a
// collision should push along. Deliberately knows nothing about the element
// model beyond boxes, so mind-map.ts keeps the tree walking.

import type { ShapeElement } from './index';

export type MindFlow = 'tree' | 'balanced' | 'downward' | 'bubble';

export const MIND_FLOWS: readonly MindFlow[] = ['tree', 'balanced', 'downward', 'bubble'];

/** What the element grew as before flows existed, so every map already drawn
 *  keeps its shape. */
export const DEFAULT_MIND_FLOW: MindFlow = 'tree';

/** Title Case, for the menu tiles. */
export const MIND_FLOW_LABEL: Record<MindFlow, string> = {
  tree: 'Tree',
  balanced: 'Balanced',
  downward: 'Downward',
  bubble: 'Bubble',
};

export const MIND_FLOW_HINT: Record<MindFlow, string> = {
  tree: 'Branches to the right, siblings stacked down',
  balanced: 'Branches both ways off the root',
  downward: 'Branches below, siblings spread across',
  bubble: 'Branches fanned around the parent',
};

/** Gap between a parent and its child, along the flow's direction. */
export const MIND_CHILD_GAP_X = 64;
/** Gap between stacked siblings. */
export const MIND_SIBLING_GAP_Y = 18;

export function isMindFlow(value: string | undefined): value is MindFlow {
  return value !== undefined && (MIND_FLOWS as readonly string[]).includes(value);
}

type Size = { width: number; height: number };

export type MindPlacement = {
  x: number;
  y: number;
  // Which way a node in the way gets pushed. A tree stacks its siblings down a
  // column, so a collision pushes down; a downward map spreads them across a
  // row, so it pushes right. Pushing the wrong way would shove a node straight
  // into the next sibling's slot.
  axis: 'x' | 'y';
};

const bounds = (nodes: readonly ShapeElement[]) => ({
  left: Math.min(...nodes.map((n) => n.x)),
  right: Math.max(...nodes.map((n) => n.x + n.width)),
  top: Math.min(...nodes.map((n) => n.y)),
  bottom: Math.max(...nodes.map((n) => n.y + n.height)),
});

const centre = (n: ShapeElement) => ({ x: n.x + n.width / 2, y: n.y + n.height / 2 });

/**
 * Where the next child of `parent` goes.
 *
 * `subtree` is everything already hanging off the parent (so a branch that has
 * grown past its own parent is stacked against, not landed on); `outward` is
 * the direction the parent itself points away from ITS parent, in radians,
 * which is what lets a bubble map fan outward rather than folding back over
 * the middle. A root has no outward direction, so it gets east.
 */
export function placeMindChild(
  flow: MindFlow,
  parent: ShapeElement,
  size: Size,
  subtree: readonly ShapeElement[],
  children: readonly ShapeElement[],
  outward: number,
): MindPlacement {
  if (flow === 'bubble') return bubblePlacement(parent, size, children, outward);
  if (flow === 'downward') return downwardPlacement(parent, size, subtree);
  if (flow === 'balanced') return balancedPlacement(parent, size, subtree, children, outward);
  return treePlacement(parent, size, subtree);
}

// Right, and stacked down: the original arrangement.
function treePlacement(
  parent: ShapeElement,
  size: Size,
  subtree: readonly ShapeElement[],
): MindPlacement {
  const x = parent.x + parent.width + MIND_CHILD_GAP_X;
  // First child centred on the parent, which is what makes a lone branch look
  // deliberate rather than dropped. Later ones stack against the bottom of the
  // whole subtree, not just the immediate children, so a branch that has grown
  // down past its own parent doesn't drop the next sibling on a grandchild.
  const y =
    subtree.length === 0
      ? parent.y + parent.height / 2 - size.height / 2
      : bounds(subtree).bottom + MIND_SIBLING_GAP_Y;
  return { x, y, axis: 'y' };
}

// The tree on its side: children below, siblings spread across. Everything the
// tree flow says, with the axes swapped.
function downwardPlacement(
  parent: ShapeElement,
  size: Size,
  subtree: readonly ShapeElement[],
): MindPlacement {
  const y = parent.y + parent.height + MIND_SIBLING_GAP_Y + MIND_CHILD_GAP_X / 2;
  const x =
    subtree.length === 0
      ? parent.x + parent.width / 2 - size.width / 2
      : bounds(subtree).right + MIND_SIBLING_GAP_Y;
  return { x, y, axis: 'x' };
}

// Both ways off the root. A branch keeps the side it started on, so only the
// root alternates: flipping deeper down would fold a branch back over its own
// parent, which is the one thing the shape exists to avoid.
function balancedPlacement(
  parent: ShapeElement,
  size: Size,
  subtree: readonly ShapeElement[],
  children: readonly ShapeElement[],
  outward: number,
): MindPlacement {
  // `outward` is east for a root (no parent to point away from), so a root
  // alternates by how many children it already has and everything deeper
  // follows the direction its own branch already runs in.
  const left = outward === 0 ? children.length % 2 === 1 : Math.cos(outward) < 0;
  const x = left
    ? parent.x - MIND_CHILD_GAP_X - size.width
    : parent.x + parent.width + MIND_CHILD_GAP_X;
  // Stack against this SIDE's branch only: the other side's nodes are not in
  // the way, and counting them would leave a growing gap on the near side.
  const sameSide = subtree.filter((n) =>
    left ? centre(n).x < centre(parent).x : centre(n).x > centre(parent).x,
  );
  const y =
    sameSide.length === 0
      ? parent.y + parent.height / 2 - size.height / 2
      : bounds(sameSide).bottom + MIND_SIBLING_GAP_Y;
  return { x, y, axis: 'y' };
}

// Fanned around the parent. Children alternate either side of the direction
// the parent points, so a branch opens like a fan instead of curling round
// onto the node it came from.
const BUBBLE_STEP = (50 * Math.PI) / 180;

function bubblePlacement(
  parent: ShapeElement,
  size: Size,
  children: readonly ShapeElement[],
  outward: number,
): MindPlacement {
  const index = children.length;
  // 0, +1, -1, +2, -2 ... so each new child takes the next free angle nearest
  // the middle of the fan. Siblings therefore never collide by construction,
  // which is why this flow needs no stacking rule.
  const step = Math.ceil(index / 2) * (index % 2 === 1 ? 1 : -1);
  const angle = outward + step * BUBBLE_STEP;
  const radius =
    Math.hypot(parent.width, parent.height) / 2 +
    MIND_CHILD_GAP_X +
    Math.hypot(size.width, size.height) / 2;
  const at = centre(parent);
  return {
    x: at.x + Math.cos(angle) * radius - size.width / 2,
    y: at.y + Math.sin(angle) * radius - size.height / 2,
    axis: 'y',
  };
}

/** The direction from `from` to `to`, in radians, for the next level's fan. */
export function outwardAngle(from: ShapeElement, to: ShapeElement): number {
  const a = centre(from);
  const b = centre(to);
  return Math.atan2(b.y - a.y, b.x - a.x);
}
