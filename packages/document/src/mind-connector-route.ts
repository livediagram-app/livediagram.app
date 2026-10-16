// Mind-map connectors in the Professional finish (docs/specs/009-elements/mind-node.md "Connectors",
// docs/specs/008-canvas/finish.md "Professional").
//
// A mind map's connectors are stored curved (MIND_CONNECTOR_LOOK). Professional draws them right-angled,
// and neatly: every connector off one parent leaves the same point on the parent's face and turns on one
// shared trunk halfway across the gap to the nearest child, so a column of siblings reads as a bracket
// rather than a bundle of separate elbows. The bubble flow, which fans every way, draws straight spokes.
//
// It is a look, never a rewrite: the stored arrow keeps its curve, so switching the finish back restores
// it. Only a connector still in the map's default look is routed; a style, bow or bend picked on it wins.
// Pure, read by the canvas and every export so the two agree.

import type { Anchor, ArrowElement, Element, ElementId, ShapeElement } from './index';
import { arrowEndpointSpread } from './arrow-endpoint-spread';
import { endpointPosition, elementIndexFor, type ElementIndex, type Point } from './geometry';
import type { Finish } from './finish';
import { DEFAULT_MIND_FLOW, MIND_CONNECTOR_LOOK, isMindFlow, type MindFlow } from './mind-flow';

type Delta = { dx: number; dy: number };

/** How a finish draws a mind connector: angled through `corners` (absolute, in from-to order; none for a
 *  run whose ends already line up), or a straight spoke. */
export type MindConnectorRoute =
  { style: 'angled'; corners: Point[] } | { style: 'straight'; corners: [] };

const isNode = (el: Element | undefined): el is ShapeElement =>
  el !== undefined && el.type === 'shape' && el.shape === 'mind-node';

/** Whether a connector is still in the map's default look: curved, never bowed or bent by hand. Anything
 *  else was picked on it, and a pick wins in every finish. */
export function isDefaultMindConnectorLook(arrow: ArrowElement): boolean {
  return (
    arrow.arrowStyle === MIND_CONNECTOR_LOOK.arrowStyle &&
    !arrow.curveOffset &&
    !(arrow.curvePoints && arrow.curvePoints.length > 0)
  );
}

// Each node's mind children, built once per element index (the index is rebuilt whenever the board
// changes, so it is the cache key): finding a parent's siblings is then a lookup, not a board scan.
const childrenCache = new WeakMap<ElementIndex, Map<ElementId, ShapeElement[]>>();
function childrenOf(index: ElementIndex, id: ElementId): readonly ShapeElement[] {
  let byParent = childrenCache.get(index);
  if (!byParent) {
    byParent = new Map();
    for (const el of index.values()) {
      if (!isNode(el) || !el.mindParentId) continue;
      const list = byParent.get(el.mindParentId);
      if (list) list.push(el);
      else byParent.set(el.mindParentId, [el]);
    }
    childrenCache.set(index, byParent);
  }
  return byParent.get(id) ?? [];
}

// The flow is stored on the root. Each walk records the flow for every node it passed, per index, so a
// whole map's connectors cost one walk per branch rather than one per connector (a deep chain stays
// linear). A cycle (hand-edited data) stops the walk where it repeats.
const flowCache = new WeakMap<ElementIndex, Map<ElementId, MindFlow>>();
function flowOf(index: ElementIndex, node: ShapeElement): MindFlow {
  let known = flowCache.get(index);
  if (!known) {
    known = new Map();
    flowCache.set(index, known);
  }
  const path: ElementId[] = [];
  const seen = new Set<ElementId>([node.id]);
  let current = node;
  let flow: MindFlow | undefined = known.get(node.id);
  while (flow === undefined) {
    path.push(current.id);
    const parent = current.mindParentId ? index.get(current.mindParentId) : undefined;
    if (!isNode(parent) || seen.has(parent.id)) {
      flow = isMindFlow(current.mindFlow) ? current.mindFlow : DEFAULT_MIND_FLOW;
      break;
    }
    seen.add(parent.id);
    current = parent;
    flow = known.get(current.id);
  }
  for (const id of path) known.set(id, flow);
  return flow;
}

const FACE: Record<string, 'e' | 'w' | 'n' | 's'> = { e: 'e', w: 'w', n: 'n', s: 's' };

/**
 * The route the finish draws `arrow` along, or null when it is drawn as stored: not Professional (nor an org
 * chart's connector, which is always routed), not a mind connector (both ends pinned to mind nodes, one the other's
 * parent), or not in the default look.
 */
export function finishMindConnectorRoute(
  arrow: ArrowElement,
  elements: readonly Element[] | ElementIndex,
  finish: Finish,
): MindConnectorRoute | null {
  if (!isDefaultMindConnectorLook(arrow)) return null;
  if (arrow.from.kind !== 'pinned' || arrow.to.kind !== 'pinned') return null;
  const index: ElementIndex = Array.isArray(elements)
    ? elementIndexFor(elements)
    : (elements as ElementIndex);
  const a = index.get(arrow.from.elementId);
  const b = index.get(arrow.to.elementId);
  if (!isNode(a) || !isNode(b)) return null;
  // An org chart (docs/specs/009-elements/org-chart.md) draws its connectors as this bracket in every finish: a
  // person map's reports hang off one trunk, the way org charts are read.
  const orgChart = a.mindLook === 'person' && b.mindLook === 'person';
  if (finish !== 'professional' && !orgChart) return null;
  // Usually drawn parent to child, but a swapped connector is the same branch.
  const forward = b.mindParentId === a.id;
  if (!forward && a.mindParentId !== b.id) return null;
  if (flowOf(index, a) === 'bubble') return { style: 'straight', corners: [] };

  const parent = forward ? a : b;
  const parentEnd = forward ? arrow.from : arrow.to;
  const childEnd = forward ? arrow.to : arrow.from;
  const p = endpointPosition(parentEnd, index);
  const c = endpointPosition(childEnd, index);
  const corners = bracketCorners(
    parent,
    FACE[(parentEnd as { anchor: Anchor }).anchor],
    FACE[(childEnd as { anchor: Anchor }).anchor],
    p,
    c,
    childrenOf(index, parent.id),
  );
  if (corners === null) return { style: 'angled', corners: [] };
  return { style: 'angled', corners: forward ? corners : corners.reverse() };
}

// Corners of the bracket from the parent's point `p` to the child's point `c`, parent first. Null when
// the two faces do not face each other across a gap (a hand re-pinned end): the plain one-elbow angled
// line is drawn instead. Empty when the ends already line up, so the run is a single straight segment.
function bracketCorners(
  parent: ShapeElement,
  parentFace: 'e' | 'w' | 'n' | 's' | undefined,
  childFace: 'e' | 'w' | 'n' | 's' | undefined,
  p: Point,
  c: Point,
  children: readonly ShapeElement[],
): Point[] | null {
  const across = parentFace === 'e' || parentFace === 'w';
  const opposite: Record<string, string> = { e: 'w', w: 'e', n: 's', s: 'n' };
  if (!parentFace || childFace !== opposite[parentFace]) return null;
  const sign = parentFace === 'e' || parentFace === 's' ? 1 : -1;
  // The children on this side of the parent, and the face of the nearest one: the trunk sits halfway
  // between it and the parent, so every sibling turns on the same line.
  const mid = across ? parent.x + parent.width / 2 : parent.y + parent.height / 2;
  let nearest = across ? c.x : c.y;
  for (const n of children) {
    const centre = across ? n.x + n.width / 2 : n.y + n.height / 2;
    if ((centre - mid) * sign <= 0) continue;
    const face = across ? (sign > 0 ? n.x : n.x + n.width) : sign > 0 ? n.y : n.y + n.height;
    if ((face - nearest) * sign < 0) nearest = face;
  }
  const start = across ? p.x : p.y;
  // A child tucked back over the parent leaves no gap to put a trunk in: use its own half-way.
  const trunk =
    (nearest - start) * sign > 0 ? (start + nearest) / 2 : (start + (across ? c.x : c.y)) / 2;
  if (across ? Math.abs(c.y - p.y) < 1 : Math.abs(c.x - p.x) < 1) return [];
  return across
    ? [
        { x: trunk, y: p.y },
        { x: trunk, y: c.y },
      ]
    : [
        { x: p.x, y: trunk },
        { x: c.x, y: trunk },
      ];
}

/**
 * The arrow as the finish draws it: for a routed mind connector, a copy that is angled through the
 * route's corners (or straight), with no bow or elbow of its own and both ends exact, so no fan pulls a
 * sibling's start off the shared point. Any other arrow comes back as it is (the same object).
 */
export function finishRoutedArrow(
  arrow: ArrowElement,
  elements: readonly Element[] | ElementIndex,
  finish: Finish,
): ArrowElement {
  const route = finishMindConnectorRoute(arrow, elements, finish);
  if (!route) return arrow;
  const index: ElementIndex = Array.isArray(elements)
    ? elementIndexFor(elements)
    : (elements as ElementIndex);
  const from = endpointPosition(arrow.from, index);
  const to = endpointPosition(arrow.to, index);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const curvePoints: Delta[] | undefined =
    route.corners.length > 0
      ? route.corners.map((pt) => ({ dx: pt.x - mid.x, dy: pt.y - mid.y }))
      : undefined;
  // Lined-up ends with no corners draw straight: an angled style with nothing to bend draws a
  // zero-length elbow (arrow-orthogonal.ts).
  const lined = route.style === 'angled' && !curvePoints && aligned(from, to);
  return {
    ...arrow,
    arrowStyle: lined ? 'straight' : route.style,
    curveOffset: undefined,
    elbowOffset: undefined,
    curvePoints,
    exactStart: true,
    exactEnd: true,
  };
}

const aligned = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1;

/**
 * The arrow as its finish draws it plus the two points its line runs between: the anchors, slid along
 * the edge by the converging-fan spread (arrow-endpoint-spread.ts) unless the finish routes it, when
 * they are exact. One resolution for the canvas and every export.
 */
export function finishArrowEnds(
  arrow: ArrowElement,
  elements: Element[] | ElementIndex,
  finish: Finish,
): { arrow: ArrowElement; from: Point; to: Point } {
  const drawn = finishRoutedArrow(arrow, elements, finish);
  const from = endpointPosition(arrow.from, elements);
  const to = endpointPosition(arrow.to, elements);
  if (drawn !== arrow) return { arrow: drawn, from, to };
  const fromSpread = arrowEndpointSpread(arrow.id, 'from', elements);
  const toSpread = arrowEndpointSpread(arrow.id, 'to', elements);
  return {
    arrow,
    from: { x: from.x + fromSpread.x, y: from.y + fromSpread.y },
    to: { x: to.x + toSpread.x, y: to.y + toSpread.y },
  };
}
