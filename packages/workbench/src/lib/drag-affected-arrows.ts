// Which arrows a drag preview must redraw, and how (each editor's docs/specs/008-canvas/drag-preview.md "The
// preview"): those the gesture reshapes, those pinned to a moved element, those riding on an affected arrow, and
// those a moved box crosses where it was or where it went (their route-behind gaps move). Every editor that routes
// arrows behind boxes binds this once to its element model (its components/canvas/drag-affected-arrows.ts).
//
// Per frame the work is linear in what moved (canvas-performance.md "A frame's arrow work is linear in what moved"):
// each moved box asks a grid of the arrows' route-behind rects which arrows it meets, and each affected arrow asks a
// grid of the moved boxes which of them cut it, never every moved box for every arrow.

import type { Point, Rect } from '@liveworkspace/model-core/geometry-primitives';
import { buildRectGrid, eachRectMeeting, type RectGrid } from '@liveworkspace/model-core/rect-grid';

type Identified = { readonly id: string; readonly type: string };

// An arrow end as every product's model has it: free at a point, pinned to an element, or on another arrow.
export type DragArrowEnd =
  | { readonly kind: 'pinned'; readonly elementId: string }
  | { readonly kind: 'on-arrow'; readonly arrowId: string }
  | { readonly kind: string };

// What a preview lays over the board (each editor's lib/drag-preview.ts DragOverlay, as far as this reads it).
export type DragOverlayLike<E> = {
  readonly changed: ReadonlyMap<string, E>;
  readonly removed: ReadonlySet<string>;
  readonly added: readonly { readonly el: E }[];
};

export type ArrowLinks = {
  // Element id → the arrows with an end pinned to it, or riding on it (an arrow id).
  dependants: ReadonlyMap<string, readonly string[]>;
  // Each arrow's route-behind query rect, where a box could cut it, bucketed so a moved box asks only its
  // neighbourhood which arrows it crosses.
  rects: RectGrid;
};

// The product's model, as far as the preview's arrow work reads it.
export type DragArrowsModel<
  E extends Identified,
  A extends E,
  Index extends ReadonlyMap<string, E>,
  Grid,
  Frame extends { from: Point; to: Point },
> = {
  isBoxed: (el: E) => boolean;
  isArrow: (el: E) => el is A;
  ends: (arrow: A) => readonly [DragArrowEnd, DragArrowEnd];
  buildElementIndex: (elements: readonly E[]) => Index;
  // The board's cached index (by the array's identity).
  elementIndexFor: (elements: readonly E[]) => Index;
  endpointPosition: (end: DragArrowEnd, index: Index) => Point;
  routeBehindQueryRect: (from: Point, to: Point) => Rect;
  routeBehindHoles: (arrow: A, from: Point, to: Point, candidates: E[]) => Rect[];
  buildElementGrid: (elements: readonly E[]) => Grid;
  queryElementGrid: (grid: Grid, rect: Rect) => E[];
  // The arrow's drawn frame through `index`; `tabFinish` is the tab's finish, for an editor whose frames read it.
  frameOf: (arrow: A, index: Index, tabFinish?: unknown) => Frame;
};

export type DragAffectedArrows<E, A, Index, Grid, Frame> = {
  // Once per board change.
  buildArrowLinks: (elements: readonly E[]) => ArrowLinks;
  // `riding`, when given, is what the frame's ride carries (ridingElements): when it carries every arrow on the
  // board, none is affected and the moved boxes ask nothing (a move that rides whole).
  affectedArrows: (
    overlay: DragOverlayLike<E>,
    doc: readonly E[],
    links: ArrowLinks,
    riding?: ReadonlyMap<string, unknown>,
  ) => Set<string>;
  // The boxes a preview moved or added, where they are now, in a grid of their own: built once per preview change, so
  // each affected arrow asks it about its own rect instead of scanning every moved box.
  movedBoxesGrid: (overlay: DragOverlayLike<E>) => Grid;
  // An affected arrow's frame and holes while a preview lasts: ends resolved through `index` (the board's index with
  // the previewed elements over it), holes cut by the grid's candidates as the board has them, minus what the gesture
  // moved, plus the moved and added boxes where they are now (`moved`, from movedBoxesGrid).
  previewArrowGeometry: (
    arrow: A,
    index: Index,
    grid: Grid,
    overlay: DragOverlayLike<E>,
    moved: Grid,
    tabFinish?: unknown,
  ) => { frame: Frame; holes: Rect[] };
};

export function createDragAffectedArrows<
  E extends Identified,
  A extends E,
  Index extends ReadonlyMap<string, E>,
  Grid,
  Frame extends { from: Point; to: Point },
>(model: DragArrowsModel<E, A, Index, Grid, Frame>): DragAffectedArrows<E, A, Index, Grid, Frame> {
  const boxOf = (el: E): Rect => el as unknown as Rect;

  function buildArrowLinks(elements: readonly E[]): ArrowLinks {
    const index = model.buildElementIndex(elements);
    const dependants = new Map<string, string[]>();
    const rects = new Map<string, Rect>();
    const depend = (on: string, arrowId: string) => {
      const list = dependants.get(on);
      if (list) list.push(arrowId);
      else dependants.set(on, [arrowId]);
    };
    for (const el of elements) {
      if (!model.isArrow(el)) continue;
      const [from, to] = model.ends(el);
      for (const end of [from, to]) {
        if (end.kind === 'pinned') depend((end as { elementId: string }).elementId, el.id);
        else if (end.kind === 'on-arrow') depend((end as { arrowId: string }).arrowId, el.id);
      }
      rects.set(
        el.id,
        model.routeBehindQueryRect(
          model.endpointPosition(from, index),
          model.endpointPosition(to, index),
        ),
      );
    }
    return { dependants, rects: buildRectGrid(rects) };
  }

  // The arrows the moved boxes crossed where they were. Every frame of a gesture is laid over the same board and
  // moves the same elements, so this holds for the whole gesture: found on its first frame, not again on every one.
  let crossedBefore: {
    links: ArrowLinks;
    doc: readonly E[];
    ids: readonly string[];
    crossed: readonly string[];
  } | null = null;

  function crossedWhereTheyWere(
    overlay: DragOverlayLike<E>,
    doc: readonly E[],
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
    const before = model.elementIndexFor(doc);
    const crossed: string[] = [];
    const seen = new Set<string>();
    for (const id of overlay.changed.keys()) {
      const was = before.get(id);
      if (was && model.isBoxed(was))
        eachRectMeeting(links.rects, boxOf(was), seen, (hit) => crossed.push(hit));
    }
    crossedBefore = { links, doc, ids: [...overlay.changed.keys()], crossed };
    return crossed;
  }

  function affectedArrows(
    overlay: DragOverlayLike<E>,
    doc: readonly E[],
    links: ArrowLinks,
    riding?: ReadonlyMap<string, unknown>,
  ): Set<string> {
    const out = new Set<string>();
    if (riding && riding.size >= links.rects.rects.size) {
      let ridingArrows = 0;
      for (const id of riding.keys()) if (links.rects.rects.has(id)) ridingArrows++;
      if (ridingArrows === links.rects.rects.size) return out;
    }
    const queue: string[] = [];
    const add = (id: string) => {
      if (out.has(id)) return;
      out.add(id);
      queue.push(id);
    };
    for (const [id, el] of overlay.changed) {
      if (model.isArrow(el)) add(id);
      for (const dep of links.dependants.get(id) ?? []) add(dep);
    }
    for (const id of overlay.removed) for (const dep of links.dependants.get(id) ?? []) add(dep);
    // Each moved box asks the arrow grid which arrows it meets, where it was (once a gesture) and where it is now:
    // linear in what moved, not arrows x moved.
    const crossed = new Set<string>();
    for (const id of crossedWhereTheyWere(overlay, doc, links)) {
      crossed.add(id);
      add(id);
    }
    for (const el of overlay.changed.values())
      if (model.isBoxed(el)) eachRectMeeting(links.rects, boxOf(el), crossed, add);
    // Arrows riding on an affected arrow follow it, transitively.
    let head = 0;
    while (head < queue.length)
      for (const dep of links.dependants.get(queue[head++]!) ?? []) add(dep);
    return out;
  }

  function movedBoxesGrid(overlay: DragOverlayLike<E>): Grid {
    const boxes: E[] = [];
    for (const el of overlay.changed.values()) if (model.isBoxed(el)) boxes.push(el);
    for (const { el } of overlay.added) if (model.isBoxed(el)) boxes.push(el);
    return model.buildElementGrid(boxes);
  }

  function previewArrowGeometry(
    arrow: A,
    index: Index,
    grid: Grid,
    overlay: DragOverlayLike<E>,
    moved: Grid,
    tabFinish?: unknown,
  ): { frame: Frame; holes: Rect[] } {
    const frame = model.frameOf(arrow, index, tabFinish);
    const query = model.routeBehindQueryRect(frame.from, frame.to);
    const still = model
      .queryElementGrid(grid, query)
      .filter((el) => !overlay.changed.has(el.id) && !overlay.removed.has(el.id));
    return {
      frame,
      holes: model.routeBehindHoles(arrow, frame.from, frame.to, [
        ...still,
        ...model.queryElementGrid(moved, query),
      ]),
    };
  }

  return { buildArrowLinks, affectedArrows, movedBoxesGrid, previewArrowGeometry };
}
