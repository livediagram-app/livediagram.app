import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { OFFICE_ART } from './office';
import {
  gardenFenceParts,
  gardenPathParts,
  grassEdgePath,
  isPlazaPath,
  PATH_STONE_INSET,
  GARDEN_PATH_FILL,
  GRASS_FILL,
  GRASS_TILES,
  OFFICE_POD_VIEW,
  POD_DOOR,
} from './office-garden';
import { roomZones, zoneAt } from './call-geometry';
import { defaultFillColor } from './colors';

// docs/specs/009-elements/office.md "Office Pod" to "Garden Fence".
describe('the pod, the bar and the garden', () => {
  it('draws the pod with its door across the doorway, and the door out of the drawing', () => {
    expect(OFFICE_ART['office-pod'].front).toBe(OFFICE_POD_VIEW);
    expect(POD_DOOR.x).toBeGreaterThan(0);
    expect(POD_DOOR.x + POD_DOOR.w).toBeLessThan(OFFICE_POD_VIEW.width);
    expect(OFFICE_POD_VIEW.seats).toHaveLength(2);
  });

  it('makes a garden path and a garden fence any length, with no words', () => {
    for (const kind of ['garden-path', 'garden-fence'] as const) {
      const el = createShape(kind, 0, 0);
      expect(el.label).toBe('');
      expect(el.aspectLocked).toBeFalsy();
    }
    expect(createShape('office-pod', 0, 0)).toMatchObject({
      aspectLocked: true,
      textAlignY: 'bottom',
    });
  });

  it('lays a path’s stones along its longer side, the same size however long', () => {
    const short = gardenPathParts(120, 60).filter((p) => p.tag === 'ellipse');
    const long = gardenPathParts(480, 60).filter((p) => p.tag === 'ellipse');
    expect(long.length).toBeGreaterThan(short.length);
    expect(long[0]).toMatchObject({ rx: short[0]!.tag === 'ellipse' ? short[0]!.rx : 0 });
    const down = gardenPathParts(60, 480).filter((p) => p.tag === 'ellipse');
    expect(down).toHaveLength(long.length);
    if (down[0]!.tag === 'ellipse') expect(down[0]!.ry).toBeGreaterThan(down[0]!.rx);
    expect(gardenPathParts(0, 10)).toEqual([]);
  });

  it('keeps every stone whole and back from both ends, however long the path', () => {
    for (const thickness of [40, 64, 96]) {
      for (let length = Math.ceil(thickness * 1.3); length <= 2000; length += 7) {
        const stones = gardenPathParts(length, thickness).flatMap((p) =>
          p.tag === 'ellipse' ? [p] : [],
        );
        expect(stones.length).toBeGreaterThanOrEqual(1);
        const inset = stones.length > 1 ? thickness * PATH_STONE_INSET : 0;
        for (const [i, s] of stones.entries()) {
          expect(s.cx - s.rx).toBeGreaterThanOrEqual(inset - 1e-6);
          expect(s.cx + s.rx).toBeLessThanOrEqual(length - inset + 1e-6);
          expect(s.cy - s.ry).toBeGreaterThan(0);
          expect(s.cy + s.ry).toBeLessThan(thickness);
          // Stones never touch.
          const next = stones[i + 1];
          if (next) expect(next.cx - next.rx).toBeGreaterThan(s.cx + s.rx);
        }
      }
    }
  });

  it('draws an about-square path as a round plaza with whole setts inside its kerb', () => {
    expect(isPlazaPath(240, 200)).toBe(true);
    expect(isPlazaPath(240, 64)).toBe(false);
    for (const size of [64, 160, 280, 520]) {
      const parts = gardenPathParts(size, size);
      expect(parts[0]).toMatchObject({ tag: 'ellipse', role: 'floor', rx: size / 2 });
      const setts = parts.filter((p) => p.tag === 'ellipse' && p.role === 'panel');
      expect(setts.length).toBeGreaterThanOrEqual(6);
      for (const s of setts) {
        if (s.tag !== 'ellipse') continue;
        const r = Math.hypot(s.cx - size / 2, s.cy - size / 2);
        expect(r + s.rx).toBeLessThan(size / 2);
        expect(r - s.rx).toBeGreaterThan(size * 0.31);
      }
    }
  });

  it('spaces a fence’s pickets end to end, across or down', () => {
    const across = gardenFenceParts(200, 28).filter((p) => p.tag === 'path');
    expect(across.length).toBeGreaterThanOrEqual(10);
    const down = gardenFenceParts(28, 200).filter((p) => p.tag === 'rect');
    // Two rails plus a picket top every step.
    expect(down.length).toBe(across.length + 2);
    expect(gardenFenceParts(10, 0)).toEqual([]);
  });

  it('makes grass any size, with no words, at 240 by 160', () => {
    const grass = createShape('grass', 0, 0);
    expect(grass).toMatchObject({ label: '', width: 240, height: 160 });
    expect(grass.aspectLocked).toBeFalsy();
    expect(defaultFillColor(grass, 'light')).toBe(GRASS_FILL);
    expect(defaultFillColor(grass, 'dark')).not.toBe(GRASS_FILL);
  });

  it('outlines grass inside its box with the same few curves however large', () => {
    const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    for (const [w, h] of [
      [240, 160],
      [40, 12],
      [6000, 4000],
    ] as const) {
      const d = grassEdgePath(w, h);
      expect(d.startsWith('M')).toBe(true);
      expect(d.endsWith('Z')).toBe(true);
      expect((d.match(/Q/g) ?? []).length).toBe(8);
      // Each side's control point sits outside by the inset, so the curve itself just meets the edge.
      const inset = Math.min(3, Math.min(w, h) * 0.04);
      for (const [i, v] of numbers(d).entries()) {
        expect(v).toBeGreaterThanOrEqual(-inset - 0.01);
        expect(v).toBeLessThanOrEqual((i % 2 === 0 ? w : h) + inset + 0.01);
      }
    }
    expect(grassEdgePath(0, 10)).toBe('');
    expect(grassEdgePath(10, -1)).toBe('');
  });

  it('keeps every grass blade inside its pattern tile, so none is cut at a seam', () => {
    expect(GRASS_TILES.length).toBe(2);
    for (const tile of GRASS_TILES) {
      for (const d of [tile.shade, tile.light]) {
        // Each blade is "M x y q c1x c1y ex ey": walk them to their tips.
        for (const blade of d.split('M').filter(Boolean)) {
          const [x, y, , , ex, ey] = blade.split(/[ q]/).filter(Boolean).map(Number);
          for (const v of [x!, y!, x! + ex!, y! + ey!]) {
            expect(v).toBeGreaterThan(0);
            expect(v).toBeLessThan(tile.size);
          }
        }
      }
    }
  });

  it('gives an unstyled path sand, deep on dark paper', () => {
    const path = createShape('garden-path', 0, 0);
    expect(defaultFillColor(path, 'light')).toBe(GARDEN_PATH_FILL);
    expect(defaultFillColor(path, 'dark')).not.toBe(GARDEN_PATH_FILL);
  });

  it('makes a pod a call of its own, the innermost inside a room', () => {
    const room = { id: 'r', type: 'shape', shape: 'room', x: 0, y: 0, width: 600, height: 400 };
    const pod = {
      id: 'p',
      type: 'shape',
      shape: 'office-pod',
      x: 100,
      y: 100,
      width: 176,
      height: 144,
    };
    const zones = roomZones([room, pod]);
    expect(zones.map((z) => z.id)).toEqual(['r', 'p']);
    expect(zoneAt({ x: 130, y: 204 }, zones)).toBe('p');
    expect(zoneAt({ x: 400, y: 300 }, zones)).toBe('r');
  });
});
