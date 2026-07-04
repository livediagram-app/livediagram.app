// Resize geometry for the canvas drag engine (spec/09): projecting a
// pointer delta into fresh bounds per drag mode (aspect-locked or
// free), the union-scaling maths a multi-member resize maps every
// member through, and the corner / snap-mode lookups. Split from
// lib/canvas.ts (which re-exports everything here, so importers keep
// resolving) as one cohesive, DOM-free unit.

import type { DragMode } from './canvas';

// Floor for any single side of a boxed element during a resize. Below
// this the shape becomes a pinprick that's near-impossible to grab
// again, so the resize math clamps both axes here.
export const MIN_SIZE = 20;

// The axis-aligned bounding rectangle a boxed element occupies on the
// canvas. The drag pipeline reads start-bounds at gesture begin and
// recomputes a fresh ShapeBounds on every pointer move.
export type ShapeBounds = { x: number; y: number; width: number; height: number };

// Given a shape's bounds at gesture start, project the current pointer
// delta (`dx`, `dy` already in canvas coordinates — caller has
// inverted the zoom) into a fresh ShapeBounds for the given drag mode.
//
// `move` translates the shape uniformly. Each `resize-*` mode pulls
// the matching corner; `aspectLocked` collapses the two-axis input
// onto a single dominant axis (the one whose delta is larger) so the
// width:height ratio survives the gesture. Both branches floor each
// side at `MIN_SIZE` so a shape can't be dragged down to a pinprick.
export function nextBounds(
  start: ShapeBounds,
  mode: DragMode,
  dx: number,
  dy: number,
  aspectLocked: boolean,
): ShapeBounds {
  const { x, y, width, height } = start;
  if (mode === 'move') return { x: x + dx, y: y + dy, width, height };

  const freeForCorner = (signX: number, signY: number) => {
    const newW = Math.max(MIN_SIZE, width + signX * dx);
    const newH = Math.max(MIN_SIZE, height + signY * dy);
    return { newW, newH };
  };

  const lockedForCorner = (signX: number, signY: number) => {
    const candW = Math.max(MIN_SIZE, width + signX * dx);
    const candH = Math.max(MIN_SIZE, height + signY * dy);
    const ratio = width / height;
    const useW = Math.abs(candW - width) >= Math.abs(candH - height);
    const newW = useW ? candW : candH * ratio;
    const newH = useW ? candW / ratio : candH;
    return { newW: Math.max(MIN_SIZE, newW), newH: Math.max(MIN_SIZE, newH) };
  };

  const compute = aspectLocked ? lockedForCorner : freeForCorner;

  switch (mode) {
    // Edge handles resize a single axis only (aspect-lock doesn't apply).
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

// Group-resize math: given the union bounding box at drag start,
// the same union after `nextBounds` runs against the drag, and the
// corner the user is pulling, scale a single member's start bounds
// proportionally around the corner opposite the drag handle (the
// fixed anchor). Width / height are floored at MIN_SIZE so tiny
// members inside a large union don't collapse when sx / sy round
// down hard. Pure function (no React, no element types), so it
// stays trivially testable.
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
    width: Math.max(MIN_SIZE, member.width * sx),
    height: Math.max(MIN_SIZE, member.height * sy),
  };
}

// Union bounding box of a Map of starts (the shape `drag.startBounds`
// carries during a boxed-element drag). Returns null when the map is
// empty so callers can short-circuit. Pulled out so the resize and
// the test suite share one definition.
export function unionOfBounds(boundsList: Iterable<ShapeBounds>): ShapeBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let saw = false;
  for (const b of boundsList) {
    saw = true;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  if (!saw) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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
