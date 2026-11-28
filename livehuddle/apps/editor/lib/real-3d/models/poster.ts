// The Poster's model (docs/specs/009-elements/poster.md "The piece", 3d-engine.md "A Poster hangs its picture"): a
// thin dark frame round a white mat, hung flat on its wall, as wide and as tall as its box, its middle at eye height.
// The mat's opening holds a pale mount with a sun over two hills (the empty look); the chosen picture is no part of
// this geometry: the opening is marked (`MeshBuilder.picture`) and the 3D layer lays a textured quad over it, so a
// picture loading never rebuilds the pieces. Pure: no three.js, no DOM.

import { shade, type Vec3 } from '../mesh-builder';
import { RISE, type ModelTable } from './kit';

/** Where the frame's middle hangs, as built (risen by RISE): a board's middle, at a character's eyes. */
export const POSTER_EYE_Z = 74;
/** The lowest a frame's foot and the highest its top go, as built: above the skirting, under the wall's top. */
export const POSTER_FLOOR_Z = 8;
export const POSTER_TOP_Z = 128;

const FRAME = 0x2b2622;
const MAT = 0xf8fafc;
const MOUNT = 0xe8edf3;
const MARK = 0xc3ccd8;
/** How far the frame stands off its wall, and how proud the mat and the mount are of it. */
const DEPTH = 2.5;

/** The frame's span up the wall, as built, for a box `height` px tall: its middle at eye height, kept on the wall. */
export function posterSpan(height: number): { z0: number; z1: number } {
  const h = Math.min(POSTER_TOP_Z - POSTER_FLOOR_Z, Math.max(8, height / RISE));
  const z1 = Math.min(POSTER_TOP_Z, POSTER_EYE_Z + h / 2);
  const z0 = Math.max(POSTER_FLOOR_Z, z1 - h);
  return { z0, z1: z0 + h };
}

export const POSTER_MODELS: ModelTable = {
  poster: (m, { f }) => {
    // Hung flat (scene-pieces.ts hungFrame): W along the wall, D the box's height, its back at -D/2.
    const y = -f.D / 2;
    const hw = Math.max(4, f.W / 2);
    const { z0, z1 } = posterSpan(f.D);
    // The frame 3 px wide (as seen: its height in z is built under RISE), the mat a share of the smaller side.
    const fx = Math.min(3, hw * 0.2);
    const fz = fx / RISE;
    const matX = Math.max(1.5, Math.min(hw, (z1 - z0) * RISE * 0.5) * 0.12);
    const matZ = matX / RISE;
    m.b(-hw, y, z0, hw, y + DEPTH, z1, FRAME);
    const front = y + DEPTH;
    m.b(-hw + fx, front, z0 + fz, hw - fx, front + 0.3, z1 - fz, MAT, { bare: true });
    const ox0 = -hw + fx + matX;
    const ox1 = hw - fx - matX;
    const oz0 = z0 + fz + matZ;
    const oz1 = z1 - fz - matZ;
    const mount = front + 0.3;
    m.b(ox0, mount, oz0, ox1, mount + 0.2, oz1, MOUNT, { bare: true });
    // The empty look: a sun over two hills, in a quiet ink.
    const w = ox1 - ox0;
    const h = oz1 - oz0;
    const at = mount + 0.25;
    const ink = shade(MARK, 1);
    const n: Vec3 = [0, 1, 0];
    const tri = (a: [number, number], b: [number, number], c: [number, number]) =>
      m.tri([a[0], at, a[1]], [b[0], at, b[1]], [c[0], at, c[1]], n, n, n, ink);
    // The sun: a small disc of eight wedges, round as seen (its height in z built under RISE).
    const r = Math.min(w, h * RISE) * 0.09;
    const sx = ox0 + w * 0.68;
    const sz = oz0 + h * 0.7;
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2;
      const a1 = ((i + 1) / 8) * Math.PI * 2;
      tri(
        [sx, sz],
        [sx + Math.cos(a0) * r, sz + (Math.sin(a0) * r) / RISE],
        [sx + Math.cos(a1) * r, sz + (Math.sin(a1) * r) / RISE],
      );
    }
    // Two hills, the far one lower.
    tri([ox0, oz0], [ox0 + w * 0.62, oz0], [ox0 + w * 0.3, oz0 + h * 0.45]);
    tri([ox0 + w * 0.36, oz0], [ox1, oz0], [ox0 + w * 0.72, oz0 + h * 0.3]);
    // The picture's place: the opening, just proud of the mount and its mark, facing out from the wall.
    m.picture(ox0, at + 0.3, oz0, ox1, oz1);
  },
};
