// The editor's Tidy Up profile of Auto Layout (docs/specs/008-canvas/layout-cleanup.md "Tidy Up
// keeps a flowchart a flowchart"). Graph input (the MCP, imports) hands the layout a bare graph;
// the editor hands it an author's drawing, which already says a lot the layout must keep:
//
//   - Sizes stay as drawn. Peer sizing squared every diamond into a box twice its height and grew
//     every step to the widest one's width.
//   - The flow's direction is read from how most arrows run, not from their summed lengths, which
//     long loop arrows tipped sideways.
//   - Flow layouts rank with side steps and drawn-order loops (auto-layout-tidy-rank.ts) and route
//     every arrow square (auto-layout-route.ts); the tree routes square too, the mindmap keeps its
//     straight spokes.
//   - The block starts where the nodes were (not where the title above them starts) and is then
//     nudged the shortest way clear of the boxes it does not move: a title, a key, a note.
//
// Pure; same input, same output.

import { isBoxed, type ArrowElement, type Element, type ElementId } from './index';
import { tidyGraph } from './auto-layout-tidy-graph';
import {
  rectsIntersect,
  unionRects,
  type Rect,
} from '@liveworkspace/document-core/geometry-primitives';
import {
  COMPONENT_GAP,
  components,
  reanchorArrow,
  type Edge,
  type PlacedComponent,
  type Pt,
  type Size,
} from './auto-layout-shared';
import type { AutoLayoutOptions, LayoutDirection } from './auto-layout';
import { positionTreeComponent } from './auto-layout-tree';
import { positionMindmapComponent } from './auto-layout-mindmap';
import { positionTidyFlowComponent } from './auto-layout-tidy-flow';
import { rankTidyComponent } from './auto-layout-tidy-rank';
import { routeTidyArrows, type RouteRequest } from './auto-layout-route';

// Room kept between the laid-out block and a box it does not move, and how many placements the
// search for a clear one tries before it settles for the nearest.
const TIDY_CLEARANCE = 24;
const MAX_PLACEMENT_TRIES = 400;
const GRID = 10;
const snapCentre = (lo: number, size: number) =>
  Math.round((lo + size / 2) / GRID) * GRID - size / 2;

// TB when most arrows run down rather than across. An arrow's own faces say it first: one that
// lands on a box's top or bottom runs down the flow whichever way it set off (a decision's exits
// leave by its sides and land on top of the steps below), one that lands on a side runs across.
// Only an arrow without a landing face is judged by where its ends are. Counting arrows rather than
// summing their lengths keeps a flowchart's one long loop arrow from turning it sideways.
export function tidyDirection(
  centers: Map<ElementId, Pt>,
  edges: (Edge & { toAnchor?: string })[],
): LayoutDirection {
  let down = 0;
  let across = 0;
  let vy = 0;
  let vx = 0;
  for (const e of edges) {
    const a = centers.get(e.from)!;
    const b = centers.get(e.to)!;
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    vx += dx;
    vy += dy;
    const face = e.toAnchor?.[0];
    if (face === 'n' || face === 's') down++;
    else if (face === 'e' || face === 'w') across++;
    else if (dy > dx) down++;
    else if (dx > dy) across++;
  }
  if (down !== across) return down > across ? 'TB' : 'LR';
  return vx > vy ? 'LR' : 'TB';
}

// A mindmap is branches around a centre: every node reached one way only. On a graph that loops
// back on itself (a flowchart's retry, an org chart's dotted line) the spokes cross the map and read
// as nothing, so the style is not offered there.
export function tidyMindmapFits(elements: Element[], lockedIds?: ReadonlySet<ElementId>): boolean {
  const { rects, edges } = tidyGraph(elements, lockedIds);
  const pairs = new Set(
    edges.map((e) => (e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`)),
  );
  const comps = components([...rects.keys()], edges);
  return rects.size > 2 && pairs.size === rects.size - comps.length;
}

// The editor's Tidy Up (docs/specs/008-canvas/layout-cleanup.md "Tidy Up keeps a flowchart a
// flowchart"): an author's own drawing, not generated input. A separate entry from autoLayoutElements so
// the agent apply path never loads it. Origin options are ignored:
// the flow's first shape anchors the block.
export function tidyLayoutElements(
  elements: Element[],
  opts: Pick<AutoLayoutOptions, 'style' | 'direction' | 'lockedIds'> = {},
): Element[] {
  const locked = opts.lockedIds;
  const graph = tidyGraph(elements, locked);
  const { rects, edges, moverOf, units } = graph;
  const ids = [...rects.keys()];
  if (ids.length === 0) return elements;

  const style = opts.style ?? 'flow';
  const size = new Map<ElementId, Size>(
    ids.map((id) => [id, { w: rects.get(id)!.width, h: rects.get(id)!.height }]),
  );
  const centers = new Map<ElementId, Pt>(
    ids.map((id) => {
      const r = rects.get(id)!;
      return [id, { x: r.x + r.width / 2, y: r.y + r.height / 2 }];
    }),
  );
  const dir: LayoutDirection =
    style === 'flow'
      ? (opts.direction ?? tidyDirection(graph.drawnCenters, graph.drawnEdges))
      : 'TB';
  const byId = new Map<ElementId, Element>(elements.map((e) => [e.id, e]));
  const isDecision = (id: ElementId) => {
    const el = byId.get(id);
    return !units.has(id) && el?.type === 'shape' && el.shape === 'diamond';
  };
  const labelOf = (e: Edge) => graph.labels.get(`${e.from}->${e.to}`);

  const comps = components(ids, edges);
  const compCross = (comp: ElementId[]) =>
    Math.min(...comp.map((id) => (dir === 'TB' ? centers.get(id)!.x : centers.get(id)!.y)));
  comps.sort((a, b) => compCross(a) - compCross(b));

  const local = new Map<ElementId, Pt>();
  const sideSteps = new Set<ElementId>();
  const laneOf = new Map<string, number[]>();
  let crossCursor = 0;
  for (const comp of comps) {
    let placed: PlacedComponent;
    if (style === 'tree') {
      // A loop's way back is not a parent link: hang the tree off the edges that run with the flow.
      const { forward } = rankTidyComponent({ ids: comp, edges, centers, size, dir, isDecision });
      placed = positionTreeComponent(comp, forward, size, centers);
    } else if (style === 'mindmap') placed = positionMindmapComponent(comp, edges, size, centers);
    else {
      const flow = positionTidyFlowComponent(comp, edges, size, centers, dir, isDecision, labelOf);
      for (const id of flow.side.keys()) sideSteps.add(id);
      for (const [key, xs] of flow.lanes)
        laneOf.set(
          key,
          xs.map((x) => x + crossCursor),
        );
      placed = flow;
    }
    for (const id of comp) {
      const p = placed.pos.get(id)!;
      local.set(
        id,
        dir === 'TB' ? { x: p.x + crossCursor, y: p.y } : { x: p.x, y: p.y + crossCursor },
      );
    }
    crossCursor += (dir === 'TB' ? placed.width : placed.height) + COMPONENT_GAP;
  }

  // The flow's first shape (the first in reading order) stays where it is, its centre on the grid,
  // and the block hangs off it; then it steps the shortest way clear of what stays put. Anchoring on
  // one shape rather than the block's corner makes a second press land exactly where the first did.
  const anchor = [...ids].sort((a, b) => {
    const pa = local.get(a)!;
    const pb = local.get(b)!;
    return dir === 'TB' ? pa.y - pb.y || pa.x - pb.x : pa.x - pb.x || pa.y - pb.y;
  })[0]!;
  const anchorWas = rects.get(anchor)!;
  const rectAt = (id: ElementId, dx: number, dy: number): Rect => {
    const p = local.get(id)!;
    const s = size.get(id)!;
    return { x: p.x + dx, y: p.y + dy, width: s.w, height: s.h };
  };
  // Sizes are kept, so the anchor's new top-left is its old one with its centre on the grid.
  const dx0 = snapCentre(anchorWas.x, anchorWas.width) - local.get(anchor)!.x;
  const dy0 = snapCentre(anchorWas.y, anchorWas.height) - local.get(anchor)!.y;
  // What stays put and must stay uncovered: every box that does not move and does not already sit
  // under a node (a background the nodes were drawn on is not in the way).
  const nodeRects = [...rects.values()];
  const obstacles = elements
    .filter(isBoxed)
    .filter((e) => !moverOf.has(e.id) && !nodeRects.some((r) => rectsIntersect(e, r)));
  // Lanes and panels are read as one stack: nothing may land in the gaps between them.
  const placedRects = ids.map((id) => rectAt(id, 0, 0));
  const [dx, dy] = clearPlacement(
    units.size > 1 ? [unionRects(placedRects)!] : placedRects,
    obstacles,
    dx0,
    dy0,
  );

  // Centres land on the grid, so boxes that share a line keep sharing it whatever their sizes.
  const finalRect = new Map<ElementId, Rect>(
    ids.map((id) => {
      const r = rectAt(id, dx, dy);
      return [id, { ...r, x: snapCentre(r.x, r.width), y: snapCentre(r.y, r.height) }];
    }),
  );
  // How far each node moved; everything that moves with it moves the same.
  const shift = new Map<ElementId, Pt>();
  for (const id of ids) {
    const was = rects.get(id)!;
    const now = finalRect.get(id)!;
    shift.set(id, { x: now.x - was.x, y: now.y - was.y });
  }
  const shiftOf = (id: ElementId): Pt | undefined => {
    const m = moverOf.get(id);
    return m === undefined ? undefined : shift.get(m);
  };
  const unitShiftAt = (x: number, y: number): Pt | undefined => {
    for (const u of units) {
      const r = byId.get(u) as Rect;
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return shift.get(u);
    }
    return undefined;
  };
  const placed = elements.map((el): Element => {
    if (isBoxed(el)) {
      const d = shiftOf(el.id);
      return d && (d.x || d.y) ? { ...el, x: el.x + d.x, y: el.y + d.y } : el;
    }
    // A free end inside a unit (a note's pointer drawn in a panel) travels with the unit.
    if (el.type === 'arrow' && !locked?.has(el.id)) {
      const move = (ep: ArrowElement['from']): ArrowElement['from'] => {
        if (ep.kind !== 'free') return ep;
        const d = unitShiftAt(ep.x, ep.y);
        return d ? { kind: 'free', x: ep.x + d.x, y: ep.y + d.y } : ep;
      };
      const from = move(el.from);
      const to = move(el.to);
      return from === el.from && to === el.to ? el : { ...el, from, to };
    }
    return el;
  });

  // Arrows between two different nodes, unless locked: an arrow inside a unit moves with it as drawn.
  const nodeOfEnd = (ep: ArrowElement['from']) =>
    ep.kind === 'pinned' ? moverOf.get(ep.elementId) : undefined;
  const routable = elements.filter(
    (a): a is ArrowElement =>
      a.type === 'arrow' &&
      !locked?.has(a.id) &&
      a.from.kind === 'pinned' &&
      a.to.kind === 'pinned' &&
      finalRect.has(nodeOfEnd(a.from) ?? '') &&
      finalRect.has(nodeOfEnd(a.to) ?? '') &&
      nodeOfEnd(a.from) !== nodeOfEnd(a.to),
  );
  const placedById = new Map(placed.map((e) => [e.id, e]));
  const portRect = (id: ElementId): Rect => placedById.get(id) as Rect;
  let rerouted: Map<ElementId, ArrowElement>;
  if (style === 'mindmap') {
    const finalCenters = new Map<ElementId, Pt>();
    for (const el of placed)
      if (isBoxed(el)) finalCenters.set(el.id, { x: el.x + el.width / 2, y: el.y + el.height / 2 });
    rerouted = new Map(routable.map((a) => [a.id, reanchorArrow(a, finalCenters)]));
  } else {
    const laneShift = dir === 'TB' ? dx : dy;
    const requests: RouteRequest[] = routable.map((a) => {
      const fromEl = (a.from as { elementId: ElementId }).elementId;
      const toEl = (a.to as { elementId: ElementId }).elementId;
      const from = nodeOfEnd(a.from)!;
      const to = nodeOfEnd(a.to)!;
      const lanes = laneOf.get(`${from}->${to}`);
      return {
        arrow: a,
        from,
        to,
        fromPort: { id: fromEl, rect: portRect(fromEl) },
        toPort: { id: toEl, rect: portRect(toEl) },
        ...(lanes ? { lanes: lanes.map((x) => x + laneShift) } : {}),
      };
    });
    const decisions = new Set(
      elements.filter((e) => e.type === 'shape' && e.shape === 'diamond').map((e) => e.id),
    );
    rerouted = routeTidyArrows({
      dir,
      nodes: finalRect,
      obstacles,
      sideSteps,
      decisions,
      requests,
    });
  }
  return placed.map((el) => rerouted.get(el.id) ?? el);
}

// The translation nearest (dx0, dy0) that keeps every rect a clearance away from every obstacle.
// Candidates are the offsets that just clear one overlap, explored nearest first; with no clear
// placement in reach the block stays at (dx0, dy0), and the caller's assessment reports what it
// covers.
export function clearPlacement(
  rects: Rect[],
  obstacles: Rect[],
  dx0: number,
  dy0: number,
): [number, number] {
  if (obstacles.length === 0) return [dx0, dy0];
  const pad = TIDY_CLEARANCE;
  const firstHit = (dx: number, dy: number): [Rect, Rect] | null => {
    for (const r of rects) {
      const g = {
        x: r.x + dx - pad,
        y: r.y + dy - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      };
      for (const o of obstacles) if (rectsIntersect(g, o)) return [g, o];
    }
    return null;
  };
  const seen = new Set<string>();
  const queue: [number, number][] = [[dx0, dy0]];
  // Up and left cost more: that is where a title and its caption sit, and where a reader looks
  // back to rather than on to.
  const dist = ([x, y]: [number, number]) =>
    (x < dx0 ? 3 : 1) * Math.abs(x - dx0) + (y < dy0 ? 3 : 1) * Math.abs(y - dy0);
  for (let tries = 0; queue.length && tries < MAX_PLACEMENT_TRIES; tries++) {
    queue.sort((a, b) => dist(a) - dist(b));
    const [dx, dy] = queue.shift()!;
    const hit = firstHit(dx, dy);
    if (!hit) return [dx, dy];
    const [g, o] = hit;
    // Whole grid steps, so the block's centres stay on the grid and a second press finds it clear.
    const up = (v: number) => Math.ceil((v + 1) / GRID) * GRID;
    const steps: [number, number][] = [
      [dx + up(o.x + o.width - g.x), dy],
      [dx - up(g.x + g.width - o.x), dy],
      [dx, dy + up(o.y + o.height - g.y)],
      [dx, dy - up(g.y + g.height - o.y)],
    ];
    for (const s of steps) {
      const key = `${Math.round(s[0])},${Math.round(s[1])}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(s);
    }
  }
  return [dx0, dy0];
}
