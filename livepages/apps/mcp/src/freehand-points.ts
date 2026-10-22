// A hand-drawn stroke as a model writes it (docs/specs/015-api/mcp-server.md "Hand-drawn strokes"): a freehand
// element given `points` as canvas coordinates, `[[x, y], ...]`, the way a line is naturally described. The
// stored form is a box and the points packed inside it (docs/specs/006-document/stroke-points.md), which no
// model can write by hand, so the stroke's box is taken from its points and the points are packed by the
// shared codec, through the stored-tab migration every entry point runs.

import { isRecord, MAX_FREEHAND_POINTS, migrateIncomingElements } from '@livepages/document';

type Rec = Record<string, unknown>;

const isPoint = (p: unknown): p is [number, number] =>
  Array.isArray(p) &&
  p.length === 2 &&
  typeof p[0] === 'number' &&
  typeof p[1] === 'number' &&
  Number.isFinite(p[0]) &&
  Number.isFinite(p[1]);

// One freehand element with canvas points made into its stored form, or why it cannot be.
function packed(el: Rec, where: string): Rec | string {
  const points: unknown = el.points;
  if (
    !Array.isArray(points) ||
    points.length === 0 ||
    points.length > MAX_FREEHAND_POINTS ||
    !points.every(isPoint)
  )
    return `${where}: "points" takes 1 to ${MAX_FREEHAND_POINTS} canvas points, [[x, y], ...]`;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  // The given points are the stroke: a packed form echoed from a read (packedPoints) is left behind, or the migration
  // would keep it and stretch the old drawing into the new points' box.
  const { points: _given, packedPoints: _old, ...rest } = el;
  const [stored] = migrateIncomingElements([
    {
      closed: false,
      ...rest,
      x,
      y,
      width,
      height,
      points: points.map(([px, py]) => ({
        nx: width > 0 ? (px - x) / width : 0,
        ny: height > 0 ? (py - y) / height : 0,
      })),
    },
  ]);
  return stored as unknown as Rec;
}

// The elements with every freehand stroke given canvas points packed, or the first that cannot be. Any other
// element, and a stroke already carrying `packedPoints`, passes through as given.
export function packFreehandPoints(
  elements: readonly unknown[],
): { elements: unknown[] } | { error: string } {
  const out: unknown[] = [];
  for (const [i, el] of elements.entries()) {
    if (!isRecord(el) || el.type !== 'freehand' || el.points === undefined) {
      out.push(el);
      continue;
    }
    const where = typeof el.id === 'string' ? `element "${el.id}"` : `element ${i + 1}`;
    const made = packed(el, where);
    if (typeof made === 'string') return { error: made };
    out.push(made);
  }
  return { elements: out };
}
