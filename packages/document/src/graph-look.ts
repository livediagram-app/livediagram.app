// The graph look (docs/specs/015-api/mcp-server.md §4.7 "The graph look"): what turns a laid-out graph into
// something that reads like the flowchart template. Pure passes over a graph and its laid-out elements:
//
//   - sideStepEdges: which decision exits sit level with their decision (fed to the layout as flat edges);
//   - withTones: start, end and decision roles, and a node's own tone and icon;
//   - routeLoops: edges back to an earlier rank go round the outside as elbows;
//   - the title, the caption and the key of shapes live beside it (graph-header.ts).
//
// Graph input only (graph-input.ts `layoutGraph`); the editor's Mermaid import and Tidy Up never run them.

import { isContainerKind } from './containment';
import { edgeKey } from './auto-layout';
import { arrowEndpointSpread } from './arrow-endpoint-spread';
import { rectGrid, type RectGrid } from './auto-layout-route-grid';
import { anchorPosition, endpointPosition } from './geometry';
import type { GraphEdge, GraphNode } from './graph-authoring';
import {
  ROUTER_BUDGET,
  routeOrthogonal,
  runsOf,
  type Pt as RoutePt,
  type RouterBudget,
  type Run,
  type Side,
} from './orthogonal-router';
import { isBoxed, type Anchor, type ArrowElement, type BoxedElement, type Element } from './index';

export type GraphTone = 'strong' | 'soft' | 'muted' | 'plain';
export type LookNode = GraphNode & { tone?: GraphTone; icon?: string };

// A decision's exit that reads as the way on: it stays on the spine.
const MAIN_EXIT =
  /^(yes|y|ok|okay|true|pass|passed|success|succeeds|approved|valid|healthy|accept|accepted)\b/i;

// The colour preset each tone draws with; plain draws with none.
const TONE_PRESET: Readonly<Record<Exclude<GraphTone, 'plain'>, string>> = {
  strong: 'bold',
  soft: 'soft',
  muted: 'outline',
};

const outEdges = (edges: readonly GraphEdge[], id: string) => edges.filter((e) => e.from === id);
const inCount = (edges: readonly GraphEdge[], id: string) =>
  edges.reduce((n, e) => n + (e.to === id && e.from !== id ? 1 : 0), 0);

// How far each node leads: the longest run of edges from it to a node with no way on, a cycle cut where it closes.
// One depth-first walk with memory, so linear in the graph.
function reachOf(edges: readonly GraphEdge[]): (id: string) => number {
  const out = new Map<string, string[]>();
  for (const e of edges) (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e.to);
  const memo = new Map<string, number>();
  const open = new Set<string>();
  const walk = (id: string): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    if (open.has(id)) return 0;
    open.add(id);
    let best = 0;
    for (const to of out.get(id) ?? []) best = Math.max(best, 1 + walk(to));
    open.delete(id);
    memo.set(id, best);
    return best;
  };
  return walk;
}

// The edges whose target ranks level with its decision, beside it: for each diamond with two or more exits, one
// exit off the spine whose target nothing else enters. The spine exit is the one labelled like a yes, else the one
// leading furthest; a self-loop or an exit back to where the flow came from is never a side step.
export function sideStepEdges(
  nodes: readonly LookNode[],
  edges: readonly GraphEdge[],
): Set<string> {
  const flat = new Set<string>();
  const reach = reachOf(edges);
  for (const n of nodes) {
    if (n.shape !== 'diamond') continue;
    const exits = outEdges(edges, n.id).filter((e) => e.to !== n.id);
    if (exits.length < 2) continue;
    const main =
      exits.find((e) => MAIN_EXIT.test((e.label ?? '').trim())) ??
      [...exits].sort((a, b) => reach(b.to) - reach(a.to))[0]!;
    const side = exits.find((e) => e !== main && inCount(edges, e.to) === 1);
    if (side) flat.add(edgeKey(side.from, side.to));
  }
  return flat;
}

// Whether the graph is a flowchart: it uses the notation (a decision or a terminator).
export function isFlowchart(nodes: readonly LookNode[]): boolean {
  return nodes.some((n) => n.shape === 'diamond' || n.shape === 'stadium');
}

// Each node's tone and icon onto its box: a node's own tone first; else, in a flowchart, a stadium the flow starts
// from is strong, one it ends on soft, and a decision soft.
export function withTones(
  elements: Element[],
  nodes: readonly LookNode[],
  edges: readonly GraphEdge[],
): Element[] {
  const flowchart = isFlowchart(nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const toneOf = (n: LookNode): GraphTone | undefined => {
    if (n.tone) return n.tone;
    if (!flowchart) return undefined;
    if (n.shape === 'diamond') return 'soft';
    if (n.shape !== 'stadium') return undefined;
    if (inCount(edges, n.id) === 0) return 'strong';
    if (outEdges(edges, n.id).length === 0) return 'soft';
    return undefined;
  };
  return elements.map((el) => {
    if (el.type !== 'shape') return el;
    const n = byId.get(el.id);
    if (!n) return el;
    const tone = toneOf(n);
    const preset = tone && tone !== 'plain' ? TONE_PRESET[tone] : undefined;
    return {
      ...el,
      ...(preset ? { colorPreset: preset } : {}),
      ...(n.icon ? { iconId: n.icon } : {}),
    };
  });
}

// How far outside the boxes a loop runs, and the space between two loops' tracks.
export const LOOP_CLEARANCE = 40;
export const LOOP_TRACK_GAP = 22;

type Pt = { x: number; y: number };

// Where an arrow end sits once fanned, as the renderers draw it.
function endAt(arrow: ArrowElement, end: 'from' | 'to', elements: Element[]): Pt {
  const p = endpointPosition(arrow[end], elements);
  const s = arrowEndpointSpread(arrow.id, end, elements);
  return { x: p.x + s.x, y: p.y + s.y };
}

// An angled arrow through `points`, stored as chord-midpoint deltas (arrow-orthogonal.ts does the same).
function through(arrow: ArrowElement, points: Pt[], elements: Element[]): ArrowElement {
  const from = endAt(arrow, 'from', elements);
  const to = endAt(arrow, 'to', elements);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  return {
    ...arrow,
    arrowStyle: 'angled',
    curvePoints: points.map((p) => ({ dx: p.x - mid.x, dy: p.y - mid.y })),
  };
}

const pinnedId = (end: ArrowElement['from']) => (end.kind === 'pinned' ? end.elementId : null);

// How a routed arrow bends, worked out into points only once every pass has chosen its anchors (applyRoutes), since
// an anchor one pass picks moves the fanned ends of every arrow sharing it: a track, two bends at one cross position;
// or a corner, one bend, vertical first ('v': down then across) or horizontal first ('h').
export type Route =
  | { kind: 'track'; axis: 'TB' | 'LR'; at: number }
  | { kind: 'corner'; first: 'v' | 'h' }
  | { kind: 'path'; corners: RoutePt[] };
export type Routes = Map<string, Route>;

// Every routed arrow given its points from its final, fanned ends.
export function applyRoutes(elements: Element[], routes: Routes): Element[] {
  if (routes.size === 0) return elements;
  return elements.map((el) => {
    const route = el.type === 'arrow' ? routes.get(el.id) : undefined;
    if (!route || el.type !== 'arrow') return el;
    const from = endAt(el, 'from', elements);
    const to = endAt(el, 'to', elements);
    const points =
      route.kind === 'path'
        ? route.corners
        : route.kind === 'corner'
          ? [route.first === 'v' ? { x: from.x, y: to.y } : { x: to.x, y: from.y }]
          : route.axis === 'TB'
            ? [
                { x: route.at, y: from.y },
                { x: route.at, y: to.y },
              ]
            : [
                { x: from.x, y: route.at },
                { x: to.x, y: route.at },
              ];
    return through(el, points, elements);
  });
}

// Edges back to an earlier rank, routed round the outside. Down the page (TB) a loop leaves its source's side and
// enters its target's same side, running outside every box between the two: right of them, or left when a box
// stands right of the source or target in its row and none stands left. Across (LR) the same, below or above.
// A source already clear beside its target takes one bend instead: up its own column, then into the target's side.
export function routeLoops(
  elements: Element[],
  axis: 'TB' | 'LR',
  flat: ReadonlySet<string>,
  routes: Routes,
): Element[] {
  const boxes = new Map(elements.filter(isBoxed).map((b) => [b.id, b as BoxedElement] as const));
  const solid = [...boxes.values()].filter((b) => !isBackdrop(b));
  // The solid boxes by place, so each arrow is tested against the boxes near its path, not every box.
  const solidGrid = rectGrid(solid, 0);
  const main = (b: BoxedElement) => (axis === 'TB' ? b.y + b.height / 2 : b.x + b.width / 2);
  const spanOf = (b: BoxedElement): [number, number] =>
    axis === 'TB' ? [b.y, b.y + b.height] : [b.x, b.x + b.width];
  const crossOf = (b: BoxedElement): [number, number] =>
    axis === 'TB' ? [b.x, b.x + b.width] : [b.y, b.y + b.height];
  // A loop goes back to an earlier rank; a detour runs forward but its elbow would cross a box on the way (an edge
  // skipping ranks down the spine). Both go round the outside.
  const backward = (el: ArrowElement) => {
    const [a, b] = [boxes.get(pinnedId(el.from)!), boxes.get(pinnedId(el.to)!)];
    return !!a && !!b && main(b) < main(a) - 1;
  };
  const loops = elements.filter((el): el is ArrowElement => {
    if (el.type !== 'arrow') return false;
    const [f, t] = [pinnedId(el.from), pinnedId(el.to)];
    if (!f || !t || f === t || flat.has(edgeKey(f, t)) || !boxes.has(f) || !boxes.has(t))
      return false;
    return backward(el) || crossesABox(el, elements, solidGrid);
  });
  if (loops.length === 0) return elements;

  // Whether a box shares `b`'s row (its band along the flow) on the given side of it.
  const blocked = (b: BoxedElement, dir: 1 | -1) =>
    solid.some((o) => {
      if (o.id === b.id) return false;
      const [s0, s1] = spanOf(o);
      const [b0, b1] = spanOf(b);
      if (s1 <= b0 || s0 >= b1) return false;
      return dir === 1 ? crossOf(o)[0] >= crossOf(b)[1] : crossOf(o)[1] <= crossOf(b)[0];
    });
  const sideOf = (src: BoxedElement, dst: BoxedElement): 1 | -1 =>
    (blocked(src, 1) || blocked(dst, 1)) && !blocked(src, -1) && !blocked(dst, -1) ? -1 : 1;
  const anchorFor = (dir: 1 | -1) =>
    axis === 'TB' ? (dir === 1 ? 'e' : 'w') : dir === 1 ? 's' : 'n';

  const length = (a: ArrowElement) =>
    Math.abs(main(boxes.get(pinnedId(a.from)!)!) - main(boxes.get(pinnedId(a.to)!)!));
  // Shortest loops innermost: each takes a track further out than any loop it overlaps on its side.
  const ordered = [...loops].sort((p, q) => length(p) - length(q));
  const tracks: { lo: number; hi: number; at: number; dir: 1 | -1 }[] = [];
  const taken: Run[] = [];
  // Every route of this layout draws on one budget: spent, the rest take their outside tracks.
  const budget: RouterBudget = { left: ROUTER_BUDGET };
  let next = elements;
  for (const loop of ordered) {
    const src = boxes.get(pinnedId(loop.from)!)!;
    const dst = boxes.get(pinnedId(loop.to)!)!;
    const current = next.find((el) => el.id === loop.id) as ArrowElement;
    // The router first, when the drawing is small enough to search: the cheapest clean path over every pair of
    // sides. Its ends sit exactly on the sides' midpoints, so the corners it finds are the ones drawn.
    const found =
      solid.length <= ROUTER_MAX_BOXES
        ? bestRoute(
            src,
            dst,
            solid,
            taken,
            anchorsInUse(next.filter((el) => el.id !== loop.id)),
            budget,
          )
        : null;
    if (found) {
      const routed: ArrowElement = {
        ...current,
        from: { kind: 'pinned', elementId: src.id, anchor: found.fromAnchor },
        to: { kind: 'pinned', elementId: dst.id, anchor: found.toAnchor },
        exactStart: true,
        exactEnd: true,
      };
      next = next.map((el) => (el.id === loop.id ? routed : el));
      routes.set(loop.id, { kind: 'path', corners: found.corners });
      taken.push(...runsOf([found.from, ...found.corners, found.to]));
      continue;
    }
    const single = backward(current) ? singleBend(current, src, dst, solid, axis, next) : null;
    if (single) {
      next = next.map((el) => (el.id === loop.id ? single : el));
      routes.set(loop.id, { kind: 'corner', first: axis === 'TB' ? 'v' : 'h' });
      continue;
    }
    const dir = sideOf(src, dst);
    const anchor = anchorFor(dir);
    const sided: ArrowElement = {
      ...current,
      from: { kind: 'pinned', elementId: src.id, anchor },
      to: { kind: 'pinned', elementId: dst.id, anchor },
      exactStart: true,
      exactEnd: false,
    };
    next = next.map((el) => (el.id === loop.id ? sided : el));
    const [lo, hi] = [
      Math.min(spanOf(dst)[0], spanOf(src)[0]),
      Math.max(spanOf(dst)[1], spanOf(src)[1]),
    ];
    const between = solid.filter((b) => {
      const [s0, s1] = spanOf(b);
      return s1 >= lo && s0 <= hi;
    });
    const edge = (b: BoxedElement) => (dir === 1 ? crossOf(b)[1] : crossOf(b)[0]);
    let at =
      dir === 1
        ? Math.max(...between.map(edge)) + LOOP_CLEARANCE
        : Math.min(...between.map(edge)) - LOOP_CLEARANCE;
    for (const t of tracks)
      if (t.dir === dir && t.hi >= lo && t.lo <= hi)
        at = dir === 1 ? Math.max(at, t.at + LOOP_TRACK_GAP) : Math.min(at, t.at - LOOP_TRACK_GAP);
    tracks.push({ lo, hi, at, dir });
    routes.set(loop.id, { kind: 'track', axis, at });
  }
  return next;
}

// Up to this many boxes a detour is searched for (orthogonal-router.ts); past it, the outside track.
export const ROUTER_MAX_BOXES = 120;
const SIDES: readonly Side[] = ['n', 'e', 's', 'w'];

// A side's anchors, its middle first then its quarters.
const SIDE_ANCHORS: Readonly<Record<Side, readonly Anchor[]>> = {
  n: ['n', 'nnw', 'nne'],
  e: ['e', 'ene', 'ese'],
  s: ['s', 'ssw', 'sse'],
  w: ['w', 'wnw', 'wsw'],
};

// The anchors on each element some arrow already ends at.
function anchorsInUse(elements: readonly Element[]): Map<string, Set<Anchor>> {
  const used = new Map<string, Set<Anchor>>();
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    for (const end of [el.from, el.to])
      if (end.kind === 'pinned')
        (used.get(end.elementId) ?? used.set(end.elementId, new Set()).get(end.elementId)!).add(
          end.anchor,
        );
  }
  return used;
}

// The cheapest clean route between two boxes over every pair of sides, or null. Each end takes its side's middle,
// or a quarter of that side when another arrow already ends at the middle, so two arrows never meet in one point.
function bestRoute(
  src: BoxedElement,
  dst: BoxedElement,
  solid: readonly BoxedElement[],
  taken: readonly Run[],
  used: ReadonlyMap<string, ReadonlySet<Anchor>>,
  budget: RouterBudget,
): { fromAnchor: Anchor; toAnchor: Anchor; from: RoutePt; to: RoutePt; corners: RoutePt[] } | null {
  // The anchors free on a side: its middle when free, else its free quarters (the middle when none is free).
  const freeOn = (b: BoxedElement, side: Side): readonly Anchor[] => {
    const free = SIDE_ANCHORS[side].filter((a) => !used.get(b.id)?.has(a));
    if (free[0] === SIDE_ANCHORS[side][0]) return [free[0]!];
    return free.length ? free : [SIDE_ANCHORS[side][0]!];
  };
  let best: {
    fromAnchor: Anchor;
    toAnchor: Anchor;
    from: RoutePt;
    to: RoutePt;
    corners: RoutePt[];
    cost: number;
  } | null = null;
  for (const fromSide of SIDES)
    for (const toSide of SIDES)
      for (const fromAnchor of freeOn(src, fromSide))
        for (const toAnchor of freeOn(dst, toSide)) {
          const from = anchorPosition(src, fromAnchor);
          const to = anchorPosition(dst, toAnchor);
          const route = routeOrthogonal(from, fromSide, to, toSide, solid, taken, budget);
          if (route && (!best || route.cost < best.cost))
            best = { fromAnchor, toAnchor, from, to, corners: route.corners, cost: route.cost };
        }
  return best;
}

// Whether an arrow's drawn path (its ends and bends) passes through a box it does not connect.
function crossesABox(arrow: ArrowElement, elements: Element[], solid: RectGrid): boolean {
  const from = endAt(arrow, 'from', elements);
  const to = endAt(arrow, 'to', elements);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const bends = arrow.arrowStyle === 'angled' ? (arrow.curvePoints ?? []) : [];
  const path = [from, ...bends.map((p) => ({ x: mid.x + p.dx, y: mid.y + p.dy })), to];
  const ends = new Set([pinnedId(arrow.from), pinnedId(arrow.to)]);
  return path.slice(1).some((p, i) => {
    const a = path[i]!;
    const near = solid.near(
      Math.min(a.x, p.x),
      Math.min(a.y, p.y),
      Math.max(a.x, p.x),
      Math.max(a.y, p.y),
    ) as BoxedElement[];
    return near.some((b) => !ends.has(b.id) && segmentHitsBox(a, p, b));
  });
}

// Whether the segment a→b passes through `box` shrunk by `inset` (positive: grazing is not hitting; negative: the
// box grown, a clearance).
function segmentHitsBox(a: Pt, b: Pt, box: BoxedElement, inset = 4): boolean {
  const x0 = box.x + inset;
  const x1 = box.x + box.width - inset;
  const y0 = box.y + inset;
  const y1 = box.y + box.height - inset;
  // Most boxes lie wholly off the segment's own bounds: rejected before any clipping. A hot path (every routed arrow
  // against every box), so no arrays are made per call.
  if (Math.max(a.x, b.x) < x0 || Math.min(a.x, b.x) > x1) return false;
  if (Math.max(a.y, b.y) < y0 || Math.min(a.y, b.y) > y1) return false;
  // Liang-Barsky clip of the segment against the inset rectangle.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    return t0 <= t1;
  };
  return clip(-dx, a.x - x0) && clip(dx, x1 - a.x) && clip(-dy, a.y - y0) && clip(dy, y1 - a.y);
}

// A container (a frame, lane or boundary) is a backdrop the loop may cross; it never pushes the track out.
const isBackdrop = (b: BoxedElement) => b.type === 'shape' && isContainerKind(b.shape);

// The one-bend route for a loop whose source sits clear beyond its target's outer side, or null: up (TB) from the
// source's top to the target's middle, then into the target's outer side. Null when a box stands on either leg.
// The elements a fan at `a` or `b` depends on: those two boxes, every arrow pinned to either, and the elements at
// those arrows' far ends; in their drawing order, so the fan is the one the whole drawing gives.
export function fanNeighbourhood(elements: Element[], a: string, b: string): Element[] {
  const ids = new Set([a, b]);
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    const [f, t] = [pinnedId(el.from), pinnedId(el.to)];
    if (f !== a && f !== b && t !== a && t !== b) continue;
    ids.add(el.id);
    if (f) ids.add(f);
    if (t) ids.add(t);
  }
  return elements.filter((el) => ids.has(el.id));
}

function singleBend(
  arrow: ArrowElement,
  src: BoxedElement,
  dst: BoxedElement,
  boxes: BoxedElement[],
  axis: 'TB' | 'LR',
  elements: Element[],
): ArrowElement | null {
  const clear = axis === 'TB' ? src.x > dst.x + dst.width + 20 : src.y > dst.y + dst.height + 20;
  if (!clear) return null;
  const turned: ArrowElement = {
    ...arrow,
    from: { kind: 'pinned', elementId: src.id, anchor: axis === 'TB' ? 'n' : 'w' },
    to: { kind: 'pinned', elementId: dst.id, anchor: axis === 'TB' ? 'e' : 's' },
    exactStart: true,
    exactEnd: false,
  };
  // A fanned end moves only with the arrows pinned to its own box, so the ends are worked out on just those boxes,
  // the arrows touching them and the boxes at their far ends, in drawing order: the same fan, without fanning the
  // whole drawing once for every loop tried.
  const near = fanNeighbourhood(
    elements.map((el) => (el.id === arrow.id ? turned : el)),
    src.id,
    dst.id,
  );
  const from = endAt(turned, 'from', near);
  const to = endAt(turned, 'to', near);
  const corner = axis === 'TB' ? { x: from.x, y: to.y } : { x: to.x, y: from.y };
  const hits = (a: Pt, b: Pt) =>
    boxes.some((box) => {
      if (box.id === src.id || box.id === dst.id || isBackdrop(box)) return false;
      const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
      const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
      return (
        box.x < x1 + 4 &&
        box.x + box.width > x0 - 4 &&
        box.y < y1 + 4 &&
        box.y + box.height > y0 - 4
      );
    });
  if (hits(from, corner) || hits(corner, to)) return null;
  return turned;
}

// The spine straightened (docs/specs/015-api/mcp-server.md §4.7 "Flow lines are elbows"): the main path, from
// the first node nothing enters along each node's furthest-leading exit (side steps and loops aside), shares one
// centre line, as the template's happy path runs straight down one column. Each side step moves with the node that
// sends it out. A node that would then overlap another box stays where the layout put it.
export function straightenSpine(
  elements: Element[],
  nodes: readonly LookNode[],
  edges: readonly GraphEdge[],
  flat: ReadonlySet<string>,
  axis: 'TB' | 'LR',
): Element[] {
  const boxes = new Map(elements.filter(isBoxed).map((b) => [b.id, b as BoxedElement] as const));
  const main = (id: string) => {
    const b = boxes.get(id)!;
    return axis === 'TB' ? b.y + b.height / 2 : b.x + b.width / 2;
  };
  const cross = (b: BoxedElement) => (axis === 'TB' ? b.x + b.width / 2 : b.y + b.height / 2);
  const reach = reachOf(edges);
  const start = nodes.find((n) => boxes.has(n.id) && inCount(edges, n.id) === 0);
  if (!start) return elements;
  const spine: string[] = [start.id];
  const onSpine = new Set(spine);
  for (let at = start.id; ;) {
    const ways = outEdges(edges, at).filter(
      (e) =>
        !flat.has(edgeKey(e.from, e.to)) &&
        !onSpine.has(e.to) &&
        boxes.has(e.to) &&
        main(e.to) > main(at),
    );
    if (ways.length === 0) break;
    const labelled = ways.find((e) => MAIN_EXIT.test((e.label ?? '').trim()));
    const next = (labelled ?? [...ways].sort((a, b) => reach(b.to) - reach(a.to))[0]!).to;
    spine.push(next);
    onSpine.add(next);
    at = next;
  }
  if (spine.length < 3) return elements;
  const centres = spine.map((id) => cross(boxes.get(id)!)).sort((a, b) => a - b);
  const line = centres[Math.floor(centres.length / 2)]!;
  const moved = new Map<string, BoxedElement>();
  const overlaps = (b: BoxedElement, skip: ReadonlySet<string>) =>
    [...boxes.values()].some(
      (o) =>
        !skip.has(o.id) &&
        !isBackdrop(o) &&
        o.x < b.x + b.width &&
        o.x + o.width > b.x &&
        o.y < b.y + b.height &&
        o.y + o.height > b.y,
    );
  for (const id of spine) {
    const b = boxes.get(id)!;
    const delta = line - cross(b);
    if (Math.abs(delta) < 1) continue;
    const group = [
      id,
      ...outEdges(edges, id)
        .filter((e) => flat.has(edgeKey(e.from, e.to)))
        .map((e) => e.to),
    ];
    const shifted = group.map((gid) => {
      const g = boxes.get(gid)!;
      return axis === 'TB' ? { ...g, x: g.x + delta } : { ...g, y: g.y + delta };
    });
    const skip = new Set(group);
    if (shifted.some((g) => overlaps(g, skip))) continue;
    for (const g of shifted) {
      boxes.set(g.id, g);
      moved.set(g.id, g);
    }
  }
  if (moved.size === 0) return elements;
  return elements.map((el) => moved.get(el.id) ?? el);
}

// Rejoins into the spine from the side (the template's back-order joining at the receipt): an edge from a node
// beside the spine down to a later spine node leaves the source's bottom (TB) and enters the target's facing side,
// one bend, instead of fanning into the target's top beside the spine's own arrow.
export function sideRejoins(elements: Element[], axis: 'TB' | 'LR', routes: Routes): Element[] {
  const boxes = new Map(elements.filter(isBoxed).map((b) => [b.id, b as BoxedElement] as const));
  let next = elements;
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    const [f, t] = [pinnedId(el.from), pinnedId(el.to)];
    const [src, dst] = [f ? boxes.get(f) : undefined, t ? boxes.get(t) : undefined];
    if (!src || !dst) continue;
    const [sx0, sx1] = axis === 'TB' ? [src.x, src.x + src.width] : [src.y, src.y + src.height];
    const [dx0, dx1] = axis === 'TB' ? [dst.x, dst.x + dst.width] : [dst.y, dst.y + dst.height];
    const later = axis === 'TB' ? dst.y > src.y + src.height : dst.x > src.x + src.width;
    const right = sx0 > dx1;
    const left = sx1 < dx0;
    if (!later || (!right && !left)) continue;
    // Only into a node another arrow already enters from straight above: the spine's own way in.
    const spineIn = elements.some(
      (o) =>
        o.type === 'arrow' && o.id !== el.id && pinnedId(o.to) === dst.id && pinnedId(o.from) !== f,
    );
    if (!spineIn) continue;
    const turned: ArrowElement = {
      ...el,
      from: { kind: 'pinned', elementId: src.id, anchor: axis === 'TB' ? 's' : 'e' },
      to: {
        kind: 'pinned',
        elementId: dst.id,
        anchor: axis === 'TB' ? (right ? 'e' : 'w') : right ? 's' : 'n',
      },
      // The end fans with any other arrow entering that side (a loop), so the two never merge into one line.
      exactStart: true,
      exactEnd: false,
    };
    // Only when both legs run clear: down the source's own line, then across into the target.
    const a =
      axis === 'TB'
        ? { x: src.x + src.width / 2, y: src.y + src.height }
        : { x: src.x + src.width, y: src.y + src.height / 2 };
    const b =
      axis === 'TB'
        ? { x: right ? dst.x + dst.width : dst.x, y: dst.y + dst.height / 2 }
        : { x: dst.x + dst.width / 2, y: right ? dst.y + dst.height : dst.y };
    const corner = axis === 'TB' ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
    const blocked = [...boxes.values()].some(
      (o) =>
        o.id !== src.id &&
        o.id !== dst.id &&
        !isBackdrop(o) &&
        // A clearance, not just no overlap: a leg grazing a box's edge reads as part of it.
        (segmentHitsBox(a, corner, o, -12) || segmentHitsBox(corner, b, o, -12)),
    );
    if (blocked) continue;
    next = next.map((o) => (o.id === el.id ? turned : o));
    routes.set(el.id, { kind: 'corner', first: axis === 'TB' ? 'v' : 'h' });
  }
  return next;
}

// Space between two channels in one gap, and the bin bends fall into to count as one gap.
export const CHANNEL_GAP = 14;
const CHANNEL_BIN = 24;

// Elbows given channels of their own (docs/specs/015-api/mcp-server.md §4.7 "Flow lines are elbows"): every elbow
// between the same two ranks bent at the gap's middle, so arrows from different nodes ran down one line and read as
// joined. Within each gap the arrows of one source share a slot (its trunk) and so do the arrows into one target
// (its bus); every other arrow gets a slot of its own, CHANNEL_GAP apart around the middle, ordered so runs going the
// same way never cross: of those heading down (TB) or right (LR) the one starting nearest the far side bends first.
export function spreadChannels(elements: Element[], axis: 'TB' | 'LR'): Element[] {
  type Bent = { el: ArrowElement; from: Pt; to: Pt; at: number };
  const bent: Bent[] = [];
  for (const el of elements) {
    if (el.type !== 'arrow' || el.arrowStyle !== 'angled' || el.curvePoints?.length !== 2) continue;
    const from = endAt(el, 'from', elements);
    const to = endAt(el, 'to', elements);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const [a, b] = el.curvePoints.map((p) => ({ x: mid.x + p.dx, y: mid.y + p.dy }));
    // Only the down-across-down (TB) or right-down-right (LR) shape: both bends on one cross line.
    const at = axis === 'TB' ? a!.y : a!.x;
    if (Math.abs((axis === 'TB' ? b!.y : b!.x) - at) > 0.5) continue;
    bent.push({ el, from, to, at });
  }
  const gaps = new Map<number, Bent[]>();
  for (const b of bent)
    (
      gaps.get(Math.round(b.at / CHANNEL_BIN)) ??
      gaps.set(Math.round(b.at / CHANNEL_BIN), []).get(Math.round(b.at / CHANNEL_BIN))!
    ).push(b);
  const placed = new Map<string, number>();
  for (const group of gaps.values()) {
    // Slots: one per source trunk, a lone arrow into a shared target joining that target's bus.
    const slotOf = new Map<string, string>();
    const bySource = new Map<string, Bent[]>();
    for (const b of group) {
      const src = pinnedId(b.el.from) ?? b.el.id;
      (bySource.get(src) ?? bySource.set(src, []).get(src)!).push(b);
    }
    const intoTarget = new Map<string, Bent[]>();
    for (const b of group) {
      const dst = pinnedId(b.el.to) ?? b.el.id;
      (intoTarget.get(dst) ?? intoTarget.set(dst, []).get(dst)!).push(b);
    }
    for (const b of group) {
      const src = pinnedId(b.el.from) ?? b.el.id;
      const dst = pinnedId(b.el.to) ?? b.el.id;
      slotOf.set(
        b.el.id,
        bySource.get(src)!.length > 1 || intoTarget.get(dst)!.length < 2 ? `s:${src}` : `t:${dst}`,
      );
    }
    const slots = [...new Set(group.map((b) => slotOf.get(b.el.id)!))];
    if (slots.length < 2) continue;
    const cross = (p: Pt) => (axis === 'TB' ? p.x : p.y);
    // Each slot's way across and where its runs start: heading toward larger cross, or smaller.
    const info = slots.map((slot) => {
      const members = group.filter((b) => slotOf.get(b.el.id) === slot);
      const start = members.reduce((s, b) => s + cross(b.from), 0) / members.length;
      const end = members.reduce((s, b) => s + cross(b.to), 0) / members.length;
      return { slot, start, forward: end >= start };
    });
    // Toward larger cross: the run starting at the smaller cross bends last (farthest along the flow); away, mirrored.
    info.sort((p, q) =>
      p.forward !== q.forward
        ? p.forward
          ? 1
          : -1
        : p.forward
          ? q.start - p.start
          : p.start - q.start,
    );
    const centre = group.reduce((s, b) => s + b.at, 0) / group.length;
    info.forEach(({ slot }, i) =>
      placed.set(slot, centre + (i - (info.length - 1) / 2) * CHANNEL_GAP),
    );
    for (const b of group) placed.set(b.el.id, placed.get(slotOf.get(b.el.id)!)!);
  }
  if (placed.size === 0) return elements;
  return elements.map((el) => {
    const b = el.type === 'arrow' ? bent.find((x) => x.el.id === el.id) : undefined;
    const at = b ? placed.get(el.id) : undefined;
    if (!b || at === undefined) return el;
    const points =
      axis === 'TB'
        ? [
            { x: b.from.x, y: at },
            { x: b.to.x, y: at },
          ]
        : [
            { x: at, y: b.from.y },
            { x: at, y: b.to.y },
          ];
    return through(b.el, points, elements);
  });
}

// The parents in a tree whose children are all leaves, two or more, below the root: their leaves stack in a column
// under them, the compact org chart (docs/specs/015-api/mcp-server.md §4.7 "Layout choices"), instead of a row that
// makes a wide company four times wider than tall.
export function stackedParents(
  nodes: readonly LookNode[],
  edges: readonly GraphEdge[],
): Set<string> {
  const out = new Set<string>();
  for (const n of nodes) {
    const kids = outEdges(edges, n.id).map((e) => e.to);
    if (kids.length < 2 || inCount(edges, n.id) === 0) continue;
    if (kids.every((k) => outEdges(edges, k).length === 0 && inCount(edges, k) === 1))
      out.add(n.id);
  }
  return out;
}

// A stacked parent's arrows as a bus: down from its lower-left quarter, then across into each leaf's left side.
export function stackBuses(
  elements: Element[],
  stacked: ReadonlySet<string>,
  routes: Routes,
): Element[] {
  return elements.map((el) => {
    if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') return el;
    if (!stacked.has(el.from.elementId)) return el;
    routes.set(el.id, { kind: 'corner', first: 'v' });
    return {
      ...el,
      from: { ...el.from, anchor: 'ssw' as const },
      to: { ...el.to, anchor: 'w' as const },
      exactStart: true,
      exactEnd: true,
    };
  });
}

// Labels on elbows (docs/specs/015-api/mcp-server.md §4.7 "Flow lines are elbows"): an elbow's midpoint sits on the
// channel it shares with its neighbours, so their labels landed on one another. Each labelled elbow puts its label
// on a run that is its own, no other labelled arrow running along it: the drop into its target first, then the leg
// out of its source, then its longest; centred on the run, on the line. Every label is given the width of its text,
// so a short caption stays on one line on a vertical run.
export function placeElbowLabels(elements: Element[]): Element[] {
  const labelled = elements.filter(
    (el): el is ArrowElement =>
      el.type === 'arrow' &&
      !!el.label &&
      el.arrowStyle === 'angled' &&
      (el.curvePoints?.length ?? 0) > 0,
  );
  if (labelled.length === 0) return elements;
  const pathOf = (a: ArrowElement): Pt[] => {
    const from = endAt(a, 'from', elements);
    const to = endAt(a, 'to', elements);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    return [from, ...a.curvePoints!.map((p) => ({ x: mid.x + p.dx, y: mid.y + p.dy })), to];
  };
  const paths = new Map(labelled.map((a) => [a.id, pathOf(a)]));
  const overlap = (p0: number, p1: number, q0: number, q1: number) =>
    Math.min(Math.max(p0, p1), Math.max(q0, q1)) > Math.max(Math.min(p0, p1), Math.min(q0, q1));
  // Whether a run (a to b) lies along a run of another labelled arrow: the same line within LABEL_CLEAR, overlapping.
  const shared = (id: string, a: Pt, b: Pt) =>
    labelled.some((o) => {
      if (o.id === id) return false;
      const q = paths.get(o.id)!;
      return q.slice(1).some((c, i) => {
        const d = q[i]!;
        if (Math.abs(a.x - b.x) < 1 && Math.abs(c.x - d.x) < 1 && Math.abs(a.x - c.x) < LABEL_CLEAR)
          return overlap(a.y, b.y, c.y, d.y);
        if (Math.abs(a.y - b.y) < 1 && Math.abs(c.y - d.y) < 1 && Math.abs(a.y - c.y) < LABEL_CLEAR)
          return overlap(a.x, b.x, c.x, d.x);
        return false;
      });
    });
  const placed = new Map<string, ArrowElement>();
  for (const a of labelled) {
    const pts = paths.get(a.id)!;
    const lens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y));
    const total = lens.reduce((s, l) => s + l, 0);
    if (total <= 0) continue;
    const last = lens.length - 1;
    const byLength = lens.map((_, i) => i).sort((p, q) => lens[q]! - lens[p]!);
    const seg =
      [last, 0, ...byLength].find((i) => lens[i]! > 30 && !shared(a.id, pts[i]!, pts[i + 1]!)) ??
      byLength[0]!;
    const before = lens.slice(0, seg).reduce((s, l) => s + l, 0);
    placed.set(a.id, {
      ...a,
      labelOffset: { t: Number(((before + lens[seg]! / 2) / total).toFixed(4)), offset: 0 },
      labelMaxWidth: Math.ceil(labelWidth(a.label!)),
    });
  }
  return elements.map((el) => placed.get(el.id) ?? el);
}

// How close two runs may be before a label on one would sit on the other: a label's height and some.
const LABEL_CLEAR = 22;

// A caption's one-line width at the arrow label's default size, with room for its plate.
const labelWidth = (label: string) => Math.min(260, label.length * 12 * 0.56 + 18);
