import { describe, expect, it } from 'vitest';
import {
  packFreehandPoints,
  pathContours,
  pathWorldAnchors,
  type FreehandElement,
  type PathElement,
} from '@livediagram/document';
import { tidyUpStroke, isTidyable } from './stroke-tidy';

// docs/specs/007-editor/logo-pages.md "Tidy Up": hand-drawn lines made straight.
const wobble = (i: number) => Math.sin(i * 1.7) * 1.5;

const stroke = (pts: { x: number; y: number }[], over: Partial<FreehandElement> = {}) =>
  ({
    id: 's',
    type: 'freehand',
    closed: false,
    strokeColor: '#123456',
    ...packFreehandPoints(pts),
    ...over,
  }) as FreehandElement;

type Pt = { x: number; y: number };

const corners = (p: PathElement) => pathWorldAnchors(p, pathContours(p)[0]!);

describe('tidyUpStroke', () => {
  it('turns a wobbly near-level line into one level segment, keeping id and colour', () => {
    const pts = Array.from({ length: 40 }, (_, i) => ({
      x: 100 + i * 5,
      y: 200 + wobble(i) + i * 0.1,
    }));
    const p = tidyUpStroke(stroke(pts))!;
    expect(p).toMatchObject({ id: 's', type: 'path', closed: false, strokeColor: '#123456' });
    const c = corners(p);
    expect(c).toHaveLength(2);
    expect(c[1]!.y).toBeCloseTo(c[0]!.y, 5);
  });

  it('keeps a real corner and squares both legs', () => {
    const across = Array.from({ length: 20 }, (_, i) => ({ x: 100 + i * 10, y: 100 + wobble(i) }));
    const down = Array.from({ length: 20 }, (_, i) => ({ x: 290 + wobble(i), y: 110 + i * 10 }));
    const c = corners(tidyUpStroke(stroke([...across, ...down]))!);
    expect(c).toHaveLength(3);
    expect(c[1]!.y).toBeCloseTo(c[0]!.y, 5);
    expect(c[2]!.x).toBeCloseTo(c[1]!.x, 5);
  });

  it('closes a drawn loop whose ends meet', () => {
    const side = (x0: number, y0: number, dx: number, dy: number) =>
      Array.from({ length: 10 }, (_, i) => ({
        x: x0 + dx * i + wobble(i),
        y: y0 + dy * i + wobble(i + 3),
      }));
    const square = [
      ...side(0, 0, 20, 0),
      ...side(200, 0, 0, 20),
      ...side(200, 200, -20, 0),
      ...side(0, 200, 0, -20),
      { x: 1, y: 2 },
    ];
    const p = tidyUpStroke(stroke(square))!;
    expect(p.closed).toBe(true);
    expect(p.nodes).toHaveLength(4);
  });

  it('gives a marker the thinnest stroke width at least as wide', () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: i * 7 }));
    const p = tidyUpStroke(stroke(pts, { penWidth: 2 }))!;
    expect(p.strokeWidth).toBe('medium');
  });

  it('leaves alone what is not a drawn line', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ];
    expect(isTidyable(stroke(pts, { pen: 'highlighter' } as Partial<FreehandElement>))).toBe(false);
    expect(
      isTidyable({ id: 'r', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 }),
    ).toBe(false);
    expect(isTidyable(stroke(pts))).toBe(true);
  });

  it('squares every near-upright and near-level run, the slanted one too (the logo cross)', () => {
    // One stroke: down from the top to the centre and on to the bottom (drifting 9 px), an arc
    // round to the right, back along the centre to the left, and an arc up to the start.
    const seg = (a: Pt, b: Pt, n: number, wob = 1.2) =>
      Array.from({ length: n }, (_, i) => ({
        x: a.x + ((b.x - a.x) * i) / n + wobble(i) * wob,
        y: a.y + ((b.y - a.y) * i) / n + wobble(i + 2) * wob,
      }));
    const arc = (cx: number, cy: number, r: number, from: number, to: number, n: number) =>
      Array.from({ length: n }, (_, i) => {
        const t = from + ((to - from) * i) / n;
        return { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r };
      });
    const c = { x: 275, y: 257 };
    const pts = [
      ...seg({ x: 275, y: 40 }, c, 30),
      ...seg(c, { x: 284, y: 491 }, 30),
      ...arc(275, 257, 234, Math.PI / 2, 0, 30),
      ...seg({ x: 509, y: 257 }, c, 30),
      ...seg(c, { x: 65, y: 262 }, 30),
      ...arc(275, 257, 212, Math.PI, (3 * Math.PI) / 2, 30),
      { x: 275, y: 42 },
    ];
    const p = tidyUpStroke(stroke(pts))!;
    const cs = corners(p);
    const n = cs.length;
    const seg2 = Array.from({ length: p.closed ? n : n - 1 }, (_, i) => [cs[i]!, cs[(i + 1) % n]!]);
    const upright = seg2.filter(([a, b]) => Math.abs(a!.x - b!.x) < 1e-6);
    const level = seg2.filter(([a, b]) => Math.abs(a!.y - b!.y) < 1e-6);
    // Top to centre to bottom is one upright run; right to centre to left is one level run.
    expect(upright.length).toBeGreaterThanOrEqual(1);
    expect(level.length).toBeGreaterThanOrEqual(1);
    const span = (ss: typeof seg2, axis: 'x' | 'y') =>
      Math.max(...ss.map(([a, b]) => Math.abs(a![axis] - b![axis])));
    expect(span(upright, 'y')).toBeGreaterThan(400);
    expect(span(level, 'x')).toBeGreaterThan(400);
  });

  it('puts corners on the guides first, and squaring keeps them there', () => {
    const pts = Array.from({ length: 30 }, (_, i) => ({ x: 103 + i * 10, y: 205 + wobble(i) }));
    const guides = {
      point: (q: Pt) => (Math.hypot(q.x - 100, q.y - 200) < 10 ? { x: 100, y: 200 } : null),
      x: () => null,
      y: () => null,
    };
    const cs = corners(tidyUpStroke(stroke(pts), guides)!);
    expect(cs[0]).toMatchObject({ x: 100, y: 200 });
    expect(cs[1]!.y).toBe(200);
  });

  it('moves a straight run onto a guide line along it (a grid line)', () => {
    // A wobbly level line at about y = 203, near a grid line at y = 200; nothing near its ends.
    const pts = Array.from({ length: 30 }, (_, i) => ({ x: 10 + i * 10, y: 203 + wobble(i) }));
    const guides = {
      point: () => null,
      y: (y: number) => (Math.abs(y - 200) <= 16 ? 200 : null),
      x: () => null,
    };
    const cs = corners(tidyUpStroke(stroke(pts), guides)!);
    expect(cs.every((c) => c.y === 200)).toBe(true);
  });

  it('keeps a marker drawing a line: unfilled when it closes, in Ink when it had no colour', () => {
    const side = (x0: number, y0: number, dx: number, dy: number) =>
      Array.from({ length: 10 }, (_, i) => ({ x: x0 + dx * i, y: y0 + dy * i }));
    const loop = [
      ...side(0, 0, 20, 0),
      ...side(200, 0, 0, 20),
      ...side(200, 200, -20, 0),
      ...side(0, 200, 0, -20),
      { x: 1, y: 1 },
    ];
    const p = tidyUpStroke(stroke(loop, { penWidth: 4, strokeColor: undefined }))!;
    expect(p).toMatchObject({ closed: true, fillColor: 'transparent', penColour: 'ink' });
  });

  it('tidies a loop drawn back to its start into the closed shape, not a dot (the diamond)', () => {
    // From the top, round the left to the bottom, round the right and back to the top.
    const pts = Array.from({ length: 81 }, (_, i) => {
      const t = i / 80;
      const left = t < 0.5;
      const u = left ? t * 2 : (t - 0.5) * 2;
      return {
        x: 500 + (left ? -1 : 1) * 235 * Math.sin(Math.PI * u) + wobble(i),
        y: left ? 200 + 540 * u : 740 - 540 * u,
      };
    });
    const p = tidyUpStroke(stroke(pts, { penWidth: 4 }))!;
    expect(p.closed).toBe(true);
    expect(p.width).toBeGreaterThan(400);
    expect(p.height).toBeGreaterThan(500);
    expect(p.nodes.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps what the element carries, and a closed pencil shape's fill", () => {
    const side = (x0: number, y0: number, dx: number, dy: number) =>
      Array.from({ length: 10 }, (_, i) => ({ x: x0 + dx * i, y: y0 + dy * i }));
    const loop = [
      ...side(0, 0, 20, 0),
      ...side(200, 0, 0, 20),
      ...side(200, 200, -20, 0),
      ...side(0, 200, 0, -20),
      { x: 1, y: 1 },
    ];
    const p = tidyUpStroke(
      stroke(loop, { closed: true, fillColor: '#f1f5f9', note: 'keep me', aspectLocked: true }),
    )!;
    expect(p).toMatchObject({ fillColor: '#f1f5f9', note: 'keep me', aspectLocked: true });
  });

  it('leaves two corners on different guides where the guides put them', () => {
    // A near-level run whose ends sit on two horizontal guides 20 px apart.
    const pts = Array.from({ length: 30 }, (_, i) => ({ x: i * 10, y: (i * 20) / 29 }));
    const guides = {
      point: (q: Pt) => (q.x < 5 ? { x: 0, y: 0 } : q.x > 285 ? { x: 290, y: 20 } : null),
      x: () => null,
      y: () => null,
    };
    const cs = corners(tidyUpStroke(stroke(pts), guides)!);
    expect(cs[0]).toMatchObject({ x: 0, y: 0 });
    expect(cs[cs.length - 1]).toMatchObject({ x: 290, y: 20 });
  });
});
