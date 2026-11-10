import { describe, expect, it } from 'vitest';
import { MAP_GEOMETRY } from './map-geometry.generated';
import { MAP_FAINT_OPACITY, mapLayout, mapWindow, pinLabelAnchor } from './map-layout';
import { regionWindow } from './map-model';

const COLOURS = { land: '#dbe3ec', accent: '#3b82f6', paper: '#ffffff', text: '#0f172a' };

describe('mapLayout (docs/specs/009-elements/map.md "What it shows")', () => {
  it('draws nothing in a box too small to hold a map', () => {
    expect(mapLayout({}, 4, 100, MAP_GEOMETRY, COLOURS)).toBeNull();
  });

  it('fits the world in the box, centred, keeping its proportions', () => {
    const l = mapLayout({}, 480, 260, MAP_GEOMETRY, COLOURS)!;
    const win = regionWindow('world');
    const w = win.w * l.scale;
    const h = win.h * l.scale;
    expect(Math.min(480 - w, 260 - h)).toBeCloseTo(0, 6);
    expect(win.x * l.scale + l.tx).toBeCloseTo((480 - w) / 2, 6);
    expect(win.y * l.scale + l.ty).toBeCloseTo((260 - h) / 2, 6);
    expect(l.countries).toHaveLength(MAP_GEOMETRY.countries.length);
  });

  it('fills highlighted countries in the accent and the rest in the land', () => {
    const l = mapLayout({ mapHighlights: ['FR', 'DE'] }, 480, 260, MAP_GEOMETRY, COLOURS)!;
    const fill = (code: string) => l.countries.find((c) => c.code === code)!.fill;
    expect(fill('FR')).toBe('#3b82f6');
    expect(fill('DE')).toBe('#3b82f6');
    expect(fill('ES')).toBe('#dbe3ec');
    expect(l.countries.every((c) => c.opacity === 1)).toBe(true);
  });

  it('frames a focused country and fades the others unless highlighted', () => {
    const el = { mapCountry: 'GB', mapHighlights: ['IE'], mapRegion: 'asia' as const };
    const win = mapWindow(el, MAP_GEOMETRY);
    expect(win.w).toBeLessThan(regionWindow('europe').w / 4);
    const l = mapLayout(el, 300, 300, MAP_GEOMETRY, COLOURS)!;
    const op = (code: string) => l.countries.find((c) => c.code === code)!.opacity;
    expect(op('GB')).toBe(1);
    expect(op('IE')).toBe(1);
    expect(op('FR')).toBe(MAP_FAINT_OPACITY);
  });

  it('falls back to the region for a country it does not know, or with no geometry yet', () => {
    expect(mapWindow({ mapCountry: 'ZZ', mapRegion: 'africa' }, MAP_GEOMETRY)).toEqual(
      regionWindow('africa'),
    );
    expect(mapWindow({ mapCountry: 'GB' }, null)).toEqual(regionWindow('world'));
    expect(mapWindow({ mapRegion: 'bogus' as never }, null)).toEqual(regionWindow('world'));
    const l = mapLayout({ mapPins: [{ id: 'p', lat: 0, lon: 0 }] }, 480, 260, null, COLOURS)!;
    expect(l.countries).toEqual([]);
    expect(l.pins).toHaveLength(1);
  });

  it('places pins and puts a label left when it would run off the right', () => {
    const l = mapLayout(
      {
        mapPins: [
          { id: 'a', lat: 51.5, lon: -0.12, label: 'London' },
          { id: 'b', lat: -33.87, lon: 151.2, label: 'Sydney Office' },
          { id: 'c', lat: 0, lon: 0 },
        ],
      },
      480,
      260,
      MAP_GEOMETRY,
      COLOURS,
    )!;
    const [london, sydney, bare] = l.pins;
    expect(london!.x).toBeGreaterThan(200);
    expect(london!.x).toBeLessThan(260);
    expect(london!.y).toBeLessThan(130);
    expect(london!.side).toBe('right');
    expect(sydney!.side).toBe('left');
    expect(bare!.label).toBeUndefined();
    expect(pinLabelAnchor(london!, l).anchor).toBe('start');
    expect(pinLabelAnchor(sydney!, l)).toEqual({
      x: sydney!.x - (l.pinRadius + l.labelSize * 0.35),
      anchor: 'end',
    });
  });

  it('keeps pin and label sizes within their bounds', () => {
    const small = mapLayout({}, 60, 40, MAP_GEOMETRY, COLOURS)!;
    const big = mapLayout({}, 4000, 3000, MAP_GEOMETRY, COLOURS)!;
    expect(small.pinRadius).toBe(3.5);
    expect(small.labelSize).toBe(10);
    expect(big.pinRadius).toBe(9);
    expect(big.labelSize).toBe(22);
    expect(big.borderWidth).toBeLessThanOrEqual(1.2);
  });
});
