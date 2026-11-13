import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { MAP_GEOMETRY } from './map-geometry.generated';
import { MAP_INSETS, mapInsets, pathRings } from './map-insets';
import { mapLayout, mapWindow } from './map-layout';

const COLOURS = { land: '#dbe3ec', accent: '#3b82f6', paper: '#ffffff', text: '#0f172a' };
const US = MAP_GEOMETRY.countries.find((c) => c[0] === 'US')!;

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
    // Each on a paper plate drawn just before it, which is never a country.
    const plates = l.countries.filter((c) => c.part?.endsWith('-plate'));
    expect(plates.map((c) => [c.code, c.part, c.fill])).toEqual([
      ['', 'AK-plate', COLOURS.paper],
      ['', 'HI-plate', COLOURS.paper],
    ]);
    const order = l.countries.map((c) => c.part).filter(Boolean);
    expect(order).toEqual(['AK-plate', 'AK', 'HI-plate', 'HI']);
    const win = mapWindow(el, MAP_GEOMETRY);
    for (const inset of us.slice(1)) {
      const box = pathRings(inset.d).reduce(
        (b, r) => [
          Math.min(b[0]!, r.box[0]),
          Math.min(b[1]!, r.box[1]),
          Math.max(b[2]!, r.box[2]),
          Math.max(b[3]!, r.box[3]),
        ],
        [Infinity, Infinity, -Infinity, -Infinity],
      );
      expect(box[0]).toBeGreaterThanOrEqual(win.x);
      expect(box[1]).toBeGreaterThanOrEqual(win.y);
      expect(box[2]).toBeLessThanOrEqual(win.x + win.w);
      expect(box[3]).toBeLessThanOrEqual(win.y + win.h);
    }
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
    expect(mapInsets('US', 'M0 0l1 0 0 1z', win)).toEqual([]);
    expect(mapInsets('FR', US[2], win)).toEqual([]);
    // A long run of frames never grows the cache past its bound.
    for (let i = 0; i < 40; i++) mapInsets('US', US[2], { ...win, x: i });
    expect(cpuMsOf(() => mapInsets('US', US[2], { ...win, x: 99 }))).toBeLessThan(50);
  });
});
