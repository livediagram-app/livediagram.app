// Tidy Up (docs/specs/007-editor/logo-pages.md "Tidy Up"): hand-drawn lines made clean. A pencil or
// marker stroke, or an open path of corners (a merged mirrored stroke), becomes a path of straight
// segments: its samples cut to the corners that shape it, then each segment within a few degrees
// of level or upright made exactly so. A stroke whose ends meet closes. The result keeps the
// element's id, place in the stacking order and stroke look. Pure.
import {
  BORDER_STROKE_PX,
  freehandCanvasPoints,
  freehandStrokePoints,
  INK_PEN_COLOUR,
  isPenStroke,
  pathContours,
  pathOfContours,
  pathWorldAnchors,
  type BorderStroke,
  type BoxedElement,
  type Element,
  type PathAnchor,
  type PathElement,
} from '@livediagram/document';
import { simplifyLine } from './simplify-line';
import type { TidyGuides } from './logo-guide-snapping';

type Point = { x: number; y: number };

// The share of a stroke's size its corners may stray from the drawn line, and the floor in px.
export const TIDY_TOLERANCE = 0.05;
export const TIDY_MIN_TOLERANCE_PX = 2;
// A segment this close to level or upright, in degrees, is made exactly so.
export const TIDY_SQUARE_DEGREES = 12;
const SQUARE = Math.tan((TIDY_SQUARE_DEGREES * Math.PI) / 180);

/** The look a line keeps as a path: its stroke colour, width and style (a marker's width rounded
 *  up to a stroke width). */
export function lineStyle(el: BoxedElement): Partial<PathElement> {
  const src = el as Partial<
    Pick<
      PathElement,
      'strokeColor' | 'penColour' | 'strokeWidth' | 'strokeStyle' | 'opacity' | 'layerId'
    >
  > & { penWidth?: number };
  // A marker's width in px becomes the thinnest stroke width at least as wide (the widest when it
  // is wider than all), so its line never comes out thinner than it was drawn.
  const strokes = (Object.entries(BORDER_STROKE_PX) as [BorderStroke, number][])
    .filter(([id]) => id !== 'none')
    .sort((a, b) => a[1] - b[1]);
  const width: BorderStroke | undefined =
    src.strokeWidth ??
    (src.penWidth
      ? (strokes.find(([, px]) => px >= src.penWidth!) ?? strokes[strokes.length - 1]!)[0]
      : undefined);
  // A marker with no colour of its own is drawn in Ink: kept by name, not left to a path's default.
  const marker = el.type === 'freehand' && isPenStroke(el);
  const penColour = src.penColour ?? (marker && !src.strokeColor ? INK_PEN_COLOUR : undefined);
  return {
    ...(src.strokeColor ? { strokeColor: src.strokeColor } : {}),
    ...(penColour ? { penColour } : {}),
    ...(width ? { strokeWidth: width } : {}),
    ...(src.strokeStyle ? { strokeStyle: src.strokeStyle } : {}),
    ...(src.opacity !== undefined ? { opacity: src.opacity } : {}),
    ...(src.layerId ? { layerId: src.layerId } : {}),
  };
}

// The drawn lines to clean, in canvas px, rotation applied (a path's); null when it is not one.
function drawnLines(el: Element): { lines: Point[][]; closed: boolean } | null {
  if (el.type === 'freehand') {
    if (el.pen === 'highlighter' || el.rotation) return null;
    const pts = freehandCanvasPoints(el);
    return pts.length >= 3 ? { lines: [pts], closed: el.closed } : null;
  }
  if (el.type === 'path' && !el.closed) {
    const contours = pathContours(el);
    if (!contours.every((c) => c.every((n) => n.mode === 'corner' && !n.handleIn && !n.handleOut)))
      return null;
    const lines = contours.map((c) => pathWorldAnchors(el, c));
    return lines.some((l) => l.length >= 3) ? { lines, closed: false } : null;
  }
  return null;
}

/** Whether Tidy Up has something to do on this element. Cheap (it reads counts, never builds the
 *  points): the title bar asks it on every render while something is selected. */
export function isTidyable(el: Element): boolean {
  if (el.type === 'freehand')
    return el.pen !== 'highlighter' && !el.rotation && freehandStrokePoints(el).count >= 3;
  if (el.type !== 'path' || el.closed) return false;
  const contours = pathContours(el);
  return (
    contours.every((c) => c.every((n) => n.mode === 'corner' && !n.handleIn && !n.handleOut)) &&
    contours.some((c) => c.length >= 3)
  );
}

// The fields a tidied element keeps that a path also has: its conversation, note, link, action,
// animation and lock on its proportions.
const KEPT_FIELDS = [
  'commentThread',
  'note',
  'noteRich',
  'link',
  'action',
  'animation',
  'animationSpeed',
  'animationRepeat',
  'aspectLocked',
] as const satisfies readonly (keyof PathElement)[];

function pick<T extends object, K extends keyof T>(src: T, keys: readonly K[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  return out;
}

// Union-find over corner indices, for the runs that share one x or one y.
function groups(n: number) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  return { find, join: (a: number, b: number) => void (parent[find(a)] = find(b)) };
}

// Segments near level or upright made exactly so, the whole shape at once (a closed shape's
// closing segment too): corners joined by a level segment share one y, by an upright one one x,
// each the group's mean, or a corner's that sits on a guide (`pinned`), so a squared corner never
// leaves the guide it was put on.
function squareUp(
  pts: Point[],
  closed: boolean,
  pinned: readonly boolean[],
  guides?: TidyGuides | null,
): Point[] {
  const n = pts.length;
  const xs = groups(n);
  const ys = groups(n);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i]!;
    const j = (i + 1) % n;
    const b = pts[j]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    // Two corners on different guides along the run stay where the guides put them: squaring
    // one onto the other would move a corner off its guide.
    const bothPinned = pinned[i] && pinned[j];
    if (Math.abs(dy) <= SQUARE * Math.abs(dx)) {
      if (!bothPinned || a.y === b.y) ys.join(i, j);
    } else if (Math.abs(dx) <= SQUARE * Math.abs(dy)) {
      if (!bothPinned || a.x === b.x) xs.join(i, j);
    }
  }
  const settle = (g: ReturnType<typeof groups>, axis: 'x' | 'y') => {
    const members = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const root = g.find(i);
      members.set(root, [...(members.get(root) ?? []), i]);
    }
    const value = new Map<number, number>();
    for (const [root, idx] of members) {
      const pin = idx.find((i) => pinned[i]);
      if (pin !== undefined) {
        value.set(root, pts[pin]![axis]);
        continue;
      }
      // The run's mean, moved onto a guide line along it when one is near (a grid line, a centre
      // line, a keyline edge).
      const mean = idx.reduce((sum, i) => sum + pts[i]![axis], 0) / idx.length;
      const near = pts[idx[0]!]!;
      value.set(root, guides?.[axis](mean, near) ?? mean);
    }
    return (i: number) => value.get(g.find(i))!;
  };
  const x = settle(xs, 'x');
  const y = settle(ys, 'y');
  return pts.map((_, i) => ({ x: x(i), y: y(i) }));
}

// Corners left in line once squared up (on one level or upright run) go; round a closed shape too.
function dropInline(pts: Point[], closed: boolean): Point[] {
  const inline = (a: Point, b: Point, c: Point) =>
    (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
  const out = pts.filter((p, i) => {
    if (!closed && (i === 0 || i === pts.length - 1)) return true;
    const prev = pts[(i - 1 + pts.length) % pts.length]!;
    const next = pts[(i + 1) % pts.length]!;
    return !inline(prev, p, next);
  });
  return out.length >= (closed ? 3 : 2) ? out : pts;
}

/** The element tidied up as a path of straight segments, or null when it is not a drawn line.
 *  `guides` (a logo page's shown guides) puts a corner on a guide near it, first, and a straight run
 *  onto a guide line along it. */
export function tidyUpStroke(el: BoxedElement, guides?: TidyGuides | null): PathElement | null {
  const drawn = drawnLines(el);
  if (!drawn) return null;
  const tol = Math.max(TIDY_MIN_TOLERANCE_PX, TIDY_TOLERANCE * Math.hypot(el.width, el.height));
  let closed = drawn.closed;
  const contours = drawn.lines.map((line) => {
    let pts = simplifyLine(line, tol);
    // A single line whose ends meet is a closed shape: its last corner is its first.
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    const meet = pts.length >= 4 && Math.hypot(last.x - first.x, last.y - first.y) <= tol * 2;
    if (drawn.lines.length === 1 && meet) closed = true;
    if (closed && meet) pts = pts.slice(0, -1);
    if (pts.length < 3) closed = false;
    const snapped = pts.map((p) => guides?.point(p) ?? null);
    const onGuides = pts.map((p, i) => snapped[i] ?? p);
    return dropInline(
      squareUp(
        onGuides,
        closed,
        snapped.map((q) => q !== null),
        guides,
      ),
      closed,
    ).map((p): PathAnchor => ({
      x: p.x,
      y: p.y,
      mode: 'corner',
    }));
  });
  // A line that closes stays a line: unfilled, unless it was a filled shape already (a closed
  // pencil stroke keeps its fill).
  const filledBefore = el.type === 'freehand' && el.closed && !isPenStroke(el);
  const src = el as Partial<PathElement>;
  return pathOfContours(
    {
      id: el.id,
      type: 'path',
      closed,
      ...lineStyle(el),
      // A closed pencil shape keeps its fill; any other line that closes stays unfilled.
      ...(closed
        ? filledBefore && src.fillColor
          ? { fillColor: src.fillColor }
          : filledBefore
            ? {}
            : { fillColor: 'transparent' }
        : {}),
      // What the element carries besides its look stays with it (a path takes no label).
      ...pick(src, KEPT_FIELDS),
    },
    contours,
  );
}
