// Geometric centring of SVG glyph markup (docs/specs/004-interface-design/iconography.md, "Guarding"):
// the drawn geometry's bounding-box centre, stroke included, measured against the viewBox centre.
// Test-only surface (subpath `@livediagram/icons/centring`); app code never imports it.
import { pathBounds, unionBounds, type Bounds } from './ink';

export type { Bounds };

const ELEMENT = /<(path|circle|ellipse|rect|line|polyline|polygon)\b([^>]*)>/g;
const ATTR = /([a-zA-Z][\w:-]*)="([^"]*)"/g;

function attrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(ATTR)) out[m[1]!] = m[2]!;
  return out;
}

function elementBounds(tag: string, a: Record<string, string>): Bounds | null {
  const n = (k: string) => Number(a[k] ?? 0);
  switch (tag) {
    case 'path':
      return a.d ? pathBounds(a.d) : null;
    case 'circle':
      return {
        minX: n('cx') - n('r'),
        minY: n('cy') - n('r'),
        maxX: n('cx') + n('r'),
        maxY: n('cy') + n('r'),
      };
    case 'ellipse':
      return {
        minX: n('cx') - n('rx'),
        minY: n('cy') - n('ry'),
        maxX: n('cx') + n('rx'),
        maxY: n('cy') + n('ry'),
      };
    case 'rect':
      return { minX: n('x'), minY: n('y'), maxX: n('x') + n('width'), maxY: n('y') + n('height') };
    case 'line':
      return {
        minX: Math.min(n('x1'), n('x2')),
        minY: Math.min(n('y1'), n('y2')),
        maxX: Math.max(n('x1'), n('x2')),
        maxY: Math.max(n('y1'), n('y2')),
      };
    default: {
      const pts = (a.points ?? '')
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (pts.length < 2) return null;
      const xs = pts.filter((_, i) => i % 2 === 0);
      const ys = pts.filter((_, i) => i % 2 === 1);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
    }
  }
}

// Union bounds of every shape in `markup`, padded by half of `strokeUnits`. Null when there is no
// geometry, or when a transform makes the plain attribute geometry untrustworthy.
export function markupBounds(markup: string, strokeUnits: number): Bounds | null {
  if (/\btransform=/.test(markup)) return null;
  const b = unionBounds(
    [...markup.matchAll(ELEMENT)].map((m) => elementBounds(m[1]!, attrs(m[2]!))),
  );
  if (!b) return null;
  const p = strokeUnits / 2;
  return { minX: b.minX - p, minY: b.minY - p, maxX: b.maxX + p, maxY: b.maxY + p };
}

// Offset of the ink centre from the viewBox centre, in rendered CSS px. Null when unmeasurable.
export function centreOffsetPx(
  markup: string,
  o: { units: number; sizePx: number; strokeUnits: number },
): { dx: number; dy: number } | null {
  const b = markupBounds(markup, o.strokeUnits);
  if (!b) return null;
  const scale = o.sizePx / o.units;
  const round = (v: number) => Math.round(v * 1000) / 1000 + 0;
  return {
    dx: round(((b.minX + b.maxX) / 2 - o.units / 2) * scale),
    dy: round(((b.minY + b.maxY) / 2 - o.units / 2) * scale),
  };
}
