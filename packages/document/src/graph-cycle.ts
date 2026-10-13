// The cycle layout (docs/specs/015-api/mcp-server.md §4.7 `style: "cycle"`): the nodes in a ring, in order
// clockwise from the top, each edge a curved arrow that follows the ring's own arc. A node with no edge at all sits
// at the ring's centre (the theme a cycle turns around, as the flywheel template's hub). A node given no shape is a
// circle, the cycle's usual stop.

import { edgeToArrow, graphToElements, type DiagramGraph, type GraphLook } from './graph-authoring';
import { reanchorArrow, type Pt } from './auto-layout-shared';
import { isBoxed, type BoxedElement, type Element } from './index';

// Room between two stops along the ring, and the smallest ring.
const RING_GAP = 72;
const RING_MIN_R = 200;

export function layoutCycle(
  graph: DiagramGraph,
  opts: { look: GraphLook; makeEdgeId?: (() => string) | undefined },
): Element[] {
  const makeEdgeId = opts.makeEdgeId ?? (() => crypto.randomUUID());
  const wired = new Set(graph.edges.flatMap((e) => [e.from, e.to]));
  const nodes = graph.nodes.map((n) => (n.shape ? n : { ...n, shape: 'circle' }));
  const boxes = graphToElements({ nodes, edges: [] }, makeEdgeId, opts.look).filter(isBoxed);
  const ring = boxes.filter((b) => wired.has(b.id));
  const hubs = boxes.filter((b) => !wired.has(b.id));
  const n = Math.max(1, ring.length);
  const reach = Math.max(0, ...ring.map((b) => Math.hypot(b.width, b.height)));
  const r = Math.max(RING_MIN_R, (n * (reach + RING_GAP)) / (2 * Math.PI));
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const placed: BoxedElement[] = ring.map((b, i) => ({
    ...b,
    x: r * Math.cos(angle(i)) - b.width / 2,
    y: r * Math.sin(angle(i)) - b.height / 2,
  }));
  // Hubs stack at the centre.
  const hubH = hubs.reduce((h, b) => h + b.height, 0) + 16 * Math.max(0, hubs.length - 1);
  let hy = -hubH / 2;
  for (const b of hubs) {
    placed.push({ ...b, x: -b.width / 2, y: hy });
    hy += b.height + 16;
  }
  const at = new Map(placed.map((b) => [b.id, b]));
  const centers = new Map<string, Pt>(
    placed.map((b) => [b.id, { x: b.x + b.width / 2, y: b.y + b.height / 2 }]),
  );
  const arrows = graph.edges
    .filter((e) => at.has(e.from) && at.has(e.to) && e.from !== e.to)
    .map((e) => {
      const arrow = reanchorArrow(edgeToArrow(e, makeEdgeId()), centers);
      const a = centers.get(e.from)!;
      const b = centers.get(e.to)!;
      // Bow out to the ring's arc: the chord's midpoint pushed out to the circle through both centres.
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const len = Math.hypot(mid.x, mid.y);
      const onArc = len > 1 ? { x: (mid.x / len) * r, y: (mid.y / len) * r } : mid;
      return {
        ...arrow,
        arrowStyle: 'curved' as const,
        curveOffset: { dx: onArc.x - mid.x, dy: onArc.y - mid.y },
      };
    });
  return [...placed, ...arrows];
}
