// Route-quality measures over a laid-out tab (plan 0026 "Arrow routing"), for the routing fixtures: what makes graph
// input's arrows read as generated, counted so a change to the routing is judged by numbers, not by eye.
//
//   - shared: px of two arrows lying along one line (the same horizontal or vertical run), away from their ends;
//   - strikes: arrows crossing a frame's heading (its label, top left);
//   - kinks: arrows whose route jogs by a step too short to read as a bend, or turns back on itself (an elbow stored
//     with tiny symmetric bends draws a nearly straight line with a notch in it);
//   - crossings, behind, collisions: the lint's own counts; extent: the drawing's size.

import type { Element, Point, Tab } from '@livediagram/document';
import { lintTab } from '../lint';
import { prepareLintContext } from '../context';

export type RouteMeasures = {
  shared: number;
  // Of `shared`, px between arrows with no end box in common: lines a reader cannot tell apart, where arrows that
  // share an end run together as a bus (a tree's connectors, a fan into one node) by design.
  crossed: number;
  strikes: number;
  kinks: number;
  crossings: number;
  behind: number;
  collisions: number;
  extent: string;
};

// Two runs on one line: within this many px of each other across it.
const SAME_LINE = 2;
// Runs near an arrow's ends converge on a shared side by design (the endpoint spread separates the heads).
const END_ROOM = 24;
// A frame's heading: its label's estimated width, at about this many px a character plus its padding, this tall.
const HEADING_CHAR_PX = 8;
const HEADING_PAD = 24;
const HEADING_HEIGHT = 36;

type Run = { horizontal: boolean; at: number; from: number; to: number };

// An arrow's axis-aligned runs, each trimmed by END_ROOM where it meets the arrow's first or last point.
function runsOf(points: readonly Point[]): Run[] {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const out: Run[] = [];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1]!, points[i]!];
    const horizontal = Math.abs(a.y - b.y) < 0.5;
    if (!horizontal && Math.abs(a.x - b.x) >= 0.5) continue;
    const [p, q] = horizontal ? [a.x, b.x] : [a.y, b.y];
    let [from, to] = p < q ? [p, q] : [q, p];
    const trim = (end: Point) => {
      const e = horizontal ? end.x : end.y;
      const onLine = horizontal ? Math.abs(end.y - a.y) < 0.5 : Math.abs(end.x - a.x) < 0.5;
      if (!onLine) return;
      if (Math.abs(e - from) < 0.5) from += END_ROOM;
      if (Math.abs(e - to) < 0.5) to -= END_ROOM;
    };
    trim(first);
    trim(last);
    if (to > from) out.push({ horizontal, at: horizontal ? a.y : a.x, from, to });
  }
  return out;
}

function sharedLength(a: readonly Run[], b: readonly Run[]): number {
  let total = 0;
  for (const r of a)
    for (const s of b) {
      if (r.horizontal !== s.horizontal || Math.abs(r.at - s.at) > SAME_LINE) continue;
      total += Math.max(0, Math.min(r.to, s.to) - Math.max(r.from, s.from));
    }
  return total;
}

// A run between two turns shorter than this reads as a notch, not a bend.
const KINK_RUN = 12;

// Whether a route kinks: an interior run shorter than KINK_RUN, or two runs in a row heading opposite ways.
function kinked(points: readonly Point[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1]!, points[i]!];
    const interior = i > 1 && i < points.length - 1;
    if (interior && Math.hypot(b.x - a.x, b.y - a.y) < KINK_RUN) return true;
    if (i < 2) continue;
    const z = points[i - 2]!;
    if ((a.x - z.x) * (b.x - a.x) + (a.y - z.y) * (b.y - a.y) < 0) return true;
  }
  return false;
}

type Rect = { x: number; y: number; width: number; height: number };

const inside = (p: Point, r: Rect) =>
  p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

// Whether a segment passes through a rectangle: an end inside it, or it crossing one of the rectangle's sides.
function segmentHits(a: Point, b: Point, r: Rect): boolean {
  if (inside(a, r) || inside(b, r)) return true;
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (inside({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, r)) return true;
  }
  return false;
}

function headingsOf(elements: readonly Element[]): Rect[] {
  return elements.flatMap((el) =>
    el.type === 'shape' && el.shape === 'frame' && el.label?.trim()
      ? [
          {
            x: el.x,
            y: el.y,
            width: el.label.trim().length * HEADING_CHAR_PX + HEADING_PAD,
            height: HEADING_HEIGHT,
          },
        ]
      : [],
  );
}

export function routeMeasures(tab: Pick<Tab, 'elements' | 'layers' | 'theme'>): RouteMeasures {
  const ctx = prepareLintContext(tab, { source: 'tab' });
  const routes = ctx.drawable.map((d) => d.polyline);
  const runs = routes.map(runsOf);
  const ends = ctx.drawable.map((d) => [d.from?.id, d.to?.id].filter((id): id is string => !!id));
  let shared = 0;
  let crossed = 0;
  for (let i = 0; i < runs.length; i++)
    for (let j = i + 1; j < runs.length; j++) {
      const length = sharedLength(runs[i]!, runs[j]!);
      shared += length;
      if (!ends[i]!.some((id) => ends[j]!.includes(id))) crossed += length;
    }
  const headings = headingsOf(ctx.visible);
  const strikes = routes.filter((points) =>
    headings.some((h) => points.some((p, i) => i > 0 && segmentHits(points[i - 1]!, p, h))),
  ).length;
  const report = lintTab(tab, { log: () => {} });
  const count = (code: string) => report.findings.filter((f) => f.code === code).length;
  const extent = report.measures.extent;
  return {
    shared: Math.round(shared),
    crossed: Math.round(crossed),
    strikes,
    kinks: routes.filter(kinked).length,
    // Null when the pair check was skipped: none counted.
    crossings: Number(report.measures.crossings),
    behind: report.measures.behind,
    collisions: count('label-collision'),
    extent: extent ? `${extent.width}×${extent.height}` : 'none',
  };
}
