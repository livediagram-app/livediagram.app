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
import { absoluteRect, type DrawioCell, type DrawioGraph, type Rect } from './cells';
import { buildEntity, buildLane, buildTable } from './containers';
import { createEdgeBuilder, type EdgeSlot } from './edge-pass';
import { cellLabel } from './label';
import { classifyVertex } from './shapes';
import { overlapTest } from './overlap';
import { pageScale, scalePage } from './scale';
import { autoTextRect, isAutoSized } from './text-box';
import { buildImageCaption, buildVertex, type PageContext } from './vertices';

export type ConvertedPage = {
  elements: Element[];
  layers?: Layer[];
  backgroundColor?: string;
};

type Slot = Element | EdgeSlot;

const clampRect = (r: Rect): Rect => ({
  x: r.x,
  y: r.y,
  width: Math.max(1, r.width),
  height: Math.max(1, r.height),
});

export function convertPage(graph: DrawioGraph, input: PageContext): ConvertedPage {
  const ctx: PageContext = {
    ...input,
    overlaps: overlapTest(graph),
    scale: input.scale ?? pageScale(graph),
  };
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
    const name = cellLabel(cell).plain;
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
    const cls = classifyVertex(cell, graph);
    // Text draw.io sizes to itself comes in sized to its text (blueprint step 15.3).
    const rect = clampRect(
      cls.kind === 'text' && isAutoSized(rawRect)
        ? autoTextRect(cell, rawRect, ctx.scale ?? 1)
        : rawRect,
    );
    const elementId = mint();

    if (cls.kind === 'group') {
      ctx.tally.add('group-flattened');
      forward.set(id, '');
      for (const child of cell.children) visit(child, layerId);
      return;
    }

    let built: BoxedElement | null;
    if (cls.kind === 'lane') built = buildLane(cell, rect, ctx, elementId);
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
    if (cls.kind === 'image') {
      const caption = buildImageCaption(cell, rect, ctx, mint());
      if (caption) place(caption, layerId);
    }

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
  const edges = createEdgeBuilder({
    graph,
    ctx,
    cellToElement,
    forward,
    slots: slots.filter((slot): slot is EdgeSlot => 'edge' in slot),
    mint,
    clampRect,
  });
  let elements: Element[] = [];
  for (const slot of slots) {
    if (!('edge' in slot)) {
      elements.push(slot);
      continue;
    }
    for (const el of edges.build(slot)) {
      elements.push(layered && slot.layerId ? ({ ...el, layerId: slot.layerId } as Element) : el);
    }
  }
  elements = edges.finish(elements);

  if (elements.length > MAX_ELEMENTS_PER_TAB) {
    ctx.tally.add('content-truncated', elements.length - MAX_ELEMENTS_PER_TAB);
    elements.length = MAX_ELEMENTS_PER_TAB;
  }

  return {
    elements: scalePage(elements, ctx.scale ?? 1),
    ...(layered ? { layers } : {}),
    // White is draw.io's default paper, so it stays unset and the theme decides.
    ...(graph.background && !WHITE.has(graph.background)
      ? { backgroundColor: graph.background }
      : {}),
  };
}

const WHITE = new Set(['#fff', '#ffffff', '#ffffffff']);

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
