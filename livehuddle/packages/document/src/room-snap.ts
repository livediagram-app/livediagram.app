// Rooms snap wall to wall (docs/specs/009-elements/office.md "Rooms line up"): two rectangular Rooms side by side share
// one wall line rather than standing their walls back to back, so the ordinary edge snap (box edge to box edge, which
// leaves a double wall) is joined by a shared-wall snap. Pure, and linear in the elements: it runs per pointer frame.
import { ROOM_BACK_FACE, ROOM_WALL } from '@livehuddle/avatar/office-geometry';
import type { AlignmentGuide } from './geometry-guides';
import type { Element, ElementId, ShapeElement } from './index';

type Box = { x: number; y: number; width: number; height: number };

// A rectangular Room another room can share a wall with (a custom room's walls are not on its box).
function isBoxRoom(el: Element): el is ShapeElement {
  return (
    el.type === 'shape' &&
    el.shape === 'room' &&
    !(Array.isArray(el.roomOutline) && el.roomOutline.length >= 3)
  );
}

// Where the candidate's edge goes to share a wall with `t`: its left on t's right wall (x = t.right - wall), its right on
// t's left wall, its top on t's front wall (its back wall face standing on it: y = t.bottom - back face), its bottom on
// t's back wall. Each with the wall line both then stand on, for the guide.
function sharedWallTargets(t: Box) {
  const half = ROOM_WALL / 2;
  return {
    left: { at: t.x + t.width - ROOM_WALL, line: t.x + t.width - half },
    right: { at: t.x + ROOM_WALL, line: t.x + half },
    top: { at: t.y + t.height - ROOM_BACK_FACE, line: t.y + t.height - half },
    bottom: { at: t.y + ROOM_BACK_FACE, line: t.y + ROOM_BACK_FACE - half },
  };
}

type Best = { delta: number; line: number; span: [number, number] } | null;
const closer = (best: Best, delta: number, threshold: number) =>
  Math.abs(delta) <= threshold && (best === null || Math.abs(delta) < Math.abs(best.delta));

/**
 * The shared-wall snap for a room being moved: the nearest delta per axis (within `threshold`) that puts one of its
 * walls on a neighbouring room's wall line, and the guide along that line. `snappedX/Y` false when none is in range.
 */
export function snapRoomWalls(
  candidate: Box,
  elements: readonly Element[],
  excludeIds: ReadonlySet<ElementId>,
  threshold: number,
): { dx: number; dy: number; snappedX: boolean; snappedY: boolean; guides: AlignmentGuide[] } {
  let bx: Best = null;
  let by: Best = null;
  for (const el of elements) {
    if (!isBoxRoom(el) || excludeIds.has(el.id)) continue;
    const t = sharedWallTargets(el);
    const spanY: [number, number] = [el.y, el.y + el.height];
    const spanX: [number, number] = [el.x, el.x + el.width];
    const dl = t.left.at - candidate.x;
    if (closer(bx, dl, threshold)) bx = { delta: dl, line: t.left.line, span: spanY };
    const dr = t.right.at - (candidate.x + candidate.width);
    if (closer(bx, dr, threshold)) bx = { delta: dr, line: t.right.line, span: spanY };
    const dt = t.top.at - candidate.y;
    if (closer(by, dt, threshold)) by = { delta: dt, line: t.top.line, span: spanX };
    const db = t.bottom.at - (candidate.y + candidate.height);
    if (closer(by, db, threshold)) by = { delta: db, line: t.bottom.line, span: spanX };
  }
  return {
    dx: bx?.delta ?? 0,
    dy: by?.delta ?? 0,
    snappedX: bx !== null,
    snappedY: by !== null,
    guides: guidesFor(candidate, bx, by),
  };
}

/**
 * The shared-wall snap for a room being resized: the edges the handle moves (`mode`, as snapResizeBounds takes it)
 * land on a neighbouring room's wall line when within `threshold`, the opposite edges staying put. The bounds as
 * given when nothing is in range.
 */
export function snapRoomWallsResize(
  candidate: Box,
  mode: 'se' | 'sw' | 'ne' | 'nw' | 'n' | 's' | 'e' | 'w',
  elements: readonly Element[],
  excludeIds: ReadonlySet<ElementId>,
  threshold: number,
): { bounds: Box; guides: AlignmentGuide[] } {
  const right = mode === 'se' || mode === 'ne' || mode === 'e';
  const left = mode === 'sw' || mode === 'nw' || mode === 'w';
  const bottom = mode === 'se' || mode === 'sw' || mode === 's';
  const top = mode === 'ne' || mode === 'nw' || mode === 'n';
  let bx: Best = null;
  let by: Best = null;
  for (const el of elements) {
    if (!isBoxRoom(el) || excludeIds.has(el.id)) continue;
    const t = sharedWallTargets(el);
    const spanY: [number, number] = [el.y, el.y + el.height];
    const spanX: [number, number] = [el.x, el.x + el.width];
    if (left) {
      const d = t.left.at - candidate.x;
      if (closer(bx, d, threshold)) bx = { delta: d, line: t.left.line, span: spanY };
    }
    if (right) {
      const d = t.right.at - (candidate.x + candidate.width);
      if (closer(bx, d, threshold)) bx = { delta: d, line: t.right.line, span: spanY };
    }
    if (top) {
      const d = t.top.at - candidate.y;
      if (closer(by, d, threshold)) by = { delta: d, line: t.top.line, span: spanX };
    }
    if (bottom) {
      const d = t.bottom.at - (candidate.y + candidate.height);
      if (closer(by, d, threshold)) by = { delta: d, line: t.bottom.line, span: spanX };
    }
  }
  const b = { ...candidate };
  if (bx) {
    if (left) {
      b.x += bx.delta;
      b.width -= bx.delta;
    } else b.width += bx.delta;
  }
  if (by) {
    if (top) {
      b.y += by.delta;
      b.height -= by.delta;
    } else b.height += by.delta;
  }
  return { bounds: b, guides: guidesFor(b, bx && { ...bx, delta: 0 }, by && { ...by, delta: 0 }) };
}

// The guide along each shared wall line, spanning both rooms (the candidate as the snap leaves it).
function guidesFor(candidate: Box, bx: Best, by: Best): AlignmentGuide[] {
  const x0 = candidate.x + (bx?.delta ?? 0);
  const y0 = candidate.y + (by?.delta ?? 0);
  const out: AlignmentGuide[] = [];
  if (bx)
    out.push({
      axis: 'x',
      position: bx.line,
      start: Math.min(y0, bx.span[0]),
      end: Math.max(y0 + candidate.height, bx.span[1]),
    });
  if (by)
    out.push({
      axis: 'y',
      position: by.line,
      start: Math.min(x0, by.span[0]),
      end: Math.max(x0 + candidate.width, by.span[1]),
    });
  return out;
}
