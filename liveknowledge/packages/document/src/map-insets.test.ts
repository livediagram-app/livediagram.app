import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { MAP_GEOMETRY } from './map-geometry.generated';
import { MAP_INSETS, mapInsets, pathRings } from './map-insets';
import { mapLayout } from './map-layout';

const COLOURS = { land: '#dbe3ec', accent: '#3b82f6', paper: '#ffffff', text: '#0f172a' };
const US = MAP_GEOMETRY.countries.find((c) => c[0] === 'US')!;

// An inset's box in plane units: x0, y0, x1, y1.
const boxOf = (d: string) =>
  pathRings(d).reduce<[number, number, number, number]>(
    (b, r) => [
      Math.min(b[0], r.box[0]),
      Math.min(b[1], r.box[1]),
      Math.max(b[2], r.box[2]),
      Math.max(b[3], r.box[3]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );

// The plate's corners, from its outline (`M x y` then `V` and `H` steps, closed).
function platePoints(d: string): [number, number][] {
  const pts: [number, number][] = [];
  let at: [number, number] = [0, 0];
  for (const step of d.match(/[MVHZ][^MVHZ]*/g)!) {
    const n = step.slice(1).trim().split(' ').map(Number);
    if (step[0] === 'M') at = [n[0]!, n[1]!];
    else if (step[0] === 'V') at = [at[0], n[0]!];
    else if (step[0] === 'H') at = [n[0]!, at[1]];
    else continue;
    pts.push(at);
  }
  return pts;
}

// Whether the plate holds a point: an even-odd crossing count over its corners.
function plateCovers(d: string, x: number, y: number): boolean {
  const pts = platePoints(d);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// docs/specs/009-elements/map.md "What it shows": the United States frames on its lower 48, Alaska and Hawaii in
// insets.
describe('pathRings', () => {
  it('reads absolute and relative rings with their boxes', () => {
    const rings = pathRings('M10 20l5 0 0-5-5 0zm20 0l2 2-4 0z');
    expect(rings).toHaveLength(2);
    expect(rings[0]!.points).toEqual([
      [10, 20],
      [15, 20],
      [15, 15],
      [10, 15],
    ]);
    expect(rings[0]!.box).toEqual([10, 15, 15, 20]);
    expect(rings[1]!.points[0]).toEqual([30, 20]);
    expect(rings[1]!.box).toEqual([28, 20, 32, 22]);
  });

  it('reads an empty path as no rings', () => {
    expect(pathRings('')).toEqual([]);
  });
});

describe('the United States view', () => {
  it('frames on the lower 48, its biggest piece', () => {
    const rings = pathRings(US[2]).sort(
      (a, b) =>
        (b.box[2] - b.box[0]) * (b.box[3] - b.box[1]) -
        (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]),
    );
    expect(US.slice(3)).toEqual(rings[0]!.box);
  });

  it('fills a slide-shaped box with the lower 48', () => {
    const el = { mapCountry: 'US' };
    const l = mapLayout(el, 1600, 900, MAP_GEOMETRY, COLOURS)!;
    const [, , , x0, y0, x1, y1] = US;
    const w = (x1 - x0) * l.scale;
    const h = (y1 - y0) * l.scale;
    // The lower 48 spans most of the box both ways (with Alaska in the frame it was 58% wide).
    expect(w / 1600).toBeGreaterThan(0.75);
    expect(h / 900).toBeGreaterThan(0.6);
    // It sits inside the box.
    expect(x0 * l.scale + l.tx).toBeGreaterThanOrEqual(0);
    expect(x1 * l.scale + l.tx).toBeLessThanOrEqual(1600);
    expect(y0 * l.scale + l.ty).toBeGreaterThanOrEqual(0);
    expect(y1 * l.scale + l.ty).toBeLessThanOrEqual(900);
  });

  it('draws Alaska and Hawaii in insets inside the frame, highlighted with the rest', () => {
    const el = { mapCountry: 'US', mapHighlights: ['US'] };
    const l = mapLayout(el, 1600, 900, MAP_GEOMETRY, COLOURS)!;
    const us = l.countries.filter((c) => c.code === 'US');
    expect(us.map((c) => c.part)).toEqual([undefined, 'AK', 'HI']);
    expect(us.every((c) => c.fill === COLOURS.accent && c.opacity === 1)).toBe(true);
    // Both on one paper plate drawn just before them, which is never a country.
    const plates = l.countries.filter((c) => c.part === 'plate');
    expect(plates.map((c) => [c.code, c.fill])).toEqual([['', COLOURS.paper]]);
    const order = l.countries.map((c) => c.part).filter(Boolean);
    expect(order).toEqual(['plate', 'AK', 'HI']);
    // Inside the box as drawn, in px.
    for (const inset of us.slice(1)) {
      const b = boxOf(inset.d);
      expect(b[0] * l.scale + l.tx).toBeGreaterThanOrEqual(0);
      expect(b[1] * l.scale + l.ty).toBeGreaterThanOrEqual(0);
      expect(b[2] * l.scale + l.tx).toBeLessThanOrEqual(1600);
      expect(b[3] * l.scale + l.ty).toBeLessThanOrEqual(900);
    }
  });

  // docs/specs/009-elements/map.md "What it shows": no faint land under, beside or between the insets.
  it.each([
    ['a slide', 1600, 900],
    ['a tall box', 600, 900],
    ['a wide box', 1600, 400],
  ])('keeps the land behind out of the corner in %s', (_name, width, height) => {
    const l = mapLayout({ mapCountry: 'US' }, width, height, MAP_GEOMETRY, COLOURS)!;
    const plate = l.countries.find((c) => c.part === 'plate')!;
    const px = (x: number) => x * l.scale + l.tx;
    const py = (y: number) => y * l.scale + l.ty;
    const corners = platePoints(plate.d);
    // It runs past the box's left and bottom edges.
    expect(px(Math.min(...corners.map((c) => c[0])))).toBeLessThan(0);
    expect(py(Math.max(...corners.map((c) => c[1])))).toBeGreaterThan(height);
    // It covers each inset and the gap between them: every inset's box lies under the plate's outline.
    const insets = l.countries
      .filter((c) => c.part === 'AK' || c.part === 'HI')
      .map((c) => boxOf(c.d));
    expect(insets).toHaveLength(2);
    const covered = (x: number, y: number) => plateCovers(plate.d, x, y);
    for (const b of insets) {
      expect(covered(b[0], b[1])).toBe(true);
      expect(covered(b[2], b[3])).toBe(true);
    }
    // The gap between Alaska and Hawaii, at Hawaii's height.
    const ak = insets[0]!;
    const hi = insets[1]!;
    expect(covered((ak[2] + hi[0]) / 2, hi[1])).toBe(true);
    // And the strip under them down to the box's foot.
    expect(covered((ak[0] + ak[2]) / 2, (height - l.ty) / l.scale)).toBe(true);
    // But not the lower 48 above them.
    expect(covered(1000, 400)).toBe(false);
  });

  it('takes every ring of Alaska and Hawaii into an inset', () => {
    const rings = pathRings(US[2]);
    const [, , , x0, y0, x1, y1] = US;
    const far = rings.filter(
      (r) => r.box[2] < x0 || r.box[0] > x1 || r.box[3] < y0 || r.box[1] > y1,
    );
    const inInset = (r: (typeof rings)[number]) =>
      MAP_INSETS.US!.some(
        ({ box }) =>
          r.box[0] >= box[0] && r.box[1] >= box[1] && r.box[2] <= box[2] && r.box[3] <= box[3],
      );
    expect(far.length).toBeGreaterThan(0);
    expect(far.every(inInset)).toBe(true);
  });

  it('keeps its insets light: unlit, they draw in the land, and other countries draw none', () => {
    const l = mapLayout({ mapCountry: 'US' }, 800, 450, MAP_GEOMETRY, COLOURS)!;
    expect(l.countries.filter((c) => c.code === 'US').every((c) => c.fill === COLOURS.land)).toBe(
      true,
    );
    const fr = mapLayout({ mapCountry: 'FR' }, 800, 450, MAP_GEOMETRY, COLOURS)!;
    expect(fr.countries.some((c) => c.part)).toBe(false);
    expect(
      mapLayout({ mapRegion: 'north-america' }, 800, 450, MAP_GEOMETRY, COLOURS)!.countries.some(
        (c) => c.part,
      ),
    ).toBe(false);
  });

  it('reuses its insets across renders, and skips an inset with no land', () => {
    const win = { x: 0, y: 0, w: 100, h: 100 };
    expect(mapInsets('US', US[2], win)).toBe(mapInsets('US', US[2], win));
    expect(mapInsets('US', 'M0 0l1 0 0 1z', win)).toEqual({ plate: '', insets: [] });
    expect(mapInsets('FR', US[2], win)).toEqual({ plate: '', insets: [] });
    // A frame other than the window keys an entry of its own.
    expect(mapInsets('US', US[2], win, { ...win, h: 200 })).not.toBe(mapInsets('US', US[2], win));
    // A long run of frames never grows the cache past its bound.
    for (let i = 0; i < 40; i++) mapInsets('US', US[2], { ...win, x: i });
    expect(cpuMsOf(() => mapInsets('US', US[2], { ...win, x: 99 }))).toBeLessThan(50);
  });
});
