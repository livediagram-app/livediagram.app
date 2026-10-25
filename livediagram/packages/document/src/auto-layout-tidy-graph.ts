// The graph the editor's Tidy Up lays out (docs/specs/008-canvas/layout-cleanup.md "What moves
// together"). An author's tab is not a bare graph: shapes sit in lanes and panels, badges and chips
// sit on shapes, and moving each box on its own tore those apart. So before layout the tab is read
// as a graph of NODES, each one of:
//
//   - a unit: a box that holds wired shapes (a department panel, a lane, a group card, a state
//     machine's composite state). It moves as one rigid block with everything inside it, and the
//     arrows into it, or into the shapes it holds, are its edges. Only the outermost such box is a
//     unit.
//   - a wired shape outside any unit.
//
// Riders go with a free node: a smaller unwired box overlapping it (an icon badge, a "Usually 1
// day" chip, a caption laid over it). Pure.

import {
  isBoxed,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type ElementId,
} from './index';
import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { buildEdges, type Edge } from './auto-layout-shared';

type TidyGraph = {
  /** Node id → its box now. A unit's id is its container's. */
  rects: Map<ElementId, Rect>;
  /** Directed node edges that shape the layout (solid arrows), deduplicated, with no self-loops. */
  edges: Edge[];
  /** Element id → the node it moves with (a unit's members, a node itself, its riders). */
  moverOf: Map<ElementId, ElementId>;
  /** Unit ids. */
  units: Set<ElementId>;
  /** Each node edge's label, `from->to`, from the first labelled arrow along it. */
  labels: Map<string, string>;
  /** The flow direction the drawing's own arrows read in, shape to shape (not unit to unit). */
  drawnCenters: Map<ElementId, { x: number; y: number }>;
  drawnEdges: (Edge & { toAnchor: string })[];
};

const area = (r: Rect) => r.width * r.height;
const inside = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

export function tidyGraph(elements: Element[], locked?: ReadonlySet<ElementId>): TidyGraph {
  const boxes = elements.filter(isBoxed);
  const movable = boxes.filter((b) => !locked?.has(b.id));
  const arrows = elements.filter((e): e is ArrowElement => e.type === 'arrow');
  const wiredEdges = buildEdges(arrows, new Set(movable.map((b) => b.id)));
  const wired = new Set<ElementId>();
  for (const e of wiredEdges) wired.add(e.from).add(e.to);
  const wiredBoxes = movable.filter((b) => wired.has(b.id));

  // Units: unwired boxes holding a wired shape, outermost only. A box holding a locked element
  // cannot move as a block, so it is not one.
  const holders = movable.filter(
    (c) =>
      wiredBoxes.some((w) => area(c) > area(w) && inside(c, w)) &&
      !boxes.some((b) => b.id !== c.id && locked?.has(b.id) && inside(c, b)),
  );
  const unitBoxes = holders.filter(
    (c) => !holders.some((o) => o !== c && area(o) > area(c) && inside(o, c)),
  );
  const moverOf = new Map<ElementId, ElementId>();
  for (const u of unitBoxes) {
    moverOf.set(u.id, u.id);
    for (const b of movable)
      if (b.id !== u.id && !moverOf.has(b.id) && area(u) > area(b) && inside(u, b))
        moverOf.set(b.id, u.id);
  }
  const free = wiredBoxes.filter((w) => !moverOf.has(w.id));
  for (const w of free) moverOf.set(w.id, w.id);
  for (const [rider, host] of ridersOf(movable, free, moverOf)) moverOf.set(rider, host);

  // A dashed or dotted arrow is a secondary link by convention (a dotted-line report, an async
  // call): it is routed with the rest but does not shape the layout, unless every arrow is one.
  const solid: Edge[] = [];
  const soft: Edge[] = [];
  const labels = new Map<string, string>();
  const seen = new Set<string>();
  for (const a of arrows) {
    if (a.from.kind !== 'pinned' || a.to.kind !== 'pinned') continue;
    if (!wired.has(a.from.elementId) || !wired.has(a.to.elementId)) continue;
    const from = moverOf.get(a.from.elementId);
    const to = moverOf.get(a.to.elementId);
    if (!from || !to || from === to) continue;
    const key = `${from}->${to}`;
    if (a.label && !labels.has(key)) labels.set(key, a.label);
    const isSoft = (a.strokeStyle ?? 'solid') !== 'solid';
    if (seen.has(key + isSoft)) continue;
    seen.add(key + isSoft);
    (isSoft ? soft : solid).push({ from, to });
  }
  const solidKeys = new Set(solid.map((e) => `${e.from}->${e.to}`));
  const edges = solid.length ? solid : soft.filter((e) => !solidKeys.has(`${e.from}->${e.to}`));
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const rects = new Map<ElementId, Rect>();
  for (const e of [...solid, ...soft])
    for (const id of [e.from, e.to]) {
      const b = byId.get(id)!;
      rects.set(id, { x: b.x, y: b.y, width: b.width, height: b.height });
    }
  const drawnCenters = new Map(
    wiredBoxes.map((b) => [b.id, { x: b.x + b.width / 2, y: b.y + b.height / 2 }]),
  );
  return {
    rects,
    edges,
    moverOf,
    units: new Set(unitBoxes.map((u) => u.id)),
    labels,
    drawnCenters,
    drawnEdges: arrows.flatMap((a) =>
      a.from.kind === 'pinned' &&
      a.to.kind === 'pinned' &&
      a.from.elementId !== a.to.elementId &&
      drawnCenters.has(a.from.elementId) &&
      drawnCenters.has(a.to.elementId) &&
      // An arrow inside a unit says how the unit reads, not how the units flow.
      moverOf.get(a.from.elementId) !== moverOf.get(a.to.elementId)
        ? [{ from: a.from.elementId, to: a.to.elementId, toAnchor: a.to.anchor }]
        : [],
    ),
  };
}

// Each rider goes with the free node it overlaps most. A box as big as the node or bigger is a
// container or a neighbour, not a rider; a box already in a unit moves with the unit.
function ridersOf(
  movable: BoxedElement[],
  nodes: BoxedElement[],
  taken: Map<ElementId, ElementId>,
): Map<ElementId, ElementId> {
  const out = new Map<ElementId, ElementId>();
  for (const b of movable) {
    if (taken.has(b.id)) continue;
    let best: ElementId | null = null;
    let bestArea = 0;
    for (const n of nodes) {
      if (area(b) >= area(n)) continue;
      const w = Math.min(b.x + b.width, n.x + n.width) - Math.max(b.x, n.x);
      const h = Math.min(b.y + b.height, n.y + n.height) - Math.max(b.y, n.y);
      if (w <= 0 || h <= 0 || w * h <= bestArea) continue;
      best = n.id;
      bestArea = w * h;
    }
    if (best) out.set(b.id, best);
  }
  return out;
}
