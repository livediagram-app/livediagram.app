// The cycle layout (docs/specs/015-api/mcp-server.md §4.7 `style: "cycle"`): the nodes in a ring, in order
// clockwise from the top, each edge a curved arrow that follows the ring's own arc. A node with no edge at all sits
// at the ring's centre (the theme a cycle turns around, as the flywheel template's hub). A node given no shape is a
// circle, the cycle's usual stop.

import { edgeToArrow, graphToElements, type DiagramGraph, type GraphLook } from './graph-authoring';
import { reanchorArrow, type Pt } from './auto-layout-shared';
import { ALL_ANCHORS, isBoxed, type Anchor, type BoxedElement, type Element } from './index';

// Room between two stops along the ring, and the smallest ring.
const RING_GAP = 72;
const RING_MIN_R = 200;
// The room between two stacked hubs; how far the ring widens a step to clear them, and the most steps it takes (about
// 12,000px, past any hub stack a graph's node cap allows).
const HUB_GAP = 16;
const RING_GROW = 8;
const RING_GROW_STEPS = 1500;

export function layoutCycle(
  graph: DiagramGraph,
  opts: { look: GraphLook; makeEdgeId?: (() => string) | undefined },
): Element[] {
  const makeEdgeId = opts.makeEdgeId ?? (() => crypto.randomUUID());
  const wired = new Set(graph.edges.flatMap((e) => [e.from, e.to]));
  const nodes = graph.nodes.map((n) => (n.shape ? n : { ...n, shape: 'circle' }));
  // Stops and hubs sized apart: the look sizes boxes of one kind alike, and a round hub's longer label grew every stop.
  const sizedOf = (ns: typeof nodes) =>
    graphToElements({ nodes: ns, edges: [] }, makeEdgeId, opts.look).filter(isBoxed);
  const boxes = [
    ...sizedOf(nodes.filter((n) => wired.has(n.id))),
    ...sizedOf(nodes.filter((n) => !wired.has(n.id))),
  ];
  // Every stop one size, the largest any needs: a ring of uneven stops reads as a ranking.
  const sized = boxes.filter((b) => wired.has(b.id));
  const w = Math.max(0, ...sized.map((b) => b.width));
  const h = Math.max(0, ...sized.map((b) => b.height));
  const ring = sized.map((b) => ({ ...b, width: w, height: h }));
  const n = Math.max(1, ring.length);
  const reach = Math.hypot(w, h);
  let r = Math.max(RING_MIN_R, (n * (reach + RING_GAP)) / (2 * Math.PI));
  // A hub fits inside the ring with room for the arrows: a round hub wraps its label rather than ballooning.
  const hubMax = Math.max(140, 2 * r - reach - 2 * RING_GAP);
  const hubs = boxes
    .filter((b) => !wired.has(b.id))
    .map((b) => {
      if (b.width <= hubMax) return b;
      const side = b.type === 'shape' && b.shape === 'circle';
      return {
        ...b,
        width: hubMax,
        height: side ? hubMax : b.height * Math.ceil(b.width / hubMax),
      };
    });
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  // Hubs stack at the centre. The ring widens until no stop comes within half a gap of the stack: sized by its stops
  // alone, three hubs under a three-stop ring ran into its top stop.
  const hubH = hubs.reduce((h, b) => h + b.height, 0) + HUB_GAP * Math.max(0, hubs.length - 1);
  const hubW = Math.max(0, ...hubs.map((b) => b.width));
  const clear = RING_GAP / 2;
  const meetsHubs = (radius: number) =>
    hubs.length > 0 &&
    ring.some((_, i) => {
      const cx = radius * Math.cos(angle(i));
      const cy = radius * Math.sin(angle(i));
      return Math.abs(cx) < (hubW + w) / 2 + clear && Math.abs(cy) < (hubH + h) / 2 + clear;
    });
  for (let i = 0; i < RING_GROW_STEPS && meetsHubs(r); i++) r += RING_GROW;
  const placed: BoxedElement[] = ring.map((b, i) => ({
    ...b,
    x: r * Math.cos(angle(i)) - b.width / 2,
    y: r * Math.sin(angle(i)) - b.height / 2,
  }));
  let hy = -hubH / 2;
  for (const b of hubs) {
    placed.push({ ...b, x: -b.width / 2, y: hy });
    hy += b.height + HUB_GAP;
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
      // Each end along the ring's tangent, toward the other: anchored by the chord, neighbours on the ring's side met
      // their circles side to side while those at its top met them top to bottom, and the arcs hooked and sagged.
      const sense = Math.sign(a.x * b.y - a.y * b.x) || 1;
      const tangent = (p: Pt, s: number) => ({ x: -p.y * s, y: p.x * s });
      return {
        ...arrow,
        from: { kind: 'pinned' as const, elementId: e.from, anchor: towards(tangent(a, sense)) },
        to: { kind: 'pinned' as const, elementId: e.to, anchor: towards(tangent(b, -sense)) },
        arrowStyle: 'curved' as const,
        curveOffset: { dx: onArc.x - mid.x, dy: onArc.y - mid.y },
      };
    });
  return [...placed, ...arrows];
}

// The anchor nearest a direction: the sixteen run clockwise from north, 22.5 degrees apart, and on a round stop they
// sit on its outline in those directions.
function towards(d: Pt): Anchor {
  const deg = (Math.atan2(d.y, d.x) * 180) / Math.PI + 90;
  return ALL_ANCHORS[((Math.round(deg / 22.5) % 16) + 16) % 16]!;
}
