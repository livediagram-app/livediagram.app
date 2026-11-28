// docs/specs/009-elements/poster.md, 3d-engine.md "A Poster hangs its picture": the Poster's frame hangs flat on its
// wall at eye height, as wide and as tall as its box, and marks the place its picture is laid; the picture is no part
// of the pieces' geometry, so the model builds the same with and without one.
import { describe, expect, it } from 'vitest';
import {
  createShape,
  mountedFace,
  snapToWallFace,
  withPosterPicture,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import { RISE } from './models/kit';
import { POSTER_EYE_Z, POSTER_TOP_Z, posterSpan } from './models/poster';
import { piecesMesh } from './scene-pieces';
import { WALL_THICKNESS } from './scene-walls';

const room = { ...createShape('room', 0, 0), id: 'r', width: 400, height: 300 } as Element;
const poster = (over: Partial<ShapeElement> = {}) => {
  const p = { ...createShape('poster', 150, 60), id: 'p', ...over } as ShapeElement;
  return snapToWallFace(p, [room, p]);
};

describe('the Poster in real 3D', () => {
  it('hangs flat on its back wall, its picture place on its face at eye height', () => {
    const p = poster();
    const face = mountedFace(p, [room, p])!;
    const m = piecesMesh([room, p]);
    const c = m.posterPictures.get('p')!;
    expect(c).toHaveLength(12);
    // All four corners on one plane just out from the wall's face, the room's side of it.
    const ys = [c[1]!, c[4]!, c[7]!, c[10]!];
    for (const y of ys) expect(y).toBeCloseTo(ys[0]!, 6);
    expect(ys[0]!).toBeGreaterThan(face.line + WALL_THICKNESS.wall / 2);
    expect(ys[0]! - (face.line + WALL_THICKNESS.wall / 2)).toBeLessThan(6);
    // Inside the box along the wall, its middle at eye height.
    expect(Math.min(c[0]!, c[9]!)).toBeGreaterThan(p.x);
    expect(Math.max(c[3]!, c[6]!)).toBeLessThan(p.x + p.width);
    const mid = (c[2]! + c[8]!) / 2;
    expect(mid).toBeCloseTo(POSTER_EYE_Z * RISE, 0);
  });

  it('is as tall as its box and never above its wall', () => {
    expect((posterSpan(76).z1 - posterSpan(76).z0) * RISE).toBeCloseTo(76, 5);
    const tall = posterSpan(400);
    expect(tall.z1).toBeLessThanOrEqual(POSTER_TOP_Z);
    expect(tall.z0).toBeGreaterThan(0);
  });

  it('builds the same frame with and without a picture, and with one rebuilds only itself', () => {
    const empty = poster();
    const framed = withPosterPicture(empty, { id: 'img_a' });
    const a = piecesMesh([room, empty]);
    const b = piecesMesh([room, framed]);
    expect(b.positions.length).toBe(a.positions.length);
    expect(b.posterPictures.get('p')).toEqual(a.posterPictures.get('p'));
  });

  it('lies along a side wall, its picture facing into the room', () => {
    const p = { ...createShape('poster', 8, 120), id: 'p' } as ShapeElement;
    const hung = snapToWallFace(p, [room, p]);
    const face = mountedFace(hung, [room, hung])!;
    expect(face.vertical).toBe(true);
    const c = piecesMesh([room, hung]).posterPictures.get('p')!;
    const xs = [c[0]!, c[3]!, c[6]!, c[9]!];
    for (const x of xs) expect(x).toBeCloseTo(xs[0]!, 6);
    expect(Math.abs(c[1]! - c[4]!)).toBeGreaterThan(20);
  });
});
