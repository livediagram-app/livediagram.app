// docs/specs/008-canvas/3d-engine.md "Room names read in 3D": a room's name built as geometry on a nameplate on both
// faces of its wall, and on its Room Sign, never mirrored; nothing without a raster.
import { afterEach, describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { MeshBuilder } from './mesh-builder';
import { faceText, inkTraps, setTextRaster, TEXT_RASTER_H, type Raster } from './text-mesh';
import { wallLabel } from './scene-labels';
import { piecesMesh } from './scene-pieces';
import type { SpaceWall } from '@/lib/space-3d/space-3d-walls';

/** A fake raster: each letter a 6 px stem the line's middle half tall, 10 px apart (a space draws nothing). */
function stems(text: string): Raster {
  const width = text.length * 10 + 8;
  const alpha = new Uint8Array(width * TEXT_RASTER_H);
  [...text].forEach((ch, i) => {
    if (ch === ' ') return;
    for (let y = TEXT_RASTER_H / 4; y < (TEXT_RASTER_H * 3) / 4; y++)
      for (let x = 4 + i * 10; x < 10 + i * 10; x++) alpha[y * width + x] = 255;
  });
  return { width, height: TEXT_RASTER_H, alpha };
}

let restore: ((t: string) => Raster | null) | null = null;
afterEach(() => {
  if (restore) setTextRaster(restore);
  restore = null;
});

describe('lettering as geometry', () => {
  it("merges a letter's stem into one quad, not one per row", () => {
    const traps = inkTraps(stems('AB'));
    expect(traps).toHaveLength(2);
    const [y0, l0, r0, y1, l1, r1] = traps[0]!;
    expect(y1 - y0).toBe(TEXT_RASTER_H / 2);
    expect([l0, r0, l1, r1]).toEqual([4, 10, 4, 10]);
  });

  it('lays a slanted stroke as one smooth trapezoid, its edges between the pixels', () => {
    // A stroke 6 px wide leaning half a pixel per row, its edges anti-aliased as a browser draws them.
    const width = 80;
    const alpha = new Uint8Array(width * TEXT_RASTER_H);
    for (let y = 20; y < 80; y++) {
      const left = 10 + (y - 20) * 0.5;
      for (let x = 0; x < width; x++) {
        const cover =
          Math.max(0, Math.min(1, x + 1 - left)) - Math.max(0, Math.min(1, x + 1 - left - 6));
        alpha[y * width + x] = Math.round(cover * 255);
      }
    }
    const traps = inkTraps({ width, height: TEXT_RASTER_H, alpha });
    expect(traps).toHaveLength(1);
    const [y0, l0, , y1, l1] = traps[0]!;
    // Its left side runs at the stroke's own slant, not in whole-pixel steps.
    expect((l1 - l0) / (y1 - y0)).toBeCloseTo(0.5, 1);
  });

  it('reads left to right as seen from the side it faces', () => {
    restore = setTextRaster(stems);
    const m = new MeshBuilder();
    // A face toward +y (the default camera): its line runs +x.
    faceText(m, 'AB', {
      at: [0, 0, 0],
      right: [1, 0, 0],
      up: [0, 0, 1],
      normal: [0, 1, 0],
      height: 10,
      maxWidth: 1000,
      colour: 0x000000,
    });
    const xs = m.positions.filter((_, i) => i % 3 === 0);
    // The first letter's quads are drawn first, and sit left of the second's.
    expect(Math.max(...xs.slice(0, 6))).toBeLessThan(Math.min(...xs.slice(6, 12)));
    // Every normal faces the viewer.
    for (let i = 1; i < m.normals.length; i += 3) expect(m.normals[i]).toBeCloseTo(1);
  });

  it('draws nothing without a raster, so a test or a worker never breaks', () => {
    restore = setTextRaster(() => null);
    const m = new MeshBuilder();
    expect(
      faceText(m, 'Kitchen', {
        at: [0, 0, 0],
        right: [1, 0, 0],
        up: [0, 0, 1],
        normal: [0, 1, 0],
        height: 10,
        maxWidth: 100,
        colour: 0,
      }),
    ).toBe(0);
    expect(m.positions).toHaveLength(0);
  });
});

describe("a room's name in 3D", () => {
  const wall = (over: Partial<SpaceWall> = {}): SpaceWall => ({
    id: 'w',
    a: { x: 0, y: 0 },
    b: { x: 200, y: 0 },
    kind: 'wall',
    height: 152,
    shade: 0,
    label: 'Kitchen',
    ...over,
  });

  it('puts a nameplate on both faces of its wall, high up', () => {
    restore = setTextRaster(stems);
    const m = new MeshBuilder();
    wallLabel(m, wall(), 8);
    const ys = m.positions.filter((_, i) => i % 3 === 1);
    expect(Math.max(...ys)).toBeGreaterThan(4);
    expect(Math.min(...ys)).toBeLessThan(-4);
    expect(Math.min(...m.positions.filter((_, i) => i % 3 === 2))).toBeGreaterThan(80);
  });

  it('shows no plate on a wall cut down below it, or with no name', () => {
    restore = setTextRaster(stems);
    const low = new MeshBuilder();
    wallLabel(low, wall(), 8, 14);
    expect(low.positions).toHaveLength(0);
    const none = new MeshBuilder();
    wallLabel(none, wall({ label: '  ' }), 8);
    expect(none.positions).toHaveLength(0);
  });

  it("writes a Room Sign's room's name on it, rebuilt when the room is renamed", () => {
    restore = setTextRaster(stems);
    const room = { ...createShape('room', 0, 0), id: 'r', label: 'Hi' } as Element;
    const sign = { ...createShape('room-sign', 40, 40), id: 's' } as Element;
    const short = piecesMesh([room, sign]).positions.length;
    const renamed = { ...room, label: 'Hello there' } as Element;
    expect(piecesMesh([renamed, sign]).positions.length).toBeGreaterThan(short);
  });
});
