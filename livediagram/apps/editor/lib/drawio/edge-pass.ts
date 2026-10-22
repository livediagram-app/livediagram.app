// A page's edges as arrows (docs/specs/020-import-export/blueprints/drawio-import.md steps 12 and
// 15.7): each routed as draw.io routes it, its ends resolved to the elements, arrows or points they
// became, then any shape riding on it placed where draw.io places it. Ends on other arrows find
// their place along them once every arrow exists.

import {
  arrowStyleOf,
  buildElementIndex,
  endpointPosition,
  projectToArrow,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type Endpoint,
} from '@livediagram/document';
import { debugLog } from '@/lib/debug-log';
import { originOf, type DrawioCell, type DrawioGraph, type Pt, type Rect } from './cells';
import { buildArrow, type EndTarget } from './edges';
import { cellLabel } from './label';
import { childLabelPoint, edgeLabelPoint } from './route/label';
import { createPageRouter } from './route/page';
import { pointAlong, type CellState } from './route/state';
import { classifyVertex, isBoxedText } from './shapes';
import { buildVertex, type PageContext } from './vertices';

export type EdgeSlot = { edge: DrawioCell; layerId: string | undefined };

type EdgeContext = {
  graph: DrawioGraph;
  ctx: PageContext;
  /** Cell id → the boxed element it became. */
  cellToElement: Map<string, BoxedElement>;
  /** A consumed cell id → the cell that owns its element ('' = nothing does). */
  forward: Map<string, string>;
  /** The edges that will be built, in paint order. */
  slots: EdgeSlot[];
  mint: () => string;
  clampRect: (r: Rect) => Rect;
};

// Where draw.io centres the label the arrow's caption is placed by: the edge's own when it has
// text, else its first label child with text.
function labelPointOf(
  edge: DrawioCell,
  labels: DrawioCell[],
  state: CellState,
  origin: Pt,
): Pt | undefined {
  if (cellLabel(edge).plain !== '') return edgeLabelPoint(state, edge.geometry);
  const child = labels.find((c) => cellLabel(c).plain !== '' && c.geometry);
  return child ? childLabelPoint(state, child.geometry!, origin) : undefined;
}

const isLabelCell = (c: DrawioCell) =>
  c.vertex && (c.style.has('edgeLabel') || (c.style.has('text') && !isBoxedText(c.style)));

/** Builds each edge slot's arrow (and riding shapes); `finish` places ends that sit on arrows. */
export function createEdgeBuilder(input: EdgeContext) {
  const { graph, ctx, cellToElement, forward, mint } = input;
  const cells = graph.cells;
  const router = createPageRouter(graph);
  const arrowIdOf = new Map(input.slots.map((s) => [s.edge.id, mint()]));
  // Where each on-arrow end met its arrow in draw.io: arrow id → end → point.
  const onArrowPoints = new Map<string, { from?: Pt; to?: Pt }>();

  const resolve = (cellId: string | undefined): EndTarget => {
    if (!cellId) return { kind: 'point', loosened: false };
    let id = cellId;
    for (let hops = 0; forward.has(id) && hops < cells.size; hops++) {
      const next = forward.get(id)!;
      if (next === '') break;
      id = next;
    }
    const element = cellToElement.get(id);
    if (element) return { kind: 'element', element };
    const arrowId = cells.get(id)?.edge ? arrowIdOf.get(id) : undefined;
    if (arrowId) return { kind: 'arrow', arrowId };
    return { kind: 'point', loosened: true };
  };

  const build = (slot: EdgeSlot): Element[] => {
    const edge = slot.edge;
    const route = router(edge.id);
    if (!route) {
      debugLog('[drawio-route] edge has no route, left out', { edge: edge.id });
      return [];
    }
    const source = resolve(edge.source);
    const target = resolve(edge.target);
    const childCells = edge.children.map((id) => cells.get(id)!).filter((c) => c.visible);
    const id = arrowIdOf.get(edge.id)!;
    const labels = childCells.filter(isLabelCell);
    const arrow = buildArrow(
      {
        cell: edge,
        source,
        target,
        route: route.drawn,
        labels,
        labelAt: labelPointOf(edge, labels, route.state, originOf(graph, edge.parentId)),
      },
      ctx,
      id,
    );
    if (source.kind === 'arrow' || target.kind === 'arrow') {
      onArrowPoints.set(id, {
        ...(source.kind === 'arrow' ? { from: route.drawn[0]! } : {}),
        ...(target.kind === 'arrow' ? { to: route.drawn[route.drawn.length - 1]! } : {}),
      });
    }
    const out: Element[] = [arrow];
    // A shape riding on the edge (not a label): its corner where draw.io puts it along the route.
    for (const child of childCells.filter((c) => !isLabelCell(c) && c.vertex && c.geometry)) {
      const geo = child.geometry!;
      const at = pointAlong(route.state, geo.x, geo.y, geo.offset);
      const rect = input.clampRect({ x: at.x, y: at.y, width: geo.width, height: geo.height });
      const el = buildVertex(child, rect, classifyVertex(child, graph), ctx, mint());
      if (el) out.push(el);
    }
    return out;
  };

  /** Every end on another arrow, placed along that arrow's drawn line where draw.io met it; an
   *  end whose arrow did not land is freed there. */
  const finish = (elements: Element[]): Element[] => {
    if (onArrowPoints.size === 0) return elements;
    const index = buildElementIndex(elements);
    const place = (end: Endpoint, at: Pt | undefined): Endpoint => {
      if (end.kind !== 'on-arrow' || !at) return end;
      const host = index.get(end.arrowId);
      if (host?.type !== 'arrow') {
        ctx.tally.add('connection-loosened');
        return { kind: 'free', x: at.x, y: at.y };
      }
      const { t } = projectToArrow(
        arrowStyleOf(host),
        endpointPosition(host.from, index),
        endpointPosition(host.to, index),
        host.from,
        host.to,
        host.curveOffset,
        host.elbowOffset,
        at,
        host.curvePoints,
      );
      return { ...end, t };
    };
    return elements.map((el) => {
      const points = el.type === 'arrow' ? onArrowPoints.get(el.id) : undefined;
      if (!points) return el;
      const arrow = el as ArrowElement;
      return { ...arrow, from: place(arrow.from, points.from), to: place(arrow.to, points.to) };
    });
  };

  return { build, finish };
}
