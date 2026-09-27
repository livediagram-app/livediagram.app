// Ink geometry of a glyph (docs/specs/004-interface-design/iconography.md, "Ink insets"): the union bounding box of
// its drawn primitives and the blank margin it leaves per side, stroke included. Pure and synchronous, so a
// renderer can emit the insets during render (static export, no layout shift) and a test can reuse them.
import { svgPathBbox } from 'svg-path-bbox';

import type { IconPrim } from './types';

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
export type InkInsets = { l: number; r: number; t: number; b: number };

const pathCache = new Map<string, Bounds>();

export function pathBounds(d: string): Bounds {
  let b = pathCache.get(d);
  if (!b) {
    const [minX, minY, maxX, maxY] = svgPathBbox(d);
    b = { minX, minY, maxX, maxY };
    pathCache.set(d, b);
  }
  return b;
}

function pointsBounds(points: string): Bounds | null {
  const n = points
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (n.length < 2 || n.some(Number.isNaN)) return null;
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

export function primBounds(p: IconPrim): Bounds | null {
  switch (p.t) {
    case 'path':
      return p.d ? pathBounds(p.d) : null;
    case 'circle':
      return { minX: p.cx - p.r, minY: p.cy - p.r, maxX: p.cx + p.r, maxY: p.cy + p.r };
    case 'ellipse':
      return { minX: p.cx - p.rx, minY: p.cy - p.ry, maxX: p.cx + p.rx, maxY: p.cy + p.ry };
    case 'rect':
      return { minX: p.x, minY: p.y, maxX: p.x + p.w, maxY: p.y + p.h };
    case 'line':
      return {
        minX: Math.min(p.x1, p.x2),
        minY: Math.min(p.y1, p.y2),
        maxX: Math.max(p.x1, p.x2),
        maxY: Math.max(p.y1, p.y2),
      };
    case 'polyline':
    case 'polygon':
      return pointsBounds(p.points);
    case 'text':
      return null;
  }
}

export function unionBounds(all: readonly (Bounds | null)[]): Bounds | null {
  let u: Bounds | null = null;
  for (const b of all) {
    if (!b) continue;
    u = u
      ? {
          minX: Math.min(u.minX, b.minX),
          minY: Math.min(u.minY, b.minY),
          maxX: Math.max(u.maxX, b.maxX),
          maxY: Math.max(u.maxY, b.maxY),
        }
      : b;
  }
  return u;
}

export function primsBounds(prims: readonly IconPrim[]): Bounds | null {
  return unionBounds(prims.map(primBounds));
}

const r2 = (v: number) => Math.round(Math.max(0, v) * 100) / 100 + 0;

// Blank margin per side in rendered px. `strokePx` is the on-screen stroke (0 for filled glyphs); half of it
// sits outside the geometry on every side (round caps and joins).
export function inkInsets(
  b: Bounds,
  o: { units: number; sizePx: number; strokePx: number },
): InkInsets {
  const scale = o.sizePx / o.units;
  const half = o.strokePx / 2;
  return {
    l: r2(b.minX * scale - half),
    r: r2((o.units - b.maxX) * scale - half),
    t: r2(b.minY * scale - half),
    b: r2((o.units - b.maxY) * scale - half),
  };
}
