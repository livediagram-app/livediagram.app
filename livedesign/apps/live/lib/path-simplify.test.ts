import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { cubicAt, type PathAnchor } from '@livedesign/design';
import {
  isSimplifiable,
  simplifyContour,
  SIMPLIFY_MIN_NODES,
  SIMPLIFY_TOLERANCE_PX,
} from './path-simplify';

const corner = (x: number, y: number): PathAnchor => ({ x, y, mode: 'corner' });

// A circle traced as Combine traces one: many corner points on it.
const tracedCircle = (n: number, r = 100, cx = 200, cy = 200): PathAnchor[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return corner(cx + r * Math.cos(a), cy + r * Math.sin(a));
  });

// Points along the simplified outline, densely.
function outline(anchors: readonly PathAnchor[], closed: boolean): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const segs = closed ? anchors.length : anchors.length - 1;
  for (let k = 0; k < segs; k++) {
    const s = anchors[k]!;
    const e = anchors[(k + 1) % anchors.length]!;
    const seg = { p0: s, c1: s.handleOut ?? s, c2: e.handleIn ?? e, p3: e };
    for (let j = 0; j <= 32; j++) out.push(cubicAt(seg, j / 32));
  }
  return out;
}

function distanceTo(p: { x: number; y: number }, poly: readonly PathAnchor[], closed: boolean) {
  let best = Infinity;
  const segs = closed ? poly.length : poly.length - 1;
  for (let i = 0; i < segs; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
}

describe('simplifyContour (path-tool.md "Combined paths", Simplify)', () => {
  it('turns a traced circle into a few smooth nodes within half a pixel', () => {
    const traced = tracedCircle(400);
    const out = simplifyContour(traced, true)!;
    expect(out.length).toBeLessThan(40);
    expect(out.every((a) => a.mode === 'aligned' && a.handleIn && a.handleOut)).toBe(true);
    for (const p of outline(out, true)) {
      expect(Math.abs(Math.hypot(p.x - 200, p.y - 200) - 100)).toBeLessThanOrEqual(
        SIMPLIFY_TOLERANCE_PX,
      );
    }
  });

  it('keeps sharp corners as corners (a half disc on a bar)', () => {
    // The top half of a circle, then straight down the diameter's ends and along the bottom.
    const arc = Array.from({ length: 60 }, (_, i) => {
      const a = Math.PI + (i / 59) * Math.PI;
      return corner(200 + 100 * Math.cos(a), 200 + 100 * Math.sin(a));
    });
    const traced = [...arc, corner(300, 260), corner(100, 260)];
    const out = simplifyContour(traced, true)!;
    expect(out.length).toBeLessThan(traced.length);
    const at = (x: number, y: number) =>
      out.find((a) => Math.abs(a.x - x) < 1e-6 && Math.abs(a.y - y) < 1e-6);
    expect(at(300, 260)?.mode).toBe('corner');
    expect(at(100, 260)?.mode).toBe('corner');
    // The arc meets the bar's sides smoothly; the outline stays within the tolerance throughout.
    for (const p of outline(out, true)) expect(distanceTo(p, traced, true)).toBeLessThan(0.51);
  });

  it('keeps an open contour’s ends', () => {
    const arc = Array.from({ length: 40 }, (_, i) => {
      const a = (i / 39) * Math.PI;
      return corner(200 + 100 * Math.cos(a), 200 + 100 * Math.sin(a));
    });
    const out = simplifyContour(arc, false)!;
    expect(out[0]).toMatchObject({ x: arc[0]!.x, y: arc[0]!.y, mode: 'corner' });
    expect(out.at(-1)).toMatchObject({ x: arc.at(-1)!.x, y: arc.at(-1)!.y, mode: 'corner' });
    expect(out.length).toBeLessThan(arc.length);
  });

  it('leaves a contour with curves or too few points alone', () => {
    expect(isSimplifiable(tracedCircle(SIMPLIFY_MIN_NODES - 1))).toBe(false);
    expect(simplifyContour(tracedCircle(SIMPLIFY_MIN_NODES - 1), true)).toBeNull();
    const smooth = tracedCircle(20).map((a, i) =>
      i === 3 ? { ...a, mode: 'mirrored' as const, handleIn: a, handleOut: a } : a,
    );
    expect(simplifyContour(smooth, true)).toBeNull();
  });

  it('is null when every point is needed (a zigzag of sharp turns)', () => {
    const zig = Array.from({ length: 16 }, (_, i) => corner(i * 20, i % 2 ? 0 : 40));
    expect(simplifyContour(zig, false)).toBeNull();
  });

  it('runs straight where a curve between neighbours would bulge', () => {
    // A long straight run met at a gentle turn: Catmull-Rom handles would bow the straight side.
    const traced = [
      corner(0, 0),
      corner(400, 0),
      ...Array.from({ length: 20 }, (_, i) => {
        const a = -Math.PI / 2 + (i / 19) * Math.PI;
        return corner(400 + 50 * Math.cos(a), 50 + 50 * Math.sin(a));
      }).slice(1),
      corner(0, 100),
    ];
    const out = simplifyContour(traced, true)!;
    expect(out.length).toBeLessThan(traced.length);
    for (const p of outline(out, true)) expect(distanceTo(p, traced, true)).toBeLessThan(0.51);
  });

  it('simplifies the largest contour a path may hold within a CPU budget', () => {
    const traced = tracedCircle(5000, 2000);
    let out: PathAnchor[] | null = null;
    const spent = cpuMsOf(() => {
      out = simplifyContour(traced, true);
    });
    expect(out).not.toBeNull();
    expect(spent).toBeLessThan(cpuBudgetMs(500));
  });
});
