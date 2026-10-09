// Snapping to a logo page's construction guides (docs/specs/007-editor/logo-pages.md "Construction
// guides"): a point near a guide lands on it. Where guides cross (the centre, a corner, a circle
// meeting a centre line or a diagonal, a grid crossing) is preferred; else the nearest point on the
// nearest guide line or circle. Only the guide parts shown count. Pure geometry, in canvas px.
import type { PageRect } from './illustrate-page';
import type { GuideCircle, GuideLine, LogoGuides } from './logo-page';

type Point = { x: number; y: number };

/** The guide parts a person can show or hide, by id. */
export type LogoGuideSnapPart = 'centre' | 'diagonals' | 'safe' | 'circles' | 'square' | 'grid';

const rectEdges = (r: PageRect): GuideLine[] => {
  const x2 = r.x + r.width;
  const y2 = r.y + r.height;
  return [
    { x1: r.x, y1: r.y, x2, y2: r.y },
    { x1: x2, y1: r.y, x2, y2 },
    { x1: r.x, y1: y2, x2, y2 },
    { x1: r.x, y1: r.y, x2: r.x, y2 },
  ];
};

/** The shown guides as segments and circles. */
export function logoGuideShapes(
  g: LogoGuides,
  shows: (part: LogoGuideSnapPart) => boolean,
): { lines: GuideLine[]; circles: GuideCircle[] } {
  const lines: GuideLine[] = [];
  const circles: GuideCircle[] = [];
  if (shows('centre')) lines.push(g.centre.v, g.centre.h);
  if (shows('diagonals')) lines.push(...g.diagonals);
  if (shows('safe')) lines.push(...rectEdges(g.safeArea));
  if (shows('square')) lines.push(...rectEdges(g.keylineSquare));
  if (shows('grid')) lines.push(...g.grid);
  if (shows('circles')) circles.push(g.keylineCircle, g.innerCircle);
  return { lines, circles };
}

const EPS = 1e-9;

function segmentCrossing(a: GuideLine, b: GuideLine): Point | null {
  const rx = a.x2 - a.x1;
  const ry = a.y2 - a.y1;
  const sx = b.x2 - b.x1;
  const sy = b.y2 - b.y1;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < EPS) return null;
  const t = ((b.x1 - a.x1) * sy - (b.y1 - a.y1) * sx) / den;
  const u = ((b.x1 - a.x1) * ry - (b.y1 - a.y1) * rx) / den;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { x: a.x1 + t * rx, y: a.y1 + t * ry };
}

function segmentCircleCrossings(l: GuideLine, c: GuideCircle): Point[] {
  const dx = l.x2 - l.x1;
  const dy = l.y2 - l.y1;
  const fx = l.x1 - c.cx;
  const fy = l.y1 - c.cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const k = fx * fx + fy * fy - c.r * c.r;
  const disc = b * b - 4 * a * k;
  if (a < EPS || disc < 0) return [];
  const root = Math.sqrt(disc);
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    .filter((t) => t >= -EPS && t <= 1 + EPS)
    .map((t) => ({ x: l.x1 + t * dx, y: l.y1 + t * dy }));
}

/** Every point where two shown guides meet. */
export function logoGuideCrossings(shapes: {
  lines: GuideLine[];
  circles: GuideCircle[];
}): Point[] {
  const out: Point[] = [];
  const { lines, circles } = shapes;
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const p = segmentCrossing(lines[i]!, lines[j]!);
      if (p) out.push(p);
    }
    for (const c of circles) out.push(...segmentCircleCrossings(lines[i]!, c));
  }
  return out;
}

function nearestOnSegment(l: GuideLine, p: Point): Point {
  const dx = l.x2 - l.x1;
  const dy = l.y2 - l.y1;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 < EPS ? 0 : Math.max(0, Math.min(1, ((p.x - l.x1) * dx + (p.y - l.y1) * dy) / len2));
  return { x: l.x1 + t * dx, y: l.y1 + t * dy };
}

function nearestOnCircle(c: GuideCircle, p: Point): Point {
  const d = Math.hypot(p.x - c.cx, p.y - c.cy);
  if (d < EPS) return { x: c.cx + c.r, y: c.cy };
  return { x: c.cx + ((p.x - c.cx) / d) * c.r, y: c.cy + ((p.y - c.cy) / d) * c.r };
}

/** The shown guides made ready to snap to: their shapes and every crossing, worked out once. */
export type LogoGuideSnapTargets = {
  lines: GuideLine[];
  circles: GuideCircle[];
  crossings: Point[];
};

export function logoGuideSnapTargets(
  g: LogoGuides,
  shows: (part: LogoGuideSnapPart) => boolean,
): LogoGuideSnapTargets {
  const shapes = logoGuideShapes(g, shows);
  return { ...shapes, crossings: logoGuideCrossings(shapes) };
}

/** `p` snapped to prepared guides within `radius`: a crossing first, else the nearest guide; null
 *  when nothing is that close. */
export function snapToGuideTargets(
  t: LogoGuideSnapTargets,
  p: Point,
  radius: number,
): Point | null {
  let best: Point | null = null;
  let bestD = radius;
  const consider = (q: Point) => {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bestD) {
      best = q;
      bestD = d;
    }
  };
  for (const q of t.crossings) consider(q);
  if (best) return best;
  for (const l of t.lines) consider(nearestOnSegment(l, p));
  for (const c of t.circles) consider(nearestOnCircle(c, p));
  return best;
}

/** `p` snapped to the shown guides within `radius` (prepares them each call: for one-off use). */
export function snapToLogoGuides(
  g: LogoGuides,
  shows: (part: LogoGuideSnapPart) => boolean,
  p: Point,
  radius: number,
): Point | null {
  return snapToGuideTargets(logoGuideSnapTargets(g, shows), p, radius);
}
