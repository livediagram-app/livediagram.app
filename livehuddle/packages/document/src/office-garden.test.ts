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
  OFFICE_POD_VIEW,
  POD_DOOR,
  POD_DOORS,
  pathStones,
  podFurniture,
} from './office-garden';
import { SEAT_VIEWS } from '@livehuddle/avatar/seats';
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
    const short = pathStones(120, 60);
    const long = pathStones(480, 60);
    expect(long.length).toBeGreaterThan(short.length);
    expect(long[0]!.rx).toBe(short[0]!.rx);
    const down = pathStones(60, 480);
    expect(down).toHaveLength(long.length);
    expect(down[0]!.ry).toBeGreaterThan(down[0]!.rx);
    expect(gardenPathParts(0, 10)).toEqual([]);
    // Each stone is a flagstone cut by hand, lit, on gravel specks, inside the bed's edging.
    const parts = gardenPathParts(480, 60);
    expect(parts.filter((p) => p.tag === 'path' && p.role === 'panel')).toHaveLength(long.length);
    expect(parts.some((p) => p.role === 'rail')).toBe(true);
    expect(parts.filter((p) => p.role === 'mark').length).toBeGreaterThan(long.length);
  });

  it('keeps every stone whole and back from both ends, however long the path', () => {
    for (const thickness of [40, 64, 96]) {
      for (let length = Math.ceil(thickness * 1.3); length <= 2000; length += 7) {
        const stones = pathStones(length, thickness);
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
      const setts = parts.filter((p) => p.tag === 'path' && p.role === 'panel');
      expect(setts.length).toBeGreaterThanOrEqual(6);
      // Every corner of every sett lies between the inner ring and the kerb.
      for (const s of setts) {
        if (s.tag !== 'path') continue;
        const nums = s.d.match(/-?[\d.]+/g)!.map(Number);
        for (let i = 0; i < nums.length; i += 2) {
          const r = Math.hypot(nums[i]! - size / 2, nums[i + 1]! - size / 2);
          expect(r).toBeLessThan(size / 2);
          expect(r).toBeGreaterThan(size * 0.31);
        }
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

// docs/specs/009-elements/furniture-facing.md "The camera": the pod and the bar's pieces turned.
describe('the pod and the bar turned', () => {
  it('draws a back and a side of their own, each on its grid', () => {
    for (const kind of ['office-pod', 'bar', 'drinks-cabinet', 'drinks-fridge'] as const) {
      const art = OFFICE_ART[kind];
      expect(art.back.parts).not.toEqual(art.front.parts);
      expect(art.side.parts).not.toEqual(art.front.parts);
      for (const view of [art.back, art.side])
        for (const p of view.parts)
          if (p.tag === 'rect') {
            expect(p.x + p.w).toBeLessThanOrEqual(view.width + 1);
            expect(p.y + p.h).toBeLessThanOrEqual(view.height + 1);
          }
    }
    // Tall pieces turned are narrow and long.
    for (const kind of ['bar', 'drinks-cabinet', 'drinks-fridge'] as const)
      expect(OFFICE_ART[kind].side.height).toBeGreaterThan(OFFICE_ART[kind].side.width * 2);
  });

  it('keeps the bar stool’s one drawing at every facing: it is round', () => {
    const art = OFFICE_ART['bar-stool'];
    expect(art.back).toBe(art.front);
    expect(art.side).toBe(art.front);
  });

  it('seats the pod on its turned benches, from @livehuddle/avatar/seats', () => {
    const art = OFFICE_ART['office-pod'];
    expect(art.back.seats).toEqual(SEAT_VIEWS['office-pod'].back.seats);
    expect(art.side.seats).toEqual(SEAT_VIEWS['office-pod'].side.seats);
    expect([art.side.width, art.side.height]).toEqual([144, 176]);
  });

  it('puts the pod’s door in the doorway each drawing shows, sliding behind its wall', () => {
    const { front, back, side } = POD_DOORS;
    expect(front).toMatchObject(POD_DOOR);
    expect(front.open).toEqual({ x: front.w, y: 0 });
    // From behind it stands in the far wall's face and slides the other way.
    expect(back.y).toBeLessThan(10);
    expect(back.open).toEqual({ x: -back.w, y: 0 });
    // On its side it runs down the left wall and slides toward you.
    expect(side.x).toBe(0);
    expect(side.h).toBeGreaterThan(side.w);
    expect(side.open).toEqual({ x: 0, y: side.h });
    expect(side.y + side.h).toBeLessThan(OFFICE_ART['office-pod'].side.height);
  });

  it('is a call of its own inside its turned walls', () => {
    const pod = {
      ...createShape('office-pod', 0, 0),
      id: 'pod',
      width: 144,
      height: 176,
      chairFacing: 'e' as const,
    };
    const [zone] = roomZones([pod]);
    expect(zone).toMatchObject({ x0: 4, y0: 36, x1: 140, y1: 172 });
  });

  // docs/specs/008-canvas/3d-view.md "Which pieces": the 3D view stands a pod's furniture up inside its walls.
  it("picks a pod's furniture out of its drawing, and the line it stands on, in every facing", () => {
    for (const drawing of Object.values(OFFICE_ART['office-pod'])) {
      if (!drawing || !('parts' in drawing)) continue;
      const { parts } = drawing;
      const { indices, foot } = podFurniture(parts);
      // The benches, the table and its mug; never the floor or the walls.
      expect(indices.length).toBeGreaterThan(3);
      expect(indices.length).toBeLessThan(parts.length);
      for (const i of indices) expect(['floor', 'wall', 'shadow']).not.toContain(parts[i]!.role);
      expect(foot).toBeGreaterThan(0);
    }
  });
});
