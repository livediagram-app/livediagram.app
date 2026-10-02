// Ported from draw.io, Copyright (c) 2006-2015 JGraph Holdings Ltd and draw.io AG, Apache-2.0
// (packages/licences/texts/drawio-31.7.0-LICENSE.txt); translated to TypeScript and changed.
// A cell as draw.io's view sees it while routing (port of mxCellState, jgraph/drawio v31.7.0,
// Apache-2.0): its box in absolute draw.io units, its style read the way draw.io reads styles,
// and, for an edge, its routed points.

import type { DrawioStyle } from '../style';
import { centreX, centreY, type Box, type Pt } from './geometry';

/** A style value as mxStylesheet.getCellStyle leaves it: `none` removes the key, numeric text
 *  becomes a number, anything else stays text. */
export type StyleValue = string | number | undefined;

// mxUtils.isNumeric
const isNumeric = (v: string) =>
  !Number.isNaN(parseFloat(v)) && Number.isFinite(Number(v)) && !v.toLowerCase().includes('0x');

/** mxStylesheet.getCellStyle's reading of one key. */
export function styleValue(style: DrawioStyle, key: string): StyleValue {
  const raw = style.str(key);
  if (raw === undefined || raw === 'none') return undefined;
  return isNumeric(raw) ? parseFloat(raw) : raw;
}

/** JavaScript truthiness of a style value, as draw.io's `if (style[key])` tests it. */
export const truthy = (v: StyleValue): boolean =>
  v !== undefined && v !== '' && v !== 0 && !Number.isNaN(v);

/** A numeric style value, as `parseFloat(style[key] || fallback)` reads it. */
export function styleNumber(style: DrawioStyle, key: string, fallback = 0): number {
  const v = styleValue(style, key);
  const n = typeof v === 'number' ? v : v === undefined ? NaN : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export type CellState = Box & {
  cellId: string;
  style: DrawioStyle;
  vertex: boolean;
  /** A relative geometry's x (a fraction of the parent, or along an edge); null when absolute.
   *  EntityRelation reads it. */
  relativeX: number | null;
  /** An edge: its routed points, segment lengths and total length (mxGraphView.updateEdgeBounds). */
  absolutePoints?: Pt[];
  segments?: number[];
  length?: number;
};

export function vertexState(
  cellId: string,
  rect: Box,
  style: DrawioStyle,
  relativeX: number | null,
): CellState {
  return { cellId, ...rect, style, vertex: true, relativeX };
}

/** mxGraphView.updateEdgeBounds: an edge's state from its routed points. */
export function edgeState(
  cellId: string,
  style: DrawioStyle,
  points: Pt[],
  relativeX: number | null,
): CellState {
  const segments: number[] = [];
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const segment = Math.hypot(points[i - 1]!.x - points[i]!.x, points[i - 1]!.y - points[i]!.y);
    segments.push(segment);
    length += segment;
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    cellId,
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
    style,
    vertex: false,
    relativeX,
    absolutePoints: points,
    segments,
    length,
  };
}

/** mxGraphView.getPoint without a geometry: an edge's middle along its path, a vertex's centre. */
export function statePoint(state: CellState): Pt {
  const pts = state.absolutePoints;
  if (!pts || !state.segments || state.length === undefined) {
    return { x: centreX(state), y: centreY(state) };
  }
  return pointAlong(state, 0, 0, undefined);
}

/** mxGraphView.getPoint: the point `gx` (-1..1) along an edge's path, moved `gy` along the
 *  segment's normal and by `offset`. */
export function pointAlong(state: CellState, gx: number, gy: number, offset: Pt | undefined): Pt {
  const pts = state.absolutePoints!;
  const segments = state.segments!;
  const total = state.length!;
  const dist = Math.round((gx / 2 + 0.5) * total);
  let segment = segments[0] ?? 0;
  let length = 0;
  let index = 1;
  while (dist >= Math.round(length + segment) && index < pts.length - 1) {
    length += segment;
    segment = segments[index++] ?? 0;
  }
  const factor = segment === 0 ? 0 : (dist - length) / segment;
  const p0 = pts[index - 1]!;
  const pe = pts[index] ?? p0;
  const dx = pe.x - p0.x;
  const dy = pe.y - p0.y;
  const nx = segment === 0 ? 0 : dy / segment;
  const ny = segment === 0 ? 0 : dx / segment;
  return {
    x: p0.x + dx * factor + (nx * gy + (offset?.x ?? 0)),
    y: p0.y + dy * factor - (ny * gy - (offset?.y ?? 0)),
  };
}

/** mxShape.getWaypoints at scale 1: the points draw.io paints, each one closer than a pixel on both
 *  axes to the point before it (as routed, kept or not) left out. */
export function drawnPoints(points: Pt[]): Pt[] {
  if (points.length === 0) return [];
  const out = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const p = points[i]!;
    if (Math.abs(prev.x - p.x) >= 1 || Math.abs(prev.y - p.y) >= 1) out.push(p);
  }
  return out;
}
