// Where an element's indicators sit (docs/specs/008-canvas/element-indicators.md): inside its
// outline, never across it, on every shape. The outline is the one the canvas already hit-tests
// against (shape-hit.ts), so a circle offers its curve, a diamond its edges and a mind node its
// rounded box. A cluster starts tight in its corner and slides inward until it fits, or reports
// that it cannot (the caller then draws the pip on the outline). Pure; no DOM.

import type { Point } from './geometry-primitives';
import type { BoxedElement, TextAlignX, TextAlignY, TextSize } from './index';
import { LABEL_FONT_PX } from './label-font';
import { pickedByOutline, roundedRectRing, shapeHitOutline } from './shape-hit';
import type { ShapeKind } from './shape-kind';
import { insidePolygon, segmentDistance } from './whiteboard-stroke';

export type IndicatorAnchor = 'top-right' | 'bottom-left' | 'bottom-centre';
export type IndicatorBox = { x: number; y: number; width: number; height: number };

// How far the cluster keeps from the outline on every side.
export const INDICATOR_OUTLINE_CLEARANCE_PX = 6;
// The cluster stays this far short of the element's vertical centre, where the label is.
export const INDICATOR_MIDDLE_CLEARANCE_PX = 14;
// Where the slide starts, and its step: the first inset that fits is the tightest one.
export const INDICATOR_START_INSET_PX = 3;
export const INDICATOR_STEP_PX = 1;

// A fixed-size label's estimated box: an average advance per character and a line height, both
// per font px, a little generous so the estimate errs toward avoiding the text.
const LABEL_CHAR_EM = 0.58;
const LABEL_LINE_EM = 1.3;

// The outline-traced kinds whose footer still reads as a box: it starts at the bottom-left.
const BOX_FOOTER_KINDS: ReadonlySet<ShapeKind> = new Set<ShapeKind>([
  'square',
  'stadium',
  'page',
  'browser',
]);

/** The element's outline as closed rings in its local, unrotated px. */
export function indicatorRings(el: BoxedElement, cornerPx: number): Point[][] {
  if (el.width <= 0 || el.height <= 0) return [];
  if (pickedByOutline(el)) {
    return shapeHitOutline(el)
      .lines.filter((line) => line.closed && line.points.length > 2)
      .map((line) => [...line.points]);
  }
  return [roundedRectRing(0, 0, el.width, el.height, cornerPx, cornerPx)];
}

/** Where the footer row starts: bottom-left on a box, centred on every other shape. */
export function footerAnchor(el: BoxedElement): IndicatorAnchor {
  if (!pickedByOutline(el)) return 'bottom-left';
  return BOX_FOOTER_KINDS.has(el.shape) ? 'bottom-left' : 'bottom-centre';
}

/**
 * Where a FIXED-size label's text sits, estimated from its length, size, padding and alignment,
 * so a cluster can avoid the text itself rather than the whole middle band. Null for a
 * scale-to-fit label (it grows to fill its element and makes room instead) or no text.
 */
export function labelTextBox(input: {
  width: number;
  height: number;
  label: string;
  textSize: TextSize;
  padding: number;
  alignX: TextAlignX;
  alignY: TextAlignY;
}): IndicatorBox | null {
  const { width, height, label, textSize, padding, alignX, alignY } = input;
  if (textSize === 'scale' || label.trim() === '') return null;
  const px = LABEL_FONT_PX[textSize];
  const room = Math.max(1, width - 2 * padding);
  const paragraphs = label.split('\n').map((line) => line.length * px * LABEL_CHAR_EM);
  const lines = paragraphs.reduce((n, w) => n + Math.max(1, Math.ceil(w / room)), 0);
  const w = Math.min(room, Math.max(...paragraphs));
  const h = Math.min(height - 2 * padding, lines * px * LABEL_LINE_EM);
  const x =
    alignX === 'left' ? padding : alignX === 'right' ? width - padding - w : (width - w) / 2;
  const y =
    alignY === 'top' ? padding : alignY === 'bottom' ? height - padding - h : (height - h) / 2;
  return { x, y, width: w, height: h };
}

/**
 * The first box of `size` that fits inside `rings`, sliding in from `anchor`'s corner, or null
 * when none does. It stays in its own half of the element and out of the middle band, where a
 * label sits; with `label` (a fixed-size label's estimated text box) it may enter the band as long
 * as it keeps the outline clearance from that text.
 */
export function placeIndicators(
  rings: readonly (readonly Point[])[],
  width: number,
  height: number,
  size: { width: number; height: number },
  anchor: IndicatorAnchor,
  label: IndicatorBox | null = null,
): IndicatorBox | null {
  if (rings.length === 0 || size.width <= 0 || size.height <= 0) return null;
  const top = anchor === 'top-right';
  for (let s = INDICATOR_START_INSET_PX; ; s += INDICATOR_STEP_PX) {
    const box: IndicatorBox = {
      x:
        anchor === 'top-right'
          ? width - s - size.width
          : anchor === 'bottom-left'
            ? s
            : (width - size.width) / 2,
      y: top ? s : height - s - size.height,
      width: size.width,
      height: size.height,
    };
    // Past the centre is always too far; inside the middle band is fine only when the cluster
    // clears a fixed-size label's estimated text.
    const pastCentre = top ? box.y + box.height > height / 2 : box.y < height / 2;
    if (pastCentre || box.x < 0) return null;
    const inBand = top
      ? box.y + box.height > height / 2 - INDICATOR_MIDDLE_CLEARANCE_PX
      : box.y < height / 2 + INDICATOR_MIDDLE_CLEARANCE_PX;
    const clearOfLabel = inBand
      ? label !== null && !overlaps(box, label, INDICATOR_OUTLINE_CLEARANCE_PX)
      : true;
    if (clearOfLabel && fits(box, rings)) return box;
  }
}

/**
 * Where the pip sits: the point where a 45° line in from the box's top-right corner first meets
 * the outline (the rule `badgeCornerInset` applies to the box-drawn shapes), as an inset from the top and right edges. On a hexagon, a triangle or
 * a cloud that is its edge, not the empty box corner beside it. Null when there is no outline.
 */
export function pipCornerInset(
  rings: readonly (readonly Point[])[],
  width: number,
  height: number,
): { x: number; y: number } | null {
  if (rings.length === 0) return null;
  // Half-pixel steps, no further in than half the shorter side.
  const reach = Math.min(width, height) / 2;
  for (let d = 0; d <= reach; d += 0.5) {
    if (rings.some((ring) => insidePolygon({ x: width - d, y: d }, ring))) return { x: d, y: d };
  }
  return null;
}

function overlaps(a: IndicatorBox, b: IndicatorBox, margin: number): boolean {
  return (
    a.x < b.x + b.width + margin &&
    b.x < a.x + a.width + margin &&
    a.y < b.y + b.height + margin &&
    b.y < a.y + a.height + margin
  );
}

function fits(box: IndicatorBox, rings: readonly (readonly Point[])[]): boolean {
  const { x, y, width: w, height: h } = box;
  const right = x + w;
  const bottom = y + h;
  const probes: Point[] = [
    { x, y },
    { x: right, y },
    { x: right, y: bottom },
    { x, y: bottom },
    { x: x + w / 2, y },
    { x: right, y: y + h / 2 },
    { x: x + w / 2, y: bottom },
    { x, y: y + h / 2 },
  ];
  if (!probes.every((p) => rings.some((ring) => insidePolygon(p, ring)))) return false;
  const edges: [Point, Point][] = [
    [probes[0]!, probes[1]!],
    [probes[1]!, probes[2]!],
    [probes[2]!, probes[3]!],
    [probes[3]!, probes[0]!],
  ];
  const c = INDICATOR_OUTLINE_CLEARANCE_PX;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      if (a.x > x && a.x < right && a.y > y && a.y < bottom) return false;
      // A segment whose bounds are farther than the clearance cannot be too close.
      if (
        Math.max(a.x, b.x) < x - c ||
        Math.min(a.x, b.x) > right + c ||
        Math.max(a.y, b.y) < y - c ||
        Math.min(a.y, b.y) > bottom + c
      ) {
        continue;
      }
      for (const [p, q] of edges) if (segmentDistance(a, b, p, q) < c) return false;
    }
  }
  return true;
}
