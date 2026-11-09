// Which arrows a drag preview must redraw (docs/specs/008-canvas/drag-preview.md "The preview"): those
// the gesture reshapes, those pinned to a moved element, those riding on an affected arrow, and those
// a moved box crosses where it was or where it went (their route-behind gaps move).

import {
  buildElementIndex,
  elementIndexFor,
  endpointPosition,
  isBoxed,
  queryElementGrid,
  rectsIntersect,
  routeBehindHoles,
  resolveFinish,
  routeBehindQueryRect,
  type ArrowElement,
  type Element,
  type ElementGrid,
  type ElementIndex,
  type Rect,
} from '@liveplanner/project';
import type { DragOverlay } from '@/lib/drag-preview';
import { deriveArrowViewFrame, type ArrowViewFrame } from './arrow-view-frame';

export type ArrowLinks = {
  // Element id → the arrows with an end pinned to it, or riding on it (an arrow id).
  dependants: ReadonlyMap<string, readonly string[]>;
  // Each arrow's route-behind query rect, where a box could cut it.
  rects: ReadonlyMap<string, Rect>;
};

// Once per project change.
export function buildArrowLinks(elements: readonly Element[]): ArrowLinks {
  const index = buildElementIndex(elements as Element[]);
  const dependants = new Map<string, string[]>();
  const rects = new Map<string, Rect>();
  const depend = (on: string, arrowId: string) =>
    dependants.set(on, [...(dependants.get(on) ?? []), arrowId]);
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    for (const end of [el.from, el.to]) {
      if (end.kind === 'pinned') depend(end.elementId, el.id);
      else if (end.kind === 'on-arrow') depend(end.arrowId, el.id);
    }
    rects.set(
      el.id,
      routeBehindQueryRect(endpointPosition(el.from, index), endpointPosition(el.to, index)),
    );
  }
  return { dependants, rects };
}

// The arrows the moved boxes crossed where they were. Every frame of a gesture is laid over the same board and moves
// the same elements, so this holds for the whole gesture: found on its first frame, not again on every one.
let crossedBefore: {
  links: ArrowLinks;
  doc: readonly Element[];
  ids: readonly string[];
  crossed: readonly string[];
} | null = null;

function crossedWhereTheyWere(
  overlay: DragOverlay,
  doc: readonly Element[],
  links: ArrowLinks,
): readonly string[] {
  const c = crossedBefore;
  if (
    c &&
    c.links === links &&
    c.doc === doc &&
    c.ids.length === overlay.changed.size &&
    c.ids.every((id) => overlay.changed.has(id))
  )
    return c.crossed;
  // The board's cached index: `doc` is the same array on every frame of the gesture.
  const before = elementIndexFor(doc);
  const was: Rect[] = [];
  for (const id of overlay.changed.keys()) {
    const el = before.get(id);
    if (el && isBoxed(el)) was.push(el);
  }
  const crossed: string[] = [];
  if (was.length)
    for (const [id, rect] of links.rects)
      if (was.some((m) => rectsIntersect(m, rect))) crossed.push(id);
  crossedBefore = { links, doc, ids: [...overlay.changed.keys()], crossed };
  return crossed;
}

export function affectedArrows(
  overlay: DragOverlay,
  doc: readonly Element[],
  links: ArrowLinks,
): Set<string> {
  const out = new Set<string>();
  const queue: string[] = [];
  const add = (id: string) => {
    if (out.has(id)) return;
    out.add(id);
    queue.push(id);
  };
  const moved: Rect[] = [];
  for (const [id, el] of overlay.changed) {
    if (el.type === 'arrow') add(id);
    for (const dep of links.dependants.get(id) ?? []) add(dep);
    if (isBoxed(el)) moved.push(el);
  }
  for (const id of overlay.removed) for (const dep of links.dependants.get(id) ?? []) add(dep);
  // Where the moved boxes were crosses the same arrows on every frame of a gesture: found once.
  for (const id of crossedWhereTheyWere(overlay, doc, links)) add(id);
  if (moved.length) {
    for (const [id, rect] of links.rects) if (moved.some((m) => rectsIntersect(m, rect))) add(id);
  }
  // Arrows riding on an affected arrow follow it, transitively.
  while (queue.length) for (const dep of links.dependants.get(queue.shift()!) ?? []) add(dep);
  return out;
}

// An affected arrow's frame and holes while a preview lasts: ends resolved through `index` (the
// project's index with the previewed elements over it), holes cut by the grid's candidates as the
// project has them, minus what the gesture moved, plus the moved and added boxes where they are now.
export function previewArrowGeometry(
  arrow: ArrowElement,
  index: ElementIndex,
  grid: ElementGrid,
  overlay: DragOverlay,
  tabFinish?: unknown,
): { frame: ArrowViewFrame; holes: Rect[] } {
  const frame = deriveArrowViewFrame(arrow, index, resolveFinish(arrow.finish, tabFinish));
  const still = queryElementGrid(grid, routeBehindQueryRect(frame.from, frame.to)).filter(
    (el) => !overlay.changed.has(el.id) && !overlay.removed.has(el.id),
  );
  const moved = [...overlay.changed.values(), ...overlay.added.map((a) => a.el)].filter(isBoxed);
  return { frame, holes: routeBehindHoles(arrow, frame.from, frame.to, [...still, ...moved]) };
}
