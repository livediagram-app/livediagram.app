// The graph look (docs/specs/015-api/mcp-server.md §4.7 "The graph look"): what turns a laid-out graph into
// something that reads like the flowchart template. Pure passes over a graph and its laid-out elements:
//
//   - sideStepEdges: which decision exits sit level with their decision (fed to the layout as flat edges);
//   - withTones: start, end and decision roles, and a node's own tone and icon;
//   - routeLoops: edges back to an earlier rank go round the outside as elbows;
//   - the title, the caption and the key of shapes live beside it (graph-header.ts).
//   - placeElbowLabels, the last pass: each elbow's label on a run of its own (graph-look-labels.ts).
//
// Graph input only (graph-input.ts `layoutGraph`); the editor's Mermaid import and Tidy Up never run them.

import { edgeKey } from './auto-layout';
import { arrowRoutePoints } from './arrow-label-layout';
import { rectGrid } from '@liveworkspace/model-core/auto-layout-route-grid';
import { ROUTER_BUDGET, runsOf, type RouterBudget, type Run } from './orthogonal-router';
import {
  anchorsInUse,
  applyRoutes,
  bestRoute,
  crossesABox,
  isBackdrop,
  pinnedId,
  ROUTER_MAX_BOXES,
  singleBend,
  type Pt,
  type Routes,
} from './graph-look-routes';
import { isBoxed, type ArrowElement, type BoxedElement, type Element } from './index';

export {
  isFlowchart,
  sideStepEdges,
  TONE_PRESET,
  withTones,
  type GraphTone,
  type LookNode,
} from './graph-look-tones';
export {
  applyRoutes,
  fanNeighbourhood,
  segmentHitsBox,
  type Pt,
  type Route,
  type Routes,
} from './graph-look-routes';
export { sideRejoins, straightenSpine } from './graph-look-spine';
export { spreadChannels, stackBuses, stackedParents } from './graph-look-channels';

// How far outside the boxes a loop runs, and the space between two loops' tracks.
const LOOP_CLEARANCE = 40;
const LOOP_TRACK_GAP = 22;

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
  const boxes = new Map(elements.filter(isBoxed).map((b) => [b.id, b] as const));
  const solid = [...boxes.values()].filter((b) => !isBackdrop(b));
  // The solid boxes by place, so each arrow is tested against the boxes near its path, not every box.
  const solidGrid = rectGrid(solid, 0);
  // A group's frame is a wall to a route between two nodes outside it: threaded through the gaps between its
  // members, the line read as one of the group's own (docs/specs/015-api/mcp-server.md "Groups keep their lines
  // clear").
  const frames = [...boxes.values()].filter((b) => b.type === 'shape' && b.shape === 'frame');
  const holds = (f: BoxedElement, b: BoxedElement) =>
    f.id === b.id ||
    (b.x >= f.x &&
      b.y >= f.y &&
      b.x + b.width <= f.x + f.width &&
      b.y + b.height <= f.y + f.height);
  const wallsFor = (src: BoxedElement, dst: BoxedElement) =>
    frames.filter((f) => !holds(f, src) && !holds(f, dst));
  const frameGrid = rectGrid(frames, 0);
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
    if (backward(el) || crossesABox(el, elements, solidGrid)) return true;
    // A line through a group it does not join goes round it too, though it touches none of the group's members.
    const [src, dst] = [boxes.get(f)!, boxes.get(t)!];
    return (
      frames.length > 0 &&
      crossesABox(el, elements, frameGrid, (b) => holds(b, src) || holds(b, dst))
    );
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
  // The runs already drawn: every line this pass leaves alone, as it is drawn. A detour that ran along one (a long
  // "no" climbing the very line a "yes" climbs into its step) read as that line's; the router prices sharing them.
  const routing = new Set(loops.map((l) => l.id));
  const round = (p: Pt) => ({ x: Math.round(p.x), y: Math.round(p.y) });
  // Lines an earlier pass routed (a rejoin, a bus) are measured on their routes, not the elbows they still carry.
  const drawn = applyRoutes(elements, routes);
  const taken: Run[] = drawn
    .filter((el): el is ArrowElement => el.type === 'arrow' && !routing.has(el.id))
    .flatMap((a) => runsOf(arrowRoutePoints(a, drawn).map(round)));
  // Every route of this layout draws on one budget: spent, the rest take their outside tracks.
  const budget: RouterBudget = { left: ROUTER_BUDGET };
  let next = elements;
  for (const loop of ordered) {
    const src = boxes.get(pinnedId(loop.from)!)!;
    const dst = boxes.get(pinnedId(loop.to)!)!;
    const current = next.find((el) => el.id === loop.id) as ArrowElement;
    const obstacles = [...solid, ...wallsFor(src, dst)];
    // The router first, when the drawing is small enough to search: the cheapest clean path over every pair of
    // sides. Its ends sit exactly on the sides' midpoints, so the corners it finds are the ones drawn.
    const found =
      solid.length <= ROUTER_MAX_BOXES
        ? bestRoute(
            src,
            dst,
            obstacles,
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
    const single = backward(current) ? singleBend(current, src, dst, obstacles, axis, next) : null;
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
    const between = obstacles.filter((b) => {
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
