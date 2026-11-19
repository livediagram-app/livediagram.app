// docs/specs/020-import-export/svg-import.md "Bold strokes become filled shapes", blueprint "Stroke outlining": a
// stroke as the area it paints, caps, joins and miter limit honoured, within 0.25 px, checked against real bold icon
// sets (Lucide and Tabler shapes) by sampling.
import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { loadCombineEngine } from '@/lib/combine/combine';
import type { Ring } from '@/lib/combine/outline';
import { MAX_PATH_NODES } from '@livedesign/design';
import { SVG_OUTLINE_MAX_POINTS } from './constants';
import { transformContour, type Contour } from './geometry';
import { signedArea2, traceContour, type BooleanEngine } from './nonzero';
import { outlineStroke, strokeRing, traceStroke } from './outline-stroke';
import { parsePathData } from './path-data';
import { lineStyleFrom, lineStyleOf, type LineStyle } from './walk';

describe('line style', () => {
  it("reads caps, joins and the miter limit, SVG's defaults for anything else", () => {
    expect(
      lineStyleFrom({
        'stroke-linecap': ' Round ',
        'stroke-linejoin': 'bevel',
        'stroke-miterlimit': '10',
      }),
    ).toEqual({ cap: 'round', join: 'bevel', miterLimit: 10 });
    expect(lineStyleFrom({ 'stroke-linecap': 'square', 'stroke-linejoin': 'round' })).toEqual({
      cap: 'square',
      join: 'round',
      miterLimit: 4,
    });
    // SVG 2's joins draw as miter (D21); a limit under 1, or unreadable, is ignored.
    expect(
      lineStyleFrom({
        'stroke-linecap': 'wavy',
        'stroke-linejoin': 'miter-clip',
        'stroke-miterlimit': '0.5',
      }),
    ).toEqual({ cap: 'butt', join: 'miter', miterLimit: 4 });
    expect(lineStyleFrom({ 'stroke-linejoin': 'arcs', 'stroke-miterlimit': 'x' })).toEqual({
      cap: 'butt',
      join: 'miter',
      miterLimit: 4,
    });
    expect(lineStyleOf({})).toEqual({ cap: 'butt', join: 'miter', miterLimit: 4 });
    expect(lineStyleOf({ cap: 'round', join: 'bevel', miterLimit: 2 })).toEqual({
      cap: 'round',
      join: 'bevel',
      miterLimit: 2,
    });
  });
});

const engine = (await loadCombineEngine()) as unknown as BooleanEngine;
const ROUND: LineStyle = { cap: 'round', join: 'round', miterLimit: 4 };
const BUTT_MITER: LineStyle = { cap: 'butt', join: 'miter', miterLimit: 4 };

// Path data scaled by `k` (landed px), precise enough for the checks.
const path = (d: string, k = 1): Contour[] =>
  parsePathData(d, k).map((c) => transformContour(c, [k, 0, 0, k, 0, 0]));

// The area of outlines with no holes (each ring counted whole).
const area = (rings: readonly Ring[]) =>
  rings.reduce((a, r) => a + Math.abs(signedArea2(r)) / 2, 0);

// Even-odd point in rings: how the landed path fills.
function inside(rings: readonly Ring[], x: number, y: number): boolean {
  let odd = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i]!;
      const [xj, yj] = r[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
    }
  return odd;
}

// The distance from a point to a polyline traced finely from the contours.
function distanceTo(lines: readonly Ring[], closed: readonly boolean[], x: number, y: number) {
  let best = Infinity;
  lines.forEach((r, k) => {
    const n = closed[k] ? r.length : r.length - 1;
    if (r.length === 1) best = Math.min(best, Math.hypot(x - r[0]![0], y - r[0]![1]));
    for (let i = 0; i < n; i++) {
      const [ax, ay] = r[i]!;
      const [bx, by] = r[(i + 1) % r.length]!;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
      best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
  });
  return best;
}

// Every sampled point more than `band` px clear of the stroke's edge falls on the right side of the outline. With
// round caps and joins the stroke is exactly the points within half its width of the line.
function expectRoundStroke(contours: Contour[], width: number, band = 0.3) {
  const rings = outlineStroke(engine, contours, width, ROUND);
  expect(rings).not.toBeNull();
  // The centreline open: a traced closed ring's last point returns to its first.
  const lines = contours.map((c) => traceContour(c, 0.01));
  const closed = contours.map((c) => c.closed);
  const xs = lines.flat().map((p) => p[0]);
  const ys = lines.flat().map((p) => p[1]);
  const h = width / 2;
  const [x0, x1] = [Math.min(...xs) - h - 2, Math.max(...xs) + h + 2];
  const [y0, y1] = [Math.min(...ys) - h - 2, Math.max(...ys) + h + 2];
  let checked = 0;
  const step = Math.max(x1 - x0, y1 - y0) / 90;
  for (let x = x0; x <= x1; x += step)
    for (let y = y0; y <= y1; y += step) {
      const d = distanceTo(lines, closed, x, y);
      if (Math.abs(d - h) < band) continue;
      expect(inside(rings!, x, y), `(${x.toFixed(2)}, ${y.toFixed(2)}) at ${d.toFixed(2)}`).toBe(
        d < h,
      );
      checked++;
    }
  expect(checked).toBeGreaterThan(1000);
  return rings!;
}

// Lucide (24 px grid, stroke 2, round caps and joins) and Tabler shapes, as their path data.
const LUCIDE = {
  check: 'M20 6 9 17l-5-5',
  heart:
    'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  info: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20z M12 16v-4 M12 8h.01',
  camera:
    'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z M15 13a3 3 0 1 1-6 0a3 3 0 1 1 6 0z',
  tablerHome: 'M5 12l-2 0l9 -9l9 9l-2 0 M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7',
  spiral: 'M12 12c0-1 1-2 2-1s1 3-1 4-4 0-4-3 3-5 6-4 5 4 3 7-6 5-9 2',
};

// Lucide settings: its gear and its middle circle as one path.
const SETTINGS =
  'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0z';

describe('outlineStroke: real bold icons', () => {
  for (const [name, d] of Object.entries(LUCIDE))
    it(`outlines ${name} at page size to the area its round stroke paints`, () => {
      // 24 units at 37.5x: a 900 px icon, its 2-unit strokes 75 px wide.
      expectRoundStroke(path(d, 37.5), 75);
    });

  it('fills in a closed ring whose stroke is wider than the hole', () => {
    const rings = expectRoundStroke(path('M50 40a10 10 0 1 0 0 20a10 10 0 1 0 0-20z'), 30);
    expect(rings).toHaveLength(1);
  });

  it('leaves a hole in a closed ring with a thinner stroke', () => {
    const rings = expectRoundStroke(path('M0 0H100V100H0Z'), 10);
    expect(rings).toHaveLength(2);
  });
});

describe('outlineStroke: caps', () => {
  const line = path('M0 0H100');
  it('butt ends square at the line ends', () => {
    expect(area(outlineStroke(engine, line, 10, BUTT_MITER)!)).toBeCloseTo(1000, 6);
  });
  it('square ends half the width on', () => {
    const rings = outlineStroke(engine, line, 10, { ...BUTT_MITER, cap: 'square' })!;
    expect(area(rings)).toBeCloseTo(1100, 6);
  });
  it('round ends as half circles, within tolerance', () => {
    const a = area(outlineStroke(engine, line, 10, ROUND)!);
    expect(a).toBeLessThanOrEqual(1000 + Math.PI * 25);
    expect(a).toBeGreaterThan(1000 + Math.PI * 25 - 0.125 * 2 * Math.PI * 5);
  });
  it('paints a zero-length line as a dot with round or square caps, and nothing with butt', () => {
    const dot = path('M5 5h0');
    const round = outlineStroke(engine, dot, 10, ROUND)!;
    expect(area(round)).toBeGreaterThan(Math.PI * 25 - 0.125 * 2 * Math.PI * 5);
    expect(area(outlineStroke(engine, dot, 10, { ...ROUND, cap: 'square' })!)).toBeCloseTo(100, 6);
    expect(outlineStroke(engine, dot, 10, BUTT_MITER)).toEqual([]);
  });
});

describe('outlineStroke: joins', () => {
  // A right angle: from (0,0) right to (100,0), then down to (100,100) (y grows down).
  const corner = path('M0 0H100V100');
  const has = (rings: Ring[], x: number, y: number) =>
    rings.some((r) => r.some(([px, py]) => Math.hypot(px - x, py - y) < 1e-6));

  it('miters a right angle to its sharp corner', () => {
    const rings = outlineStroke(engine, corner, 10, BUTT_MITER)!;
    expect(has(rings, 105, -5)).toBe(true);
    // Two 100 x 10 arms sharing a 5 x 5 square inside the corner (1975); the miter fills the 5 x 5 square outside it.
    expect(area(rings)).toBeCloseTo(1975 + 25, 6);
  });

  it('bevels a right angle, and a miter past its limit', () => {
    const bevel = outlineStroke(engine, corner, 10, { ...BUTT_MITER, join: 'bevel' })!;
    expect(has(bevel, 105, -5)).toBe(false);
    expect(area(bevel)).toBeCloseTo(1975 + 12.5, 6);
    // A right angle's miter is √2 times the width: a limit of 1.4 bevels it.
    const limited = outlineStroke(engine, corner, 10, { ...BUTT_MITER, miterLimit: 1.4 })!;
    expect(area(limited)).toBeCloseTo(area(bevel), 6);
  });

  it('rounds a right angle', () => {
    const a = area(outlineStroke(engine, corner, 10, { ...BUTT_MITER, join: 'round' })!);
    expect(a).toBeLessThanOrEqual(1975 + (Math.PI * 25) / 4 + 1e-6);
    expect(a).toBeGreaterThan(1975 + 12.5);
  });

  it('bevels a sharp angle the default limit refuses, and mitres one it allows', () => {
    // A 20 degree turn back: its miter is 1 / sin(10°) ≈ 5.8 widths, past 4.
    const sharp = path(
      `M0 0L100 0L${100 - 100 * Math.cos(Math.PI / 9)} ${100 * Math.sin(Math.PI / 9)}`,
    );
    const rings = outlineStroke(engine, sharp, 10, BUTT_MITER)!;
    const xs = rings.flat().map((p) => p[0]);
    expect(Math.max(...xs)).toBeLessThan(106);
    const allowed = outlineStroke(engine, sharp, 10, { ...BUTT_MITER, miterLimit: 10 })!;
    expect(Math.max(...allowed.flat().map((p) => p[0]))).toBeGreaterThan(125);
  });

  it('turns a line straight back on itself with a join on one side, as wide as the line', () => {
    const rings = outlineStroke(engine, path('M0 0H100H50'), 10, ROUND)!;
    const ys = rings.flat().map((p) => p[1]);
    expect(Math.min(...ys)).toBeCloseTo(-5, 6);
    expect(Math.max(...ys)).toBeCloseTo(5, 6);
    expect(Math.max(...rings.flat().map((p) => p[0]))).toBeCloseTo(105, 1);
  });

  it('strokes a closed contour of two points as a there-and-back line', () => {
    const rings = outlineStroke(engine, path('M0 0H100Z'), 10, { ...BUTT_MITER, join: 'bevel' })!;
    expect(area(rings)).toBeCloseTo(1000, 6);
  });
});

describe('outlineStroke: limits and failures', () => {
  it('gives up past the traced point cap, so the stroke stays a stroke', () => {
    // A long zigzag of round joins: far more points than the cap.
    const zig = Array.from(
      { length: SVG_OUTLINE_MAX_POINTS / 4 },
      (_, i) => `L${i * 3} ${i % 2 ? 40 : 0}`,
    );
    expect(outlineStroke(engine, path(`M0 0${zig.join('')}`), 30, ROUND)).toBeNull();
  });

  it('keeps the stroke a stroke when the engine throws', () => {
    const broken: BooleanEngine = {
      union: () => {
        throw new Error('round-off');
      },
      difference: () => [],
    };
    expect(outlineStroke(broken, path('M0 0H100'), 10, ROUND)).toBeNull();
  });

  it('paints nothing for nothing', () => {
    expect(outlineStroke(engine, [], 10, ROUND)).toEqual([]);
    expect(strokeRing(traceStroke(path('M0 0H10')[0]!, 0.1), 0, ROUND, 0.1)).toBeNull();
  });

  it('marks where source segments meet as corners, not the points inside a traced curve', () => {
    const t = traceStroke(path('M0 0L10 0C20 0 20 10 10 10L10 10Z')[0]!, 0.01);
    expect(t.corner[0]).toBe(true);
    expect(t.corner[1]).toBe(true);
    expect(t.corner.filter((c) => !c).length).toBeGreaterThan(3);
    // The repeated point and the closing return to the start are dropped.
    expect(t.pts.length).toBe(t.corner.length);
    expect(t.pts.at(-1)).not.toEqual(t.pts[0]);
    // A curve of no length traces to its start alone, still a corner.
    const still = traceStroke(path('M5 5C5 5 5 5 5 5')[0]!, 0.01);
    expect(still).toEqual({ pts: [[5, 5]], corner: [true], closed: false });
  });

  it('keeps points that share only an x or only a y with the one before, and a closed end apart from its start', () => {
    // A closed contour whose last point sits straight below its start (same x): nothing is dropped.
    const t = traceStroke(path('M0 0L10 0L10 10L0 10')[0]!, 0.01);
    expect(t.pts).toHaveLength(4);
    const closed: Contour = {
      start: { x: 0, y: 0 },
      segments: [
        { c1: { x: 0, y: 0 }, c2: { x: 0, y: 10 }, to: { x: 0, y: 10 }, line: true },
        { c1: { x: 0, y: 10 }, c2: { x: 10, y: 10 }, to: { x: 10, y: 10 }, line: true },
        { c1: { x: 10, y: 10 }, c2: { x: 0, y: 5 }, to: { x: 0, y: 5 }, line: true },
      ],
      closed: true,
    };
    expect(traceStroke(closed, 0.01).pts).toEqual([
      [0, 0],
      [0, 10],
      [10, 10],
      [0, 5],
    ]);
  });

  it('draws a round part of a stroke thinner than the tolerance as a single chord', () => {
    const ring = strokeRing(traceStroke(path('M0 0H10')[0]!, 0.125), 0.1, ROUND, 0.125)!;
    // Two sides and no arc points: the caps' half circles sag less than the tolerance.
    expect(ring).toHaveLength(4);
  });

  // Bold curves laid out on a 900 px page, each `M ... c ... s ...`, landed at 1.1x with 44 px round strokes.
  const curves = (n: number) =>
    path(
      Array.from(
        { length: n },
        (_, i) => `M${(i % 20) * 45} ${Math.floor(i / 20) * 90}c10 -30 30 -30 40 0s30 30 40 0`,
      ).join(' '),
      1.1,
    );

  it('caps the outline at four traced ring points per path node (D23)', () => {
    expect(SVG_OUTLINE_MAX_POINTS).toBe(4 * MAX_PATH_NODES);
  });

  it('outlines a large bold icon within its CPU budget', () => {
    // 100 overlapping bold curves in one element (16,600 ring points, under the cap): the largest ordinary case.
    const contours = curves(100);
    let rings: Ring[] | null = null;
    const ms = cpuMsOf(() => {
      rings = outlineStroke(engine, contours, 44, ROUND);
    });
    expect(rings).not.toBeNull();
    // Measured about 0.5 s on a developer machine; a real bold icon (Lucide heart, 900 px) takes about 13 ms.
    expect(ms).toBeLessThan(cpuBudgetMs(1500));
  });

  it('keeps a stroke too detailed to outline a stroke at once, before any union', () => {
    // 200 bold curves in one path (33,200 ring points): the union took about 2 s to make 7,440 nodes, past a path's
    // 5,000, only for the stroke to stay a stroke. It now stops before the union.
    const contours = curves(200);
    const union = vi.spyOn(engine, 'union');
    let rings: Ring[] | null = [];
    const ms = cpuMsOf(() => {
      rings = outlineStroke(engine, contours, 44, ROUND);
    });
    expect(rings).toBeNull();
    expect(union).not.toHaveBeenCalled();
    union.mockRestore();
    expect(ms).toBeLessThan(cpuBudgetMs(200));
    // Lucide heart and settings, at page size, still outline.
    for (const d of [LUCIDE.heart, SETTINGS])
      expect(outlineStroke(engine, path(d, 1024 / 24), 1024 / 12, ROUND)).not.toBeNull();
  });
});
