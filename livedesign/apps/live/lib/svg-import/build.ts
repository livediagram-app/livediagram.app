// Drawn SVG elements as livedesign path elements (docs/specs/020-import-export/svg-import.md "Geometry", "Style"):
// each contour's segments as anchors with handles, smooth nodes marked aligned or mirrored, the paint as the path's
// fill, stroke preset and opacity.
import {
  BORDER_STROKE_PX,
  pathOfContours,
  type BorderStroke,
  type PathAnchor,
  type PathElement,
} from '@livedesign/design';
import type { Contour, Pt, Segment } from './geometry';
import type { Drawn } from './walk';

// Two points closer than this (landed px) are one.
const SAME_POINT_PX = 1e-6;
// Handles within this angle (as the sine between them) of a straight line through their node make it smooth.
const SMOOTH_SINE = 1e-3;
// Handles within this share of each other's length make a smooth node mirrored.
const MIRRORED_SHARE = 0.01;

const same = (a: Pt, b: Pt) =>
  Math.abs(a.x - b.x) < SAME_POINT_PX && Math.abs(a.y - b.y) < SAME_POINT_PX;

// A node's mode from its handles: aligned when they point straight through it, mirrored when also equal.
function modeOf(a: PathAnchor): PathAnchor['mode'] {
  if (!a.handleIn || !a.handleOut) return 'corner';
  const ix = a.handleIn.x - a.x;
  const iy = a.handleIn.y - a.y;
  const ox = a.handleOut.x - a.x;
  const oy = a.handleOut.y - a.y;
  const li = Math.hypot(ix, iy);
  const lo = Math.hypot(ox, oy);
  if (li === 0 || lo === 0) return 'corner';
  const sine = (ix * oy - iy * ox) / (li * lo);
  const dot = ix * ox + iy * oy;
  if (Math.abs(sine) > SMOOTH_SINE || dot >= 0) return 'corner';
  return Math.abs(li - lo) <= MIRRORED_SHARE * Math.max(li, lo) ? 'mirrored' : 'aligned';
}

/**
 * A contour's anchors. In a closed path the end node that lands back on the start is folded into it (its handle
 * carried over); in an open path a closed contour keeps that end node, so it still draws closed.
 */
export function contourAnchors(c: Contour, closedPath: boolean): PathAnchor[] {
  const anchors: PathAnchor[] = [{ x: c.start.x, y: c.start.y, mode: 'corner' }];
  for (const s of c.segments) {
    const prev = anchors[anchors.length - 1]!;
    // A straight segment of no length adds nothing.
    if (s.line && same(s.to, prev)) continue;
    const next: PathAnchor = { x: s.to.x, y: s.to.y, mode: 'corner' };
    if (!s.line) {
      if (!same(s.c1, prev)) prev.handleOut = { ...s.c1 };
      if (!same(s.c2, next)) next.handleIn = { ...s.c2 };
    }
    anchors.push(next);
  }
  if (closedPath && anchors.length > 2) {
    const first = anchors[0]!;
    const last = anchors[anchors.length - 1]!;
    if (same(first, last)) {
      if (last.handleIn) first.handleIn = last.handleIn;
      anchors.pop();
    }
  }
  for (const a of anchors) a.mode = modeOf(a);
  return anchors;
}

// A cubic split in two at its middle (de Casteljau).
function halve(from: Pt, s: Segment): [Segment, Segment] {
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const ab = mid(from, s.c1);
  const bc = mid(s.c1, s.c2);
  const cd = mid(s.c2, s.to);
  const abc = mid(ab, bc);
  const bcd = mid(bc, cd);
  const m = mid(abc, bcd);
  return [
    { c1: ab, c2: abc, to: m },
    { c1: bcd, c2: cd, to: s.to },
  ];
}

/** A closed contour with at least three nodes where its curves allow: a ring drawn as two arcs gains a node in its
 *  first curve, since a path's further contours need three. One of straight lines alone is left as it is. */
export function withThreeNodes(c: Contour): Contour {
  const segments = [...c.segments];
  let pen = c.start;
  for (let i = 0; i < segments.length && segments.length < 3; i++) {
    const s = segments[i]!;
    if (!s.line) {
      segments.splice(i, 1, ...halve(pen, s));
      i = -1;
      pen = c.start;
      continue;
    }
    pen = s.to;
  }
  return { ...c, segments };
}

/** A landed stroke width as the nearest preset. */
export function strokePreset(px: number): BorderStroke {
  const presets: BorderStroke[] = ['thin', 'medium', 'thick', 'extra-thick'];
  let best: BorderStroke = 'thin';
  for (const p of presets)
    if (Math.abs(BORDER_STROKE_PX[p] - px) < Math.abs(BORDER_STROKE_PX[best] - px)) best = p;
  return best;
}

/** One drawn element (already landed: in canvas px) as a path element; null when it leaves nothing to draw. A
 *  filled element is closed; an unfilled one is closed only when every contour is. */
export function drawnToPath(d: Drawn, id: string): PathElement | null {
  const closed = d.fill !== null || d.contours.every((c) => c.closed);
  const contours = d.contours
    .map((c) => contourAnchors(closed ? withThreeNodes(c) : c, closed))
    .filter((a) => a.length >= (closed ? 3 : 2));
  if (contours.length === 0) return null;
  const base: Omit<PathElement, 'x' | 'y' | 'width' | 'height' | 'nodes' | 'subpaths'> = {
    id,
    type: 'path',
    closed,
    strokeWidth: d.stroke ? strokePreset(d.stroke.width) : 'none',
  };
  if (d.fill) base.fillColor = d.fill.hex;
  if (d.stroke) base.strokeColor = d.stroke.hex;
  const opacity = d.opacity * (d.fill ? d.fill.alpha : (d.stroke?.alpha ?? 1));
  if (opacity < 0.995) base.opacity = Math.round(opacity * 100) / 100;
  return pathOfContours(base, contours);
}

/** How many nodes a path holds, every contour counted. */
export function nodeCount(p: Pick<PathElement, 'nodes' | 'subpaths'>): number {
  return p.nodes.length + (p.subpaths ?? []).reduce((n, s) => n + s.length, 0);
}
