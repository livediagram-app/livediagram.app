import { describe, expect, it } from 'vitest';
import {
  MARKER_COLOUR_MAX_ROWS,
  MARKER_COLOUR_NIB_PX,
  markerArrowHead,
  markerColouring,
  markerStrokes,
  trimOutline,
} from './marker';
import {
  outlineOfBox,
  outlineOfEllipse,
  outlineOfPath,
  outlineOfPolygon,
  sketchSeed,
} from './sketch';

// docs/specs/008-canvas/finish.md "Marker".

/** Every number pair a path's commands land on, in order. */
const points = (d: string) =>
  [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
const strokes = (d: string) => (d.match(/M/g) ?? []).length;

describe('markerStrokes', () => {
  const seed = sketchSeed('marker');

  it('is the same for the same element, and differs between elements', () => {
    const box = outlineOfBox('square', 200, 100, 8, 1.5);
    expect(markerStrokes(box, seed)).toEqual(markerStrokes(box, seed));
    expect(markerStrokes(box, seed)).not.toEqual(markerStrokes(box, sketchSeed('other')));
  });

  it('draws one stroke per edge, never doubled, dealt alternately into two layers', () => {
    const [a, b] = markerStrokes(outlineOfBox('square', 200, 100, 0, 1.5), seed);
    // Four edges: two in each layer, so every corner is a crossing between the layers.
    expect(strokes(a)).toBe(2);
    expect(strokes(b)).toBe(2);
  });

  it('draws a straight edge and the rounded corner after it in one gesture', () => {
    const [a, b] = markerStrokes(outlineOfBox('square', 200, 100, 12, 1.5), seed);
    // Four lines and four corners make four strokes, not eight.
    expect(strokes(a) + strokes(b)).toBe(4);
  });

  it('runs a straight edge past its corner', () => {
    const [a] = markerStrokes(
      outlineOfPolygon([
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 300 },
        { x: 0, y: 300 },
      ]),
      seed,
    );
    // The first stroke runs along the top edge, ending beyond x = 300.
    const top = points(a.split('M')[1]!);
    expect(top[top.length - 1]!.x).toBeGreaterThan(300);
  });

  it('draws a closed curve once round, with the overlap past its start in the other layer', () => {
    const [a, b] = markerStrokes(outlineOfEllipse(100, 60, 100, 60), seed);
    expect(strokes(a)).toBe(1);
    expect(strokes(b)).toBe(1);
  });

  it('keeps an open outline’s ends exactly where they are when pinned (an arrow meets its boxes)', () => {
    const outline = outlineOfPath('M 10 20 L 200 20 L 200 180');
    const [a, b] = markerStrokes(outline, seed, { pinEnds: true });
    const all = points(`${a} ${b}`);
    expect(all).toContainEqual({ x: 10, y: 20 });
    expect(all).toContainEqual({ x: 200, y: 180 });
  });

  it('keeps a pinned curve’s ends too', () => {
    const [a] = markerStrokes(outlineOfPath('M 0 0 C 50 -40, 150 40, 200 0'), seed, {
      pinEnds: true,
    });
    const pts = points(a);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 200, y: 0 });
  });
});

describe('trimOutline', () => {
  it('cuts a line back along itself at either end', () => {
    const cut = trimOutline(outlineOfPath('M 0 0 L 100 0'), 10, 20);
    expect(cut.segments).toEqual([{ kind: 'line', from: { x: 10, y: 0 }, to: { x: 80, y: 0 } }]);
  });

  it('cuts a curve back by its length', () => {
    const cut = trimOutline(outlineOfPath('M 0 0 Q 100 0 200 0'), 0, 50);
    const seg = cut.segments[0]!;
    expect(seg.kind).toBe('curve');
    if (seg.kind !== 'curve') return;
    const end = seg.points[seg.points.length - 1]!;
    expect(end.x).toBeCloseTo(150, 0);
  });

  it('leaves an end segment too short to cut as it was', () => {
    const outline = outlineOfPath('M 0 0 L 10 0');
    expect(trimOutline(outline, 0, 20).segments).toEqual(outline.segments);
  });
});

describe('markerArrowHead', () => {
  const tip = { x: 100, y: 50 };
  const dir = { x: 1, y: 0 };

  it('draws an open head as one chevron stroke through the tip', () => {
    const d = markerArrowHead(tip, dir, 15, 1, false);
    expect(strokes(d)).toBe(1);
    expect(d).not.toContain('Z');
  });

  it('draws a closed head as a triangle', () => {
    const d = markerArrowHead(tip, dir, 15, 1, true);
    expect(d).toMatch(/Z$/);
    // Every corner sits behind (or within a hair of) the tip.
    for (const p of points(d)) expect(p.x).toBeLessThanOrEqual(101);
  });
});

describe('markerColouring', () => {
  const rect = (w: number, h: number) => outlineOfBox('square', w, h, 0, 0).area!;

  it('colours an area in overlapping rows dealt into two layers', () => {
    const { streaks, nibPx } = markerColouring(rect(240, 120), 7);
    expect(nibPx).toBe(MARKER_COLOUR_NIB_PX);
    expect(strokes(streaks[0])).toBeGreaterThan(3);
    expect(strokes(streaks[1])).toBeGreaterThan(3);
  });

  it('keeps every row inside the area', () => {
    const { streaks } = markerColouring(rect(240, 120), 7);
    for (const p of points(`${streaks[0]} ${streaks[1]}`)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(240);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(120);
    }
  });

  it('caps the rows on a huge area by widening the nib', () => {
    const { streaks, nibPx } = markerColouring(rect(20000, 20000), 7);
    expect(strokes(streaks[0]) + strokes(streaks[1])).toBeLessThanOrEqual(
      MARKER_COLOUR_MAX_ROWS * 2,
    );
    expect(nibPx).toBeGreaterThan(MARKER_COLOUR_NIB_PX);
  });

  it('leaves an area thinner than the nib uncoloured rather than spilling out of it', () => {
    expect(markerColouring(rect(200, 6), 7).streaks).toEqual(['', '']);
  });

  it('colours nothing in a degenerate area', () => {
    const p = { x: 5, y: 5 };
    expect(markerColouring([p, p, p], 7)).toEqual({ streaks: ['', ''], nibPx: 0 });
    expect(markerColouring([p], 7).streaks).toEqual(['', '']);
  });

  it('colours each lobe of a concave area without bridging the gap between them', () => {
    // A U: two uprights joined at the bottom; no row may cross the notch between x 80 and x 160 above y 100.
    const u = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 100 },
      { x: 160, y: 100 },
      { x: 160, y: 0 },
      { x: 240, y: 0 },
      { x: 240, y: 160 },
      { x: 0, y: 160 },
    ];
    const { streaks } = markerColouring(u, 3);
    for (const p of points(`${streaks[0]} ${streaks[1]}`))
      expect(p.y > 100 || p.x <= 80 || p.x >= 160).toBe(true);
  });
});
