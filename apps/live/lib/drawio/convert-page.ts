// One draw.io page to livediagram elements
// (docs/specs/020-import-export/blueprints/drawio-import.md step 15): walk the
// layers depth-first in paint order, build each vertex, drop groups, skip
// hidden and collapsed content, then build the edges against the elements
// their ends became.

import {
  DEFAULT_LAYER_ID,
  DEFAULT_LAYER_NAME,
  MAX_ELEMENTS_PER_TAB,
  isBoxed,
  type BoxedElement,
  type Element,
  type Layer,
} from '@livediagram/document';
import {
  absoluteRect,
  originOf,
  type DrawioCell,
  type DrawioGraph,
  type Pt,
  type Rect,
} from './cells';
import { buildEntity, buildLane, buildTable } from './containers';
import { buildArrow, type EndTarget } from './edges';
import { readLabel } from './label';
import { classifyVertex } from './shapes';
import { buildVertex, type PageContext } from './vertices';

export type ConvertedPage = {
  elements: Element[];
  layers?: Layer[];
  backgroundColor?: string;
};

type Slot = Element | { edge: DrawioCell; layerId: string | undefined };

const clampRect = (r: Rect): Rect => ({
  x: r.x,
  y: r.y,
  width: Math.max(1, r.width),
  height: Math.max(1, r.height),
});

const isLabelCell = (c: DrawioCell) =>
  c.vertex && (c.style.has('edgeLabel') || c.style.has('text'));

export function convertPage(graph: DrawioGraph, ctx: PageContext): ConvertedPage {
  const cells = graph.cells;
  if (graph.backgroundImage) ctx.tally.add('image-unavailable');
  const cellToElement = new Map<string, BoxedElement>();
  // A consumed cell id → the cell that owns its element ('' = nothing does).
  const forward = new Map<string, string>();
  const visited = new Set<string>();
  const slots: Slot[] = [];
  const mint = () => crypto.randomUUID();

  const countSubtree = (id: string): number => {
    let n = 0;
    const stack = [...(cells.get(id)?.children ?? [])];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (visited.has(next)) continue;
      visited.add(next);
      n += 1;
      stack.push(...(cells.get(next)?.children ?? []));
    }
    return n;
  };

  const forwardSubtree = (id: string, to: string) => {
    for (const child of cells.get(id)?.children ?? []) {
      if (visited.has(child)) continue;
      visited.add(child);
      forward.set(child, to);
      forwardSubtree(child, to);
    }
  };

  // Layers: two or more become Tab.layers; one stays the implicit default.
  const layered = graph.layerIds.length >= 2;
  const layers: Layer[] = [];
  const layerIdOf = new Map<string, string>();
  graph.layerIds.forEach((cellId, i) => {
    const cell = cells.get(cellId)!;
    const id = i === 0 ? DEFAULT_LAYER_ID : `layer:${mint()}`;
    layerIdOf.set(cellId, id);
    const name = readLabel(cell.value, cell.html).plain;
    layers.push({
      id,
      name: name || (i === 0 ? DEFAULT_LAYER_NAME : `Layer ${i + 1}`),
      ...(cell.visible ? {} : { visible: false }),
      ...(cell.style.flag('locked') ? { locked: true } : {}),
    });
  });

  const place = (el: Element, layerId: string | undefined) => {
    slots.push(layered && layerId ? ({ ...el, layerId } as Element) : el);
  };

  const visit = (id: string, layerId: string | undefined) => {
    if (visited.has(id)) return;
    visited.add(id);
    const cell = cells.get(id);
    if (!cell) return;
    if (!cell.visible) {
      ctx.tally.add('hidden-skipped', 1 + countSubtree(id));
      forward.set(id, '');
      return;
    }
    if (cell.edge) {
      slots.push({ edge: cell, layerId });
      // Label children ride on the arrow; anything else on the edge is placed
      // after it (pass 2 knows where the edge runs).
      for (const child of cell.children) visited.add(child);
      return;
    }
    if (!cell.vertex) return;
    const rawRect = absoluteRect(graph, id);
    if (!rawRect || !cell.geometry) {
      ctx.tally.add('hidden-skipped', 1 + countSubtree(id)); // D20
      forward.set(id, '');
      return;
    }
    const rect = clampRect(rawRect);
    const cls = classifyVertex(cell, graph);
    const elementId = mint();

    if (cls.kind === 'group') {
      ctx.tally.add('group-flattened');
      forward.set(id, '');
      for (const child of cell.children) visit(child, layerId);
      return;
    }

    let built: BoxedElement | null;
    if (cls.kind === 'lane') built = buildLane(cell, rect, graph, ctx, elementId);
    else if (cls.kind === 'entity') built = buildEntity(cell, rect, graph, ctx, elementId);
    else if (cls.kind === 'table') {
      const { title, table } = buildTable(cell, rect, graph, ctx, {
        table: elementId,
        title: mint(),
      });
      built = table;
      if (title) place(title, layerId);
    } else {
      const el = buildVertex(cell, rect, cls, ctx, elementId);
      if (el && !isBoxed(el)) {
        place(el, layerId); // a line vertex is an arrow; nothing pins to it
        forward.set(id, '');
        forwardSubtree(id, '');
        return;
      }
      built = el;
    }
    if (!built) return;
    place(built, layerId);
    cellToElement.set(id, built);

    if (cls.kind === 'entity' || cls.kind === 'table') {
      forwardSubtree(id, id);
    } else if (cell.collapsed) {
      ctx.tally.add('collapsed-skipped', countSubtree(id));
      // countSubtree marked them visited; their connections land on the container.
      forwardSubtreeAll(cells, id, forward);
    } else {
      for (const child of cell.children) visit(child, layerId);
    }
  };

  for (const layerCell of graph.layerIds) {
    for (const child of cells.get(layerCell)!.children) visit(child, layerIdOf.get(layerCell));
  }

  // Pass 2: edges, in their paint positions.
  const resolve = (cellId: string | undefined, fallback: Pt | undefined): EndTarget | null => {
    if (!cellId) return null;
    let id = cellId;
    for (let hops = 0; forward.has(id) && hops < cells.size; hops++) {
      const next = forward.get(id)!;
      if (next === '') break;
      id = next;
    }
    const element = cellToElement.get(id);
    if (element) return { kind: 'element', element };
    const cell = cells.get(id);
    if (cell?.edge) return { kind: 'point', at: edgeMidpoint(cell), loosened: true };
    const rect = absoluteRect(graph, id);
    const at = rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : fallback;
    return { kind: 'point', at: at ?? { x: 0, y: 0 }, loosened: true };
  };

  const edgeMidpoint = (edge: DrawioCell): Pt => {
    const ends = [edge.source, edge.target]
      .map((id) => (id ? cellToElement.get(id) : undefined))
      .filter((e): e is BoxedElement => !!e)
      .map((e) => ({ x: e.x + e.width / 2, y: e.y + e.height / 2 }));
    const origin = originOf(graph, edge.parentId);
    const pts = ends.length === 2 ? ends : (edge.geometry?.points ?? []).map((p) => add(p, origin));
    if (pts.length === 0) return origin;
    return {
      x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
      y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
    };
  };

  const elements: Element[] = [];
  for (const slot of slots) {
    if (!('edge' in slot)) {
      elements.push(slot);
      continue;
    }
    const edge = slot.edge;
    const origin = originOf(graph, edge.parentId);
    const geo = edge.geometry;
    const sourcePoint = geo?.sourcePoint ? add(geo.sourcePoint, origin) : undefined;
    const targetPoint = geo?.targetPoint ? add(geo.targetPoint, origin) : undefined;
    const source = resolve(edge.source, sourcePoint) ?? {
      kind: 'point' as const,
      at: sourcePoint ?? origin,
      loosened: false,
    };
    const target = resolve(edge.target, targetPoint) ?? {
      kind: 'point' as const,
      at: targetPoint ?? origin,
      loosened: false,
    };
    const childCells = edge.children.map((id) => cells.get(id)!).filter((c) => c.visible);
    const arrow = buildArrow(
      {
        cell: edge,
        source,
        target,
        waypoints: (geo?.points ?? []).map((p) => add(p, origin)),
        labels: childCells.filter(isLabelCell),
      },
      ctx,
      mint(),
    );
    elements.push(layered && slot.layerId ? { ...arrow, layerId: slot.layerId } : arrow);
    // A shape riding on the edge (not a label): placed at its spot along the
    // straight line between the ends.
    for (const child of childCells.filter((c) => !isLabelCell(c) && c.vertex && c.geometry)) {
      const from = source.kind === 'element' ? centreOf(source.element) : source.at;
      const to = target.kind === 'element' ? centreOf(target.element) : target.at;
      const t = (child.geometry!.x + 1) / 2;
      const at = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      const rect = clampRect({
        x: at.x - child.geometry!.width / 2 + (child.geometry!.offset?.x ?? 0),
        y: at.y - child.geometry!.height / 2 + child.geometry!.y + (child.geometry!.offset?.y ?? 0),
        width: child.geometry!.width,
        height: child.geometry!.height,
      });
      const el = buildVertex(child, rect, classifyVertex(child, graph), ctx, mint());
      if (el)
        elements.push(layered && slot.layerId ? ({ ...el, layerId: slot.layerId } as Element) : el);
    }
  }

  if (elements.length > MAX_ELEMENTS_PER_TAB) {
    ctx.tally.add('content-truncated', elements.length - MAX_ELEMENTS_PER_TAB);
    elements.length = MAX_ELEMENTS_PER_TAB;
  }

  return {
    elements,
    ...(layered ? { layers } : {}),
    // White is draw.io's default paper, so it stays unset and the theme decides.
    ...(graph.background && !WHITE.has(graph.background)
      ? { backgroundColor: graph.background }
      : {}),
  };
}

const WHITE = new Set(['#fff', '#ffffff', '#ffffffff']);
const add = (p: Pt, o: Pt): Pt => ({ x: p.x + o.x, y: p.y + o.y });
const centreOf = (el: BoxedElement): Pt => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

// Forward every descendant of a collapsed container to it, visited or not.
function forwardSubtreeAll(
  cells: Map<string, DrawioCell>,
  id: string,
  forward: Map<string, string>,
): void {
  const stack = [...(cells.get(id)?.children ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const next = stack.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    forward.set(next, id);
    stack.push(...(cells.get(next)?.children ?? []));
  }
}
