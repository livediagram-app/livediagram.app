// Auto-align (the command palette's Auto-align, docs/specs/008-canvas/layout-cleanup.md): snap every boxed element's
// position and dimensions to the grid so near-aligned shapes become exactly
// aligned and minor drift collapses. Free-endpoint arrows snap their endpoints
// to the same grid; pinned arrow endpoints stay attached to their elements
// (which themselves get snapped, so the arrow follows).
//
// Grid unit is 10 px. That matches the canvas's "you basically can't see drift
// of less than 10 px" threshold and is the same step the other snap helpers use
// as their floor.
//
// Auto-align is deliberately **conservative**: it rounds each element's size to
// the grid and moves each box only onto a grid line or onto a line it already
// (nearly) shares with another box, so nothing moves far and nothing is
// resized relative to its neighbours. It can
// only tighten an already-roughly-aligned layout, never relocate or homogenise
// it. An earlier version also unified same-type element SIZES and pulled edges
// up to 24 px onto shared lines; that overreached — it resized deliberately
// varied elements and shuffled rows, so a tidy intent often came out worse.
// Structural re-layout (reading the arrow graph, relocating freely) is the
// separate **Auto Layout** / Tidy up pass (`packages/document/auto-layout.ts`).

import { MIN_SIZE } from './canvas';
import { isBoxed, type Element, type ElementId } from '@livedocuments/document';
import { alignBoxes } from './auto-align-lines';

// Snap step in canvas pixels. Picked so the rounding is visible
// enough to tidy up drift (a 3 px misalignment becomes 0 or 10) but
// not so coarse that intentionally-sized elements get re-shaped.
export const AUTO_ALIGN_GRID = 10;

const snap = (value: number): number => Math.round(value / AUTO_ALIGN_GRID) * AUTO_ALIGN_GRID;

// Shape kinds often drawn 1:1. Snapping width and height independently would
// warp a square one, so one that is ALREADY square keeps both sides equal. One
// drawn otherwise keeps its own proportions: a flowchart's decision is a wide
// diamond, and squaring it doubled its height into the steps around it.
export const SQUARE_SHAPES: ReadonlySet<string> = new Set(['circle', 'diamond']);

const drawnSquare = (width: number, height: number) => Math.abs(width - height) <= AUTO_ALIGN_GRID;

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
    if (el.type === 'shape' && SQUARE_SHAPES.has(el.shape) && drawnSquare(el.width, el.height)) {
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
// undo behaviour for free. Sizes snap per element; positions snap by the lines
// boxes share (auto-align-lines.ts), so boxes that line up by their centres or
// edges still line up afterwards, and a snap that would make two boxes overlap
// is undone. Auto Layout is the structural pass.
// `lockedIds` (the editor's locked elements and everything on a locked layer) are left exactly as
// they are (docs/specs/008-canvas/layout-cleanup.md "Locked elements stay put").
export function autoAlignElements(
  elements: Element[],
  lockedIds?: ReadonlySet<ElementId>,
): Element[] {
  let out = elements.map((el) =>
    lockedIds?.has(el.id) ? el : el.type === 'arrow' ? autoAlignElement(el) : el,
  );
  // A pass can bring two boxes within reach of a line they did not share before, so passes repeat
  // until one moves nothing: the result is settled, and Auto-align again finds it already tidy.
  for (let pass = 0; pass < MAX_ALIGN_PASSES; pass++) {
    const next = alignBoxes(out, autoAlignElement, lockedIds);
    const settled = next.every((el, i) => el === out[i]);
    out = next;
    if (settled) break;
  }
  return out;
}

// Passes before Auto-align settles for what it has; two is the usual, and each is linear-ish.
const MAX_ALIGN_PASSES = 4;
