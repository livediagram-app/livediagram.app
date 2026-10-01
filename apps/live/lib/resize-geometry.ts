// Resize geometry for the canvas drag engine (docs/specs/008-canvas/canvas-and-palette.md): projecting a
// pointer delta into fresh bounds per drag mode (aspect-locked or
// free), the union-scaling maths a multi-member resize maps every
// member through, and the corner / snap-mode lookups. Split from
// lib/canvas.ts (which re-exports everything here, so importers keep
// resolving) as one cohesive, DOM-free unit.

import type { Rect } from '@livediagram/document';
import type { DragMode } from './canvas';

// Floor for any single side of a boxed element during a resize. Below
// this the shape becomes a pinprick that's near-impossible to grab
// again, so the resize math clamps both axes here.
export const MIN_SIZE = 20;

// The axis-aligned bounding rectangle a boxed element occupies on the
// canvas. The drag pipeline reads start-bounds at gesture begin and
// recomputes a fresh ShapeBounds on every pointer move.
export type ShapeBounds = Rect;

// Given a shape's bounds at gesture start, project the current pointer
// delta (`dx`, `dy` already in canvas coordinates — caller has
// inverted the zoom) into a fresh ShapeBounds for the given drag mode.
//
// `move` translates the shape uniformly. Each `resize-*` mode pulls
// the matching corner or edge, flooring each side at `MIN_SIZE` so a
// shape can't be dragged down to a pinprick. `aspectLocked` (the
// element's lock, a locked member of a selection, or Shift) hands the
// gesture to `constrainedBounds`, which keeps the width:height ratio
// from every handle.
export function nextBounds(
  start: ShapeBounds,
  mode: DragMode,
  dx: number,
  dy: number,
  aspectLocked: boolean,
): ShapeBounds {
  const { x, y, width, height } = start;
  if (mode === 'move') return { x: x + dx, y: y + dy, width, height };
  if (aspectLocked) return constrainedBounds(start, mode, dx, dy);

  const compute = (signX: number, signY: number) => {
    const newW = Math.max(MIN_SIZE, width + signX * dx);
    const newH = Math.max(MIN_SIZE, height + signY * dy);
    return { newW, newH };
  };

  switch (mode) {
    // Unconstrained, an edge handle resizes its own axis only.
    case 'resize-e':
      return { x, y, width: Math.max(MIN_SIZE, width + dx), height };
    case 'resize-w': {
      const newW = Math.max(MIN_SIZE, width - dx);
      return { x: x + (width - newW), y, width: newW, height };
    }
    case 'resize-s':
      return { x, y, width, height: Math.max(MIN_SIZE, height + dy) };
    case 'resize-n': {
      const newH = Math.max(MIN_SIZE, height - dy);
      return { x, y: y + (height - newH), width, height: newH };
    }
    case 'resize-se': {
      const { newW, newH } = compute(1, 1);
      return { x, y, width: newW, height: newH };
    }
    case 'resize-sw': {
      const { newW, newH } = compute(-1, 1);
      return { x: x + (width - newW), y, width: newW, height: newH };
    }
    case 'resize-ne': {
      const { newW, newH } = compute(1, -1);
      return { x, y: y + (height - newH), width: newW, height: newH };
    }
    case 'resize-nw': {
      const { newW, newH } = compute(-1, -1);
      return { x: x + (width - newW), y: y + (height - newH), width: newW, height: newH };
    }
  }
}

// The axis a constrained resize is led by: the edge handle's own axis, or
// for a corner the axis the pointer has moved further along (in canvas
// px). The other side follows from the ratio.
export type ResizeAxis = 'x' | 'y';
export function leadingAxis(mode: Exclude<DragMode, 'move'>, dx: number, dy: number): ResizeAxis {
  if (mode === 'resize-e' || mode === 'resize-w') return 'x';
  if (mode === 'resize-n' || mode === 'resize-s') return 'y';
  return Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
}

// The smallest uniform scale a constrained resize may reach: the shorter
// side stops at MIN_SIZE, and a side that began below MIN_SIZE (a thin
// stroke) never shrinks further, so the ratio holds all the way down.
export function minUniformScale({ width, height }: { width: number; height: number }): number {
  const floorFor = (side: number) => (side >= MIN_SIZE ? MIN_SIZE / side : 1);
  return Math.max(floorFor(width), floorFor(height));
}

// Signs of the dragged side per handle: +1 when it moves right / down.
const HANDLE_SIGN: Record<ResizeSnapMode, { x: number; y: number }> = {
  n: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
  ne: { x: 1, y: -1 },
  nw: { x: -1, y: -1 },
  se: { x: 1, y: 1 },
  sw: { x: -1, y: 1 },
};

// Lay a new size out around a resize's anchor: the corner opposite a
// corner handle, or for an edge handle the opposite edge, with the
// other axis centred on it (the Figma convention).
function anchoredBounds(
  start: ShapeBounds,
  handle: ResizeSnapMode,
  width: number,
  height: number,
): ShapeBounds {
  const sign = HANDLE_SIGN[handle];
  const x =
    sign.x > 0
      ? start.x
      : sign.x < 0
        ? start.x + start.width - width
        : start.x + (start.width - width) / 2;
  const y =
    sign.y > 0
      ? start.y
      : sign.y < 0
        ? start.y + start.height - height
        : start.y + (start.height - height) / 2;
  return { x, y, width, height };
}

// A resize that keeps the start ratio (docs/specs/008-canvas/canvas-and-palette.md
// "Resize"), from any handle: the leading axis sets one uniform scale,
// floored at `minScale` (by default where the shorter side meets
// MIN_SIZE), and the anchor stays put. A degenerate start box has no ratio
// to keep and resizes freely.
export function constrainedBounds(
  start: ShapeBounds,
  mode: Exclude<DragMode, 'move'>,
  dx: number,
  dy: number,
  minScale: number = minUniformScale(start),
): ShapeBounds {
  if (start.width <= 0 || start.height <= 0) return nextBounds(start, mode, dx, dy, false);
  const handle = snapModeOf(mode) as ResizeSnapMode;
  const sign = HANDLE_SIGN[handle];
  const scale =
    leadingAxis(mode, dx, dy) === 'x'
      ? (start.width + sign.x * dx) / start.width
      : (start.height + sign.y * dy) / start.height;
  const s = Math.max(minScale, scale);
  return anchoredBounds(start, handle, start.width * s, start.height * s);
}

// Snap a constrained box on its leading axis only, then re-derive the other
// side from the box's ratio around the same anchor, so the snap never bends
// the ratio. `snapEdge` snaps the one dragged edge it is given (a
// `snapResizeBounds` call in single-edge mode); `minScale` floors the
// re-derived scale relative to `candidate`.
export function snapLeadingAxis(
  candidate: ShapeBounds,
  handle: ResizeSnapMode,
  lead: ResizeAxis,
  snapEdge: (candidate: ShapeBounds, edge: 'n' | 's' | 'e' | 'w') => ShapeBounds,
  minScale = 0,
): ShapeBounds {
  if (candidate.width <= 0 || candidate.height <= 0) return candidate;
  const sign = HANDLE_SIGN[handle];
  const edge = lead === 'x' ? (sign.x < 0 ? 'w' : 'e') : sign.y < 0 ? 'n' : 's';
  const snapped = snapEdge(candidate, edge);
  const scale = lead === 'x' ? snapped.width / candidate.width : snapped.height / candidate.height;
  const s = Math.max(minScale, scale);
  return anchoredBounds(candidate, handle, candidate.width * s, candidate.height * s);
}

// Group-resize math: given the union bounding box at drag start,
// the same union after `nextBounds` runs against the drag, and the
// corner the user is pulling, scale a single member's start bounds
// proportionally around the corner opposite the drag handle (the
// fixed anchor). Width / height are floored at MIN_SIZE so tiny
// members inside a large union don't collapse when sx / sy round
// down hard; a side that began below MIN_SIZE is floored where it
// began instead, never bumped up. Pure function (no React, no element
// types), so it stays trivially testable.
export function unionResizeMember(
  member: ShapeBounds,
  unionStart: ShapeBounds,
  unionNext: ShapeBounds,
  corner: 'nw' | 'ne' | 'sw' | 'se',
): ShapeBounds {
  const sx = unionNext.width / Math.max(unionStart.width, 1);
  const sy = unionNext.height / Math.max(unionStart.height, 1);
  // Anchor = union corner OPPOSITE the drag handle; that point
  // stays fixed in canvas-space throughout the resize. nextBounds
  // already keeps it implicit on the union itself; here we mirror
  // the arithmetic so members get repositioned around the same
  // anchor.
  const anchorX =
    corner === 'sw' || corner === 'nw' ? unionStart.x + unionStart.width : unionStart.x;
  const anchorY =
    corner === 'ne' || corner === 'nw' ? unionStart.y + unionStart.height : unionStart.y;
  return {
    x: anchorX + (member.x - anchorX) * sx,
    y: anchorY + (member.y - anchorY) * sy,
    width: Math.max(Math.min(MIN_SIZE, member.width), member.width * sx),
    height: Math.max(Math.min(MIN_SIZE, member.height), member.height * sy),
  };
}

// Map a DragMode to the corner letter, or null if the mode isn't a
// resize. The same lookup happens in two places (the resize effect +
// snap helpers); keeping it here avoids the parallel-table drift.
export function cornerOf(mode: DragMode): 'nw' | 'ne' | 'sw' | 'se' | null {
  switch (mode) {
    case 'resize-nw':
      return 'nw';
    case 'resize-ne':
      return 'ne';
    case 'resize-sw':
      return 'sw';
    case 'resize-se':
      return 'se';
    // move + the single-axis edge handles have no corner anchor.
    default:
      return null;
  }
}

// Map a DragMode to the snap mode `snapResizeBounds` understands (the
// corner OR single edge being dragged), or null for 'move'. Lets edge
// resizes snap + dimension-match on their one axis just like corners do.
export type ResizeSnapMode = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
export function snapModeOf(mode: DragMode): ResizeSnapMode | null {
  return mode === 'move' ? null : (mode.slice('resize-'.length) as ResizeSnapMode);
}
