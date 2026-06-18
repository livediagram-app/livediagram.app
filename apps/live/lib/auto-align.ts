// Auto-align ("Cleanup → Auto-align", spec/47): snap every boxed element's
// position and dimensions to the grid so near-aligned shapes become exactly
// aligned and minor drift collapses. Free-endpoint arrows snap their endpoints
// to the same grid; pinned arrow endpoints stay attached to their elements
// (which themselves get snapped, so the arrow follows).
//
// Grid unit is 10 px. That matches the canvas's "you basically can't see drift
// of less than 10 px" threshold and is the same step the other snap helpers use
// as their floor.
//
// Auto-align is deliberately **conservative and structure-blind**: it only ever
// rounds each element to the nearest grid line, so nothing moves more than half
// a grid step (5 px) and nothing is resized relative to its neighbours. It can
// only tighten an already-roughly-aligned layout, never relocate or homogenise
// it. An earlier version also unified same-type element SIZES and pulled edges
// up to 24 px onto shared lines; that overreached — it resized deliberately
// varied elements and shuffled rows, so a tidy intent often came out worse.
// Structural re-layout (reading the arrow graph, relocating freely) is the
// separate **Auto Layout** / Tidy up pass (`packages/diagram/auto-layout.ts`).

import { MIN_SIZE } from './canvas';
import { isBoxed, type Element } from '@livediagram/diagram';

// Snap step in canvas pixels. Picked so the rounding is visible
// enough to tidy up drift (a 3 px misalignment becomes 0 or 10) but
// not so coarse that intentionally-sized elements get re-shaped.
export const AUTO_ALIGN_GRID = 10;

const snap = (value: number): number => Math.round(value / AUTO_ALIGN_GRID) * AUTO_ALIGN_GRID;

// Shape kinds whose silhouette assumes a 1:1 aspect ratio. Snapping
// width and height independently would warp them, so we snap the
// larger side and force the other to match.
const SQUARE_SHAPES = new Set(['circle', 'diamond', 'actor']);

// Apply the cleanup pass to one element. Pure, idempotent, and
// leaves non-boxed-non-arrow elements unchanged.
export function autoAlignElement(el: Element): Element {
  if (isBoxed(el)) {
    let width = Math.max(MIN_SIZE, snap(el.width));
    let height = Math.max(MIN_SIZE, snap(el.height));
    // Aspect-locked-by-shape elements stay square. Use the larger of
    // the two snapped sides so a "tall-ish circle" becomes a circle
    // around the taller axis (snapping down would shrink it past
    // user intent more often than snapping up).
    if (el.type === 'shape' && SQUARE_SHAPES.has(el.shape)) {
      const side = Math.max(width, height);
      width = side;
      height = side;
    }
    // Explicit aspect-lock (textually editable shapes that the user
    // pinned via the Aspect-lock toggle). Same square-snap rule;
    // we preserve the ratio not by shape but by user intent.
    if (el.aspectLocked === true) {
      const ratio = el.width / Math.max(1, el.height);
      // Pick which axis to drive: the larger absolute change wins,
      // so dragging a 197 x 100 shape to "200 x 100" stays roughly
      // 2:1 rather than collapsing to a square.
      const useW = Math.abs(width - el.width) >= Math.abs(height - el.height);
      if (useW) height = Math.max(MIN_SIZE, snap(width / ratio));
      else width = Math.max(MIN_SIZE, snap(height * ratio));
    }
    return {
      ...el,
      x: snap(el.x),
      y: snap(el.y),
      width,
      height,
    };
  }
  if (el.type === 'arrow') {
    return {
      ...el,
      // Pinned endpoints stay attached to their elements (the
      // element itself just got snapped, so the arrow follows).
      // Free endpoints snap to the grid like any other coord.
      from:
        el.from.kind === 'free'
          ? { kind: 'free', x: snap(el.from.x), y: snap(el.from.y) }
          : el.from,
      to: el.to.kind === 'free' ? { kind: 'free', x: snap(el.to.x), y: snap(el.to.y) } : el.to,
    };
  }
  return el;
}

// Top-level entry: grid-snap every element across a tab. `Element[] in,
// Element[] out`, so the editor can drop it through `commit()` and pick up
// undo / activity-log behaviour for free. A pure per-element snap — no
// cross-element resizing or relocation (see the header note); Auto Layout is
// the structural pass.
export function autoAlignElements(elements: Element[]): Element[] {
  return elements.map(autoAlignElement);
}
