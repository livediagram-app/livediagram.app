// What a press with the Fill tool fills (docs/specs/023-draw-mode/fill-tool.md "What a press fills"):
// the topmost closed element under the point, or a marker loop whose ends meet, looking past open ink,
// lines, text boxes and outlines the point is outside, and stopped by anything else that fills its
// box. Pure; canvas px. Every element whose box misses the point is skipped before any geometry is
// read, so a press on a board of thousands of strokes decodes only the few under it.
import {
  fillStrokeLoop,
  freehandAbsolutePoints,
  insidePolygon,
  isOpenMarkerLoop,
  pathContours,
  pathWorldAnchors,
  pointInsideOutline,
  samplePath,
  type Element,
  type FreehandElement,
} from '@livediagram/document';
import { inPointsBox, insideLoop } from '@liveworkspace/model-core/stroke-loop';
import { supportsQuickSection } from './quick-style';
import { applyFillColorToEl } from './style-presets';

type Point = { x: number; y: number };

export type BucketTarget =
  // A closed element: its fill is set.
  | { kind: 'fill'; el: Element }
  // An open marker stroke whose ends meet: it is closed and filled.
  | { kind: 'loop'; el: FreehandElement }
  // The topmost thing under the press is locked.
  | { kind: 'locked' }
  // Nothing a bucket fills.
  | { kind: 'none' };

type Verdict = 'fill' | 'loop' | 'through' | 'stop';

// Whether the point can be anywhere on the element: inside its box, grown to hold its rotation.
function nearBox(el: Element, p: Point): boolean {
  const { x, y, width, height } = el as { x: number; y: number; width: number; height: number };
  if (!(el as { rotation?: number }).rotation) {
    return p.x >= x && p.x <= x + width && p.y >= y && p.y <= y + height;
  }
  const r = Math.hypot(width, height) / 2;
  return Math.hypot(p.x - (x + width / 2), p.y - (y + height / 2)) <= r;
}

function freehandVerdict(el: FreehandElement, p: Point): Verdict {
  // A highlight is open ink.
  if (el.pen === 'highlighter') return 'through';
  const pts = freehandAbsolutePoints(el);
  if (!inPointsBox(p, pts) || !insideLoop(p, pts)) return 'through';
  if (el.closed) return 'fill';
  return isOpenMarkerLoop(el) ? 'loop' : 'through';
}

function pathVerdict(el: Extract<Element, { type: 'path' }>, p: Point): Verdict {
  if (!el.closed) return 'through';
  // Even-odd over every contour: a hole of a combined path is outside it.
  const contours = pathContours(el).map((nodes) => samplePath(pathWorldAnchors(el, nodes), true));
  return contours.filter((pts) => insidePolygon(p, pts)).length % 2 === 1 ? 'fill' : 'through';
}

function verdictOf(el: Element, p: Point): Verdict {
  // Lines and arrows have no inside; a text box lets the press through to what it labels.
  if (el.type === 'arrow' || el.type === 'text') return 'through';
  if (!nearBox(el, p)) return 'through';
  switch (el.type) {
    case 'freehand':
      return freehandVerdict(el, p);
    case 'path':
      return pathVerdict(el, p);
    case 'shape':
      if (!pointInsideOutline(el, p, 0)) return 'through';
      return supportsQuickSection(el, 'background') ? 'fill' : 'stop';
    default:
      // A note, an image, a table, an embed: it fills its box and is not a bucket's to fill.
      return 'stop';
  }
}

/**
 * What a press at `p` fills. `elements` is in paint order, bottom first; `inertIds` are on a hidden
 * or locked layer, which the bucket does not see.
 */
export function paintBucketTarget(
  elements: readonly Element[],
  p: Point,
  inertIds: ReadonlySet<string> = new Set(),
): BucketTarget {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!;
    if (inertIds.has(el.id)) continue;
    const verdict = verdictOf(el, p);
    if (verdict === 'through') continue;
    if ((el as { locked?: boolean }).locked) return { kind: 'locked' };
    if (verdict === 'stop') return { kind: 'none' };
    return verdict === 'loop'
      ? { kind: 'loop', el: el as FreehandElement }
      : { kind: 'fill', el };
  }
  return { kind: 'none' };
}

/**
 * The element as the bucket leaves it, or null when it would not change: a shape or path given the
 * colour as a picked Background colour gives it (no swatch binding, no colour preset), a closed stroke
 * given the colour, a loop closed and filled (No fill leaves an open loop as it is: there is no fill
 * to clear). `colour` is a `#rrggbb` or `transparent`.
 */
export function pourBucket(
  target: Extract<BucketTarget, { kind: 'fill' | 'loop' }>,
  colour: string,
): Element | null {
  if (target.kind === 'loop') {
    return colour === 'transparent' ? null : fillStrokeLoop(target.el, colour);
  }
  const el = target.el as Element & { fillColor?: string; fillSwatch?: unknown; colorPreset?: unknown };
  const same = el.fillColor?.toLowerCase() === colour.toLowerCase();
  if (same && el.fillSwatch === undefined && el.colorPreset === undefined) return null;
  if (el.type === 'path') return { ...el, fillColor: colour, fillSwatch: undefined };
  return el.type === 'shape' || el.type === 'freehand' ? applyFillColorToEl(el, colour) : null;
}
