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

import { bestAnchorTowards } from './anchor-choice';
import type { Anchor, ShapeElement } from './index';

export type MindFlow = 'tree' | 'leftward' | 'balanced' | 'downward' | 'upward' | 'bubble';

/** In the order the Branching list shows them: each mirror next to its original. */
export const MIND_FLOWS: readonly MindFlow[] = [
  'tree',
  'leftward',
  'balanced',
  'downward',
  'upward',
  'bubble',
];

/** What the element grew as before flows existed, so every map already drawn
 *  keeps its shape. */
export const DEFAULT_MIND_FLOW: MindFlow = 'tree';

/** Title Case, for the Branching rows. */
export const MIND_FLOW_LABEL: Record<MindFlow, string> = {
  tree: 'Tree',
  leftward: 'Leftward',
  balanced: 'Balanced',
  downward: 'Downward',
  upward: 'Upward',
  bubble: 'Bubble',
};

/** Whether a flow's levels run vertically (its siblings spread across a row). */
export const isVerticalMindFlow = (flow: MindFlow) => flow === 'downward' || flow === 'upward';

/**
 * The connector look a mind map is drawn with when nothing in the map says
 * otherwise (docs/specs/009-elements/mind-node.md "Connectors"): no arrowheads, because a mind map shows
 * belonging, not direction; curved, so a fanned column of children stays
 * legible. The templates draw with it and growth falls back to it, so the two
 * read the same.
 */
export const MIND_CONNECTOR_LOOK = { arrowEnds: 'none', arrowStyle: 'curved' } as const;

/** Gap between a parent and its child, along the flow's direction. */
export const MIND_CHILD_GAP_X = 64;
/** Gap between stacked siblings. */
export const MIND_SIBLING_GAP_Y = 18;
/** Gap between a parent and its children in the downward flow, where the levels stack vertically. */
export const MIND_CHILD_GAP_Y = MIND_SIBLING_GAP_Y + MIND_CHILD_GAP_X / 2;

export function isMindFlow(value: string | undefined): value is MindFlow {
  return value !== undefined && (MIND_FLOWS as readonly string[]).includes(value);
}

/** How far apart a map's nodes sit (docs/specs/009-elements/mind-node.md "Spacing"). */
export type MindSpacing = 'tight' | 'compact' | 'comfortable' | 'wide';

export const MIND_SPACINGS: readonly MindSpacing[] = ['tight', 'compact', 'comfortable', 'wide'];

/** The gaps every map had before spacing existed, so a map without one keeps its shape. */
export const DEFAULT_MIND_SPACING: MindSpacing = 'comfortable';

/** The factor each spacing scales both gaps by. */
const MIND_SPACING_SCALE: Record<MindSpacing, number> = {
  tight: 0.5,
  compact: 0.75,
  comfortable: 1,
  wide: 1.5,
};

export function isMindSpacing(value: string | undefined): value is MindSpacing {
  return value !== undefined && (MIND_SPACINGS as readonly string[]).includes(value);
}

/** The gaps a map is laid out with: parent to child across a level, between siblings, and the vertical flows'
 *  level gap. Whole pixels, so a tidy layout stays a fixed point. */
export type MindGaps = { child: number; sibling: number; level: number };

export function mindGaps(spacing: MindSpacing = DEFAULT_MIND_SPACING): MindGaps {
  const k = MIND_SPACING_SCALE[spacing] ?? 1;
  return {
    child: Math.round(MIND_CHILD_GAP_X * k),
    sibling: Math.round(MIND_SIBLING_GAP_Y * k),
    level: Math.round(MIND_CHILD_GAP_Y * k),
  };
}

type Size = { width: number; height: number };

type MindPlacement = {
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
  gaps: MindGaps = mindGaps(),
): MindPlacement {
  if (flow === 'bubble') return bubblePlacement(parent, size, children, outward, gaps);
  if (flow === 'downward') return downwardPlacement(parent, size, subtree, gaps, 1);
  if (flow === 'upward') return downwardPlacement(parent, size, subtree, gaps, -1);
  if (flow === 'balanced') return balancedPlacement(parent, size, subtree, children, outward, gaps);
  return treePlacement(parent, size, subtree, gaps, flow === 'leftward' ? -1 : 1);
}

// Right (or, mirrored, left), and stacked down: the original arrangement.
function treePlacement(
  parent: ShapeElement,
  size: Size,
  subtree: readonly ShapeElement[],
  gaps: MindGaps,
  dir: 1 | -1,
): MindPlacement {
  const x = dir === 1 ? parent.x + parent.width + gaps.child : parent.x - gaps.child - size.width;
  // First child centred on the parent, which is what makes a lone branch look
  // deliberate rather than dropped. Later ones stack against the bottom of the
  // whole subtree, not just the immediate children, so a branch that has grown
  // down past its own parent doesn't drop the next sibling on a grandchild.
  const y =
    subtree.length === 0
      ? parent.y + parent.height / 2 - size.height / 2
      : bounds(subtree).bottom + gaps.sibling;
  return { x, y, axis: 'y' };
}

// The tree on its side: children below (or, upward, above), siblings spread across. Everything the
// tree flow says, with the axes swapped.
function downwardPlacement(
  parent: ShapeElement,
  size: Size,
  subtree: readonly ShapeElement[],
  gaps: MindGaps,
  dir: 1 | -1,
): MindPlacement {
  const y = dir === 1 ? parent.y + parent.height + gaps.level : parent.y - gaps.level - size.height;
  const x =
    subtree.length === 0
      ? parent.x + parent.width / 2 - size.width / 2
      : bounds(subtree).right + gaps.sibling;
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
  gaps: MindGaps,
): MindPlacement {
  // `outward` is east for a root (no parent to point away from), so a root
  // alternates by how many children it already has and everything deeper
  // follows the direction its own branch already runs in.
  const left = outward === 0 ? children.length % 2 === 1 : Math.cos(outward) < 0;
  const x = left ? parent.x - gaps.child - size.width : parent.x + parent.width + gaps.child;
  // Stack against this SIDE's branch only: the other side's nodes are not in
  // the way, and counting them would leave a growing gap on the near side.
  const sameSide = subtree.filter((n) =>
    left ? centre(n).x < centre(parent).x : centre(n).x > centre(parent).x,
  );
  const y =
    sameSide.length === 0
      ? parent.y + parent.height / 2 - size.height / 2
      : bounds(sameSide).bottom + gaps.sibling;
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
  gaps: MindGaps,
): MindPlacement {
  const index = children.length;
  // 0, +1, -1, +2, -2 ... so each new child takes the next free angle nearest
  // the middle of the fan. Siblings therefore never collide by construction,
  // which is why this flow needs no stacking rule.
  const step = Math.ceil(index / 2) * (index % 2 === 1 ? 1 : -1);
  const angle = outward + step * BUBBLE_STEP;
  const radius =
    Math.hypot(parent.width, parent.height) / 2 +
    gaps.child +
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

/**
 * The faces a parent-to-child connector joins, by flow (docs/specs/009-elements/mind-node.md "Connectors"): a
 * tree, leftward or balanced map runs east-west by the side the child is on, a downward
 * or upward map north-south, and only the bubble flow, which fans every way, asks the
 * nearest-pair chooser.
 */
export function mindConnectorAnchors(
  flow: MindFlow,
  parent: ShapeElement,
  child: ShapeElement,
): [Anchor, Anchor] {
  const p = centre(parent);
  const c = centre(child);
  if (isVerticalMindFlow(flow)) return c.y >= p.y ? ['s', 'n'] : ['n', 's'];
  if (flow === 'bubble') return [bestAnchorTowards(parent, c), bestAnchorTowards(child, p)];
  return c.x >= p.x ? ['e', 'w'] : ['w', 'e'];
}
