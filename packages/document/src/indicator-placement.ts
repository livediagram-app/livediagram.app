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

export type IndicatorAnchor = 'top-right' | 'top-centre' | 'bottom-left' | 'bottom-centre';
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
// (contentBox)
const LABEL_CHAR_EM = 0.58;
const LABEL_LINE_EM = 1.3;

// The symmetric, round or pointed kinds whose indicators centre on them (along the top, or along
// the bottom for the footer) rather than sitting in a corner they do not have.
const CENTRED_KINDS: ReadonlySet<ShapeKind> = new Set<ShapeKind>([
  'circle',
  'diamond',
  'hexagon',
  'cloud',
  'triangle',
  'trapezoid',
  'star',
  'actor',
]);

/** Whether the element's indicators centre on it rather than sit in a corner. */
export function centredIndicators(el: BoxedElement): boolean {
  return el.type === 'shape' && CENTRED_KINDS.has(el.shape);
}

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

/** Where Top sits: top-right on a box, centred along the top of a round or pointed shape. */
export function topAnchor(el: BoxedElement): IndicatorAnchor {
  return centredIndicators(el) ? 'top-centre' : 'top-right';
}

/** Where the footer row starts: bottom-left on a box, centred on a round or pointed shape. */
export function footerAnchor(el: BoxedElement): IndicatorAnchor {
  return centredIndicators(el) ? 'bottom-centre' : 'bottom-left';
}

// An inline icon beside or above a label, as the content box needs it.
export type ContentIcon = {
  size: number;
  position: 'left' | 'right' | 'above' | 'below';
  gap: number;
};

/**
 * Where an element's FIXED-size content sits: its label's text, estimated from its length, size,
 * padding and alignment, plus an inline icon beside or above it. So a cluster can avoid (or move)
 * the content itself rather than the whole middle band. `fontPx` overrides the size preset's px
 * (an inline-icon layout draws a scale label at a fixed px). Null for a scale-to-fit label with no
 * icon (it grows to fill its element and makes room instead) or nothing at all.
 */
export function contentBox(input: {
  width: number;
  height: number;
  label: string;
  textSize: TextSize;
  padding: number;
  alignX: TextAlignX;
  alignY: TextAlignY;
  fontPx?: number;
  icon?: ContentIcon;
}): IndicatorBox | null {
  const { width, height, label, textSize, padding, alignX, alignY, icon } = input;
  const px = input.fontPx ?? (textSize === 'scale' ? null : LABEL_FONT_PX[textSize]);
  const hasText = label.trim() !== '' && px !== null;
  if (!hasText && !icon) return null;
  const room = Math.max(1, width - 2 * padding);
  let w = 0;
  let h = 0;
  if (hasText) {
    const paragraphs = label.split('\n').map((line) => line.length * px * LABEL_CHAR_EM);
    const lines = paragraphs.reduce((n, pw) => n + Math.max(1, Math.ceil(pw / room)), 0);
    w = Math.min(room, Math.max(...paragraphs));
    h = lines * px * LABEL_LINE_EM;
  }
  if (icon) {
    const row = icon.position === 'left' || icon.position === 'right';
    const gap = hasText ? icon.gap : 0;
    w = row ? w + gap + icon.size : Math.max(w, icon.size);
    h = row ? Math.max(h, icon.size) : h + gap + icon.size;
  }
  w = Math.min(room, w);
  h = Math.min(height - 2 * padding, h);
  const x =
    alignX === 'left' ? padding : alignX === 'right' ? width - padding - w : (width - w) / 2;
  const y =
    alignY === 'top' ? padding : alignY === 'bottom' ? height - padding - h : (height - h) / 2;
  return { x, y, width: w, height: h };
}

/**
 * The first box of `size` that fits inside `rings`, sliding in from `anchor`'s corner, or null
 * when none does. It stays in its own half of the element. With `label` (the element's estimated
 * content box) it keeps the outline clearance from that content wherever it is; without it, it
 * keeps out of the middle band, where a label grows.
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
  const top = anchor === 'top-right' || anchor === 'top-centre';
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
    // Past the centre is always too far. With the content known, the cluster must keep clear of it
    // wherever it is; without it, out of the middle band, where a label grows.
    const pastCentre = top ? box.y + box.height > height / 2 : box.y < height / 2;
    if (pastCentre || box.x < 0) return null;
    const clear = label
      ? !overlaps(box, label, INDICATOR_OUTLINE_CLEARANCE_PX)
      : top
        ? box.y + box.height <= height / 2 - INDICATOR_MIDDLE_CLEARANCE_PX
        : box.y >= height / 2 + INDICATOR_MIDDLE_CLEARANCE_PX;
    if (clear && fits(box, rings)) return box;
  }
}

/**
 * Where the pip sits, as an inset from the top and right edges: where a 45° line in from the box's
 * top-right corner first meets the outline (the rule `badgeCornerInset` applies to box-drawn
 * shapes), or, `centred`, where a line down the middle first meets it (the top of a circle, a
 * diamond's or triangle's apex). On a hexagon or a cloud that is the shape itself, never the empty
 * box corner beside it. Null when there is no outline.
 */
export function pipInset(
  rings: readonly (readonly Point[])[],
  width: number,
  height: number,
  centred: boolean,
): { x: number; y: number } | null {
  if (rings.length === 0) return null;
  const inside = (p: Point) => rings.some((ring) => insidePolygon(p, ring));
  // Half-pixel steps, no further in than half the shorter side (half the height, centred).
  if (centred) {
    for (let d = 0; d <= height / 2; d += 0.5) {
      if (inside({ x: width / 2, y: d })) return { x: width / 2, y: d };
    }
    return null;
  }
  const reach = Math.min(width, height) / 2;
  for (let d = 0; d <= reach; d += 0.5) {
    if (inside({ x: width - d, y: d })) return { x: d, y: d };
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

/**
 * How far the content moves to clear a cluster it would sit under: the inset off the content
 * area's top (a Top cluster) or bottom (a Footer row) that re-centres or re-anchors it clear by
 * the outline clearance. Null when it cannot move far enough and still fit, or would have to move
 * against its alignment (top-aligned content under a footer, bottom-aligned under Top).
 */
export function contentShift(
  cluster: IndicatorBox,
  content: IndicatorBox,
  height: number,
  padding: number,
  alignY: TextAlignY,
  footer: boolean,
): { top: number; bottom: number } | null {
  const c = INDICATOR_OUTLINE_CLEARANCE_PX;
  const need = footer
    ? content.y + content.height + c - cluster.y
    : cluster.y + cluster.height + c - content.y;
  if (need <= 0) return { top: 0, bottom: 0 };
  if (alignY === (footer ? 'top' : 'bottom')) return null;
  // Middle content moves half of an inset, so it takes twice the need.
  const inset = alignY === 'middle' ? 2 * need : need;
  if (content.height + inset + 2 * padding > height) return null;
  return footer ? { top: 0, bottom: inset } : { top: inset, bottom: 0 };
}
