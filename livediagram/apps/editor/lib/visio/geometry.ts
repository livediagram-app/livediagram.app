// A Visio shape's geometry sections (docs/specs/020-import-export/visio-import.md "Shapes", "Connectors"): what a
// shape with no master draws, read from its points, and the vertices a connector's route passes through.

import { finite, sectionCell, sectionRows, type ShapeSheet } from './sheet';

export type InferredGeometry = 'ellipse' | 'rect' | 'diamond' | 'text' | 'other';

type Pt = { x: number; y: number };

const MOVE_OR_LINE = new Set(['MoveTo', 'LineTo', 'RelMoveTo', 'RelLineTo']);
const CURVED = new Set([
  'ArcTo',
  'EllipticalArcTo',
  'RelEllipticalArcTo',
  'NURBSTo',
  'SplineStart',
  'SplineKnot',
  'RelCubBezTo',
  'RelQuadBezTo',
]);

const visibleSections = (sheet: ShapeSheet) =>
  sheet.sections('Geometry').filter((s) => sectionCell(s, 'NoShow') !== '1');

/** A row's end point in the shape's own inches; `Rel*` rows are fractions of the box. */
function rowPoint(
  row: { type: string; cells: Map<string, string> },
  width: number,
  height: number,
): Pt | null {
  const x = finite(row.cells.get('X'));
  const y = finite(row.cells.get('Y'));
  if (x === undefined || y === undefined) return null;
  return row.type.startsWith('Rel') ? { x: x * width, y: y * height } : { x, y };
}

function distinct(points: Pt[], tolerance: number): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    if (!out.some((q) => Math.abs(q.x - p.x) <= tolerance && Math.abs(q.y - p.y) <= tolerance))
      out.push(p);
  }
  return out;
}

function matchesAll(points: Pt[], targets: Pt[], tolerance: number): boolean {
  if (points.length !== targets.length) return false;
  return targets.every((t) =>
    points.some((p) => Math.abs(p.x - t.x) <= tolerance && Math.abs(p.y - t.y) <= tolerance),
  );
}

/** What a shape with no master draws, from its geometry. */
export function inferGeometry(sheet: ShapeSheet, width: number, height: number): InferredGeometry {
  const sections = visibleSections(sheet);
  if (sections.length === 0) return 'text';
  if (sections.every((s) => sectionCell(s, 'NoFill') === '1' && sectionCell(s, 'NoLine') === '1'))
    return 'text';
  if (sections.length !== 1) return 'other';
  const rows = sectionRows(sections[0]!).filter((r) => r.type !== '');
  if (rows.length === 1 && rows[0]!.type === 'Ellipse') return 'ellipse';
  if (rows.length === 0 || !rows.every((r) => MOVE_OR_LINE.has(r.type))) return 'other';
  const tolerance = Math.max(Math.abs(width), Math.abs(height), 1) * 1e-3;
  const points: Pt[] = [];
  for (const row of rows) {
    const p = rowPoint(row, width, height);
    if (!p) return 'other';
    points.push(p);
  }
  const corners = distinct(points, tolerance);
  const box = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  if (matchesAll(corners, box, tolerance)) return 'rect';
  const middles = [
    { x: width / 2, y: 0 },
    { x: width, y: height / 2 },
    { x: width / 2, y: height },
    { x: 0, y: height / 2 },
  ];
  return matchesAll(corners, middles, tolerance) ? 'diamond' : 'other';
}

/**
 * A connector's route in its own inches: every row's end point in order, and whether a row draws a curve. The
 * first and last are its ends; the caller keeps the ones between as waypoints.
 */
export function routePoints(
  sheet: ShapeSheet,
  width: number,
  height: number,
): { points: Pt[]; curved: boolean } {
  const section = visibleSections(sheet)[0];
  if (!section) return { points: [], curved: false };
  const points: Pt[] = [];
  let curved = false;
  for (const row of sectionRows(section)) {
    if (row.type === '') continue;
    if (CURVED.has(row.type)) curved = true;
    const p = rowPoint(row, width, height);
    if (p) points.push(p);
  }
  return { points, curved };
}
