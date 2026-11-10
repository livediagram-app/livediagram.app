import { describe, expect, it } from 'vitest';
import { MAP_GEOMETRY } from './map-geometry.generated';
import {
  cleanPinLabel,
  isMapCode,
  isMapPin,
  isMapRegion,
  isMapShape,
  MAP_PLANE_HEIGHT,
  MAP_REGIONS,
  MAP_WORLD_WIDTH,
  mapLandColour,
  mapPaperColour,
  projectLonLat,
  provideMapGeometry,
  providedMapGeometry,
  regionWindow,
  unprojectPoint,
} from './map-model';

describe('map projection (docs/specs/009-elements/map.md "Geometry")', () => {
  it('agrees with the plane the build script projected the countries into', () => {
    expect(MAP_GEOMETRY.width).toBe(MAP_WORLD_WIDTH);
    expect(MAP_GEOMETRY.height).toBe(MAP_PLANE_HEIGHT);
    // London sits inside the United Kingdom's frame, Sydney inside Australia's.
    const inside = (code: string, lon: number, lat: number) => {
      const row = MAP_GEOMETRY.countries.find((c) => c[0] === code)!;
      const [x, y] = projectLonLat(lon, lat);
      return x >= row[3] && x <= row[5] && y >= row[4] && y <= row[6];
    };
    expect(inside('GB', -0.12, 51.5)).toBe(true);
    expect(inside('AU', 151.2, -33.87)).toBe(true);
    expect(inside('BR', -47.9, -15.8)).toBe(true);
  });

  it('puts the centre of the world in the middle of the plane, north up', () => {
    const [x, y] = projectLonLat(0, 0);
    expect(x).toBeCloseTo(MAP_WORLD_WIDTH / 2, 6);
    expect(y).toBeCloseTo(MAP_PLANE_HEIGHT / 2, 0);
    expect(projectLonLat(0, 60)[1]).toBeLessThan(y);
  });

  it('round-trips a point through the inverse', () => {
    for (const [lon, lat] of [
      [-0.12, 51.5],
      [139.7, 35.7],
      [-74, 40.7],
      [18.4, -33.9],
      [179, 84],
    ]) {
      const [x, y] = projectLonLat(lon!, lat!);
      const back = unprojectPoint(x, y);
      expect(back.lon).toBeCloseTo(lon!, 6);
      expect(back.lat).toBeCloseTo(lat!, 6);
    }
  });

  it('keeps the inverse inside the stored ranges off the edge of the world', () => {
    const p = unprojectPoint(-500, -500);
    expect(p.lat).toBe(85);
    expect(p.lon).toBe(-180);
  });

  it('projects every region to a window inside the plane', () => {
    for (const r of MAP_REGIONS) {
      const w = regionWindow(r);
      expect(w.w, r).toBeGreaterThan(0);
      expect(w.h, r).toBeGreaterThan(0);
      expect(w.x, r).toBeGreaterThanOrEqual(-1);
      expect(w.x + w.w, r).toBeLessThanOrEqual(MAP_WORLD_WIDTH + 1);
    }
    expect(regionWindow('europe').w).toBeLessThan(regionWindow('world').w / 3);
  });
});

describe('map geometry', () => {
  it('holds every country once, with no Antarctica, and a place catalogue', () => {
    const codes = MAP_GEOMETRY.countries.map((c) => c[0]);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).not.toContain('AQ');
    expect(codes).toEqual(expect.arrayContaining(['GB', 'FR', 'US', 'XK', 'CYN', 'SOL']));
    for (const c of codes) expect(isMapCode(c), c).toBe(true);
    expect(MAP_GEOMETRY.places.length).toBeGreaterThan(200);
    expect(MAP_GEOMETRY.places.find((p) => p[0] === 'London')?.[1]).toBe('GB');
  });

  it('frames France on Europe, not French Guiana', () => {
    const fr = MAP_GEOMETRY.countries.find((c) => c[0] === 'FR')!;
    const [gx] = projectLonLat(-53, 4);
    expect(fr[3]).toBeGreaterThan(gx);
  });
});

describe('map validators', () => {
  it('knows the kind, the regions and the codes', () => {
    expect(isMapShape('map')).toBe(true);
    expect(isMapShape('square')).toBe(false);
    expect(isMapRegion('europe')).toBe(true);
    expect(isMapRegion('mars')).toBe(false);
    expect(isMapCode('GB')).toBe(true);
    expect(isMapCode('CYN')).toBe(true);
    expect(isMapCode('gb')).toBe(false);
    expect(isMapCode('GBRX')).toBe(false);
  });

  it('accepts a pin in range and refuses the rest', () => {
    expect(isMapPin({ id: 'a', lat: 51.5, lon: -0.1, label: 'London' })).toBe(true);
    expect(isMapPin({ id: 'a', lat: 51.5, lon: -0.1 })).toBe(true);
    expect(isMapPin({ id: '', lat: 0, lon: 0 })).toBe(false);
    expect(isMapPin({ id: 'a', lat: 90, lon: 0 })).toBe(false);
    expect(isMapPin({ id: 'a', lat: 0, lon: 181 })).toBe(false);
    expect(isMapPin({ id: 'a', lat: Number.NaN, lon: 0 })).toBe(false);
    expect(isMapPin({ id: 'a', lat: 0, lon: 0, label: 'x'.repeat(41) })).toBe(false);
    expect(isMapPin(null)).toBe(false);
  });

  it('cleans a pin label', () => {
    expect(cleanPinLabel('  Paris ')).toBe('Paris');
    expect(cleanPinLabel('   ')).toBeUndefined();
    expect(cleanPinLabel(undefined)).toBeUndefined();
    expect(cleanPinLabel('x'.repeat(50))).toHaveLength(40);
  });
});

describe('map colours and the provided geometry', () => {
  it('defaults the land and paper per surface', () => {
    expect(mapLandColour(undefined)).toBe('#dbe3ec');
    expect(mapLandColour(undefined, 'dark')).toBe('#334155');
    expect(mapLandColour('#abcdef', 'dark')).toBe('#abcdef');
    expect(mapPaperColour()).toBe('#ffffff');
    expect(mapPaperColour('dark')).toBe('#0f172a');
  });

  it('hands back what was provided', () => {
    provideMapGeometry(MAP_GEOMETRY);
    expect(providedMapGeometry()).toBe(MAP_GEOMETRY);
  });
});
