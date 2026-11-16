// SVG's basic shapes as path segments (SVG 2 §10, "Basic Shapes"), so every shape is drawn by one path routine.
import type { Matrix } from './matrix';
import { parsePath, type Segment } from './svg-path';

// The cubic that draws a quarter circle most closely.
const KAPPA = 0.5522847498;

const len = (el: Element, name: string, fallback = 0): number => {
  const v = parseFloat(el.getAttribute(name) ?? '');
  return Number.isFinite(v) ? v : fallback;
};

function ellipse(cx: number, cy: number, rx: number, ry: number): Segment[] {
  if (rx <= 0 || ry <= 0) return [];
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  return [
    { k: 'M', x: cx + rx, y: cy },
    { k: 'C', x1: cx + rx, y1: cy + ky, x2: cx + kx, y2: cy + ry, x: cx, y: cy + ry },
    { k: 'C', x1: cx - kx, y1: cy + ry, x2: cx - rx, y2: cy + ky, x: cx - rx, y: cy },
    { k: 'C', x1: cx - rx, y1: cy - ky, x2: cx - kx, y2: cy - ry, x: cx, y: cy - ry },
    { k: 'C', x1: cx + kx, y1: cy - ry, x2: cx + rx, y2: cy - ky, x: cx + rx, y: cy },
    { k: 'Z' },
  ];
}

/** A rect, its corners rounded by rx and ry (each standing in for the other when only one is set). */
export function rectSegments(
  x: number,
  y: number,
  w: number,
  h: number,
  rxIn?: number,
  ryIn?: number,
): Segment[] {
  if (w <= 0 || h <= 0) return [];
  let rx = rxIn ?? ryIn ?? 0;
  let ry = ryIn ?? rxIn ?? 0;
  rx = Math.min(Math.max(0, rx), w / 2);
  ry = Math.min(Math.max(0, ry), h / 2);
  if (rx === 0 || ry === 0) {
    return [
      { k: 'M', x, y },
      { k: 'L', x: x + w, y },
      { k: 'L', x: x + w, y: y + h },
      { k: 'L', x, y: y + h },
      { k: 'Z' },
    ];
  }
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  const r = x + w;
  const b = y + h;
  return [
    { k: 'M', x: x + rx, y },
    { k: 'L', x: r - rx, y },
    { k: 'C', x1: r - rx + kx, y1: y, x2: r, y2: y + ry - ky, x: r, y: y + ry },
    { k: 'L', x: r, y: b - ry },
    { k: 'C', x1: r, y1: b - ry + ky, x2: r - rx + kx, y2: b, x: r - rx, y: b },
    { k: 'L', x: x + rx, y: b },
    { k: 'C', x1: x + rx - kx, y1: b, x2: x, y2: b - ry + ky, x, y: b - ry },
    { k: 'L', x, y: y + ry },
    { k: 'C', x1: x, y1: y + ry - ky, x2: x + rx - kx, y2: y, x: x + rx, y },
    { k: 'Z' },
  ];
}

function points(el: Element): Segment[] {
  const nums: number[] = [];
  for (const part of (el.getAttribute('points') ?? '').split(/[\s,]+/)) {
    if (!part) continue;
    const n = Number(part);
    if (!Number.isFinite(n)) break;
    nums.push(n);
  }
  const out: Segment[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    out.push({ k: i === 0 ? 'M' : 'L', x: nums[i]!, y: nums[i + 1]! });
  }
  return out;
}

const optional = (el: Element, name: string): number | undefined => {
  const v = parseFloat(el.getAttribute(name) ?? '');
  return Number.isFinite(v) && v >= 0 ? v : undefined;
};

/** The element's geometry as segments, or null when it is not a shape. */
export function shapeSegments(el: Element): Segment[] | null {
  switch (el.localName) {
    case 'path':
      return parsePath(el.getAttribute('d') ?? '');
    case 'rect':
      return rectSegments(
        len(el, 'x'),
        len(el, 'y'),
        len(el, 'width'),
        len(el, 'height'),
        optional(el, 'rx'),
        optional(el, 'ry'),
      );
    case 'circle': {
      const r = len(el, 'r');
      return ellipse(len(el, 'cx'), len(el, 'cy'), r, r);
    }
    case 'ellipse':
      return ellipse(len(el, 'cx'), len(el, 'cy'), len(el, 'rx'), len(el, 'ry'));
    case 'line':
      return [
        { k: 'M', x: len(el, 'x1'), y: len(el, 'y1') },
        { k: 'L', x: len(el, 'x2'), y: len(el, 'y2') },
      ];
    case 'polyline':
      return points(el);
    case 'polygon': {
      const pts = points(el);
      return pts.length ? [...pts, { k: 'Z' }] : pts;
    }
    default:
      return null;
  }
}

/** The box the segments' points and control points span (a little over the curve's own bounds), or null. */
export function segmentBounds(
  segments: readonly Segment[],
): { x: number; y: number; w: number; h: number } | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const s of segments) {
    if (s.k === 'Z') continue;
    if (s.k === 'C') {
      add(s.x1, s.y1);
      add(s.x2, s.y2);
    }
    add(s.x, s.y);
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The segments with every point moved by `m`. */
export function transformSegments(segs: readonly Segment[], m: Matrix): Segment[] {
  const p = (x: number, y: number) =>
    [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] as const;
  return segs.map((s) => {
    if (s.k === 'Z') return s;
    if (s.k === 'C') {
      const [x1, y1] = p(s.x1, s.y1);
      const [x2, y2] = p(s.x2, s.y2);
      const [x, y] = p(s.x, s.y);
      return { k: 'C', x1, y1, x2, y2, x, y };
    }
    const [x, y] = p(s.x, s.y);
    return { k: s.k, x, y };
  });
}
