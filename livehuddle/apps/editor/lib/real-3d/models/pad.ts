// Real 3D's Avatar Pad (docs/specs/008-canvas/3d-engine.md "Block models"; docs/specs/009-elements/avatar-pad.md): the
// arrival spot characters start on, built with depth (the owner, 2026-11-27: "landing pad should be 3d btw and have
// depth") and grounded, not a teleporter ("make it less scifi"): a low round oak platform on a walnut foot, a walnut
// band round its side and a rounded lip, a round rug laid in its top, and a compass rose inlaid in its middle where
// a character stands. Warm woods and soft rug colours from the office's palette, no glow. Pure.
import { AVATAR_PAD_TONES } from '@livehuddle/avatar/pad-art';
import { shade, type Rgb } from '../mesh-builder';
import type { Builder, ModelTable } from './kit';

// The drawing's own tones (pad-art.ts), so the flat pad and the model are one platform.
const hex = (s: string) => parseInt(s.replace('#', ''), 16);
const OAK = hex(AVATAR_PAD_TONES.oak);
const OAK_LIGHT = hex(AVATAR_PAD_TONES.oakLight);
const OAK_DARK = 0xa8774a;
const WALNUT = hex(AVATAR_PAD_TONES.walnut);
const CREAM = hex(AVATAR_PAD_TONES.cream);
const TERRACOTTA = hex(AVATAR_PAD_TONES.terracotta);
const SAGE = hex(AVATAR_PAD_TONES.sage);
const OCHRE = hex(AVATAR_PAD_TONES.ochre);

/** How tall the platform stands, in canvas px (a step a character climbs). */
export const AVATAR_PAD_HEIGHT = 14;

/** A flat triangle lying face up at height z. */
function flatTri(
  m: Builder,
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
  z: number,
  colour: Rgb,
): void {
  const up = [0, 0, 1] as const;
  m.tri([a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z], up, up, up, shade(colour, 1));
}

/**
 * A compass rose lying at height z about (cx, cy): four long points to the sides of the platform and four short ones
 * between them, each split down its middle into a light and a dark half, as an inlay is cut.
 */
function compassRose(m: Builder, cx: number, cy: number, z: number, long: number): void {
  for (let i = 0; i < 8; i++) {
    const main = i % 2 === 0;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const len = main ? long : long * 0.62;
    const half = main ? long * 0.17 : long * 0.13;
    // The long points lie a hair over the short ones, so they cross cleanly.
    const zz = main ? z + 0.06 : z;
    const tip = [cx + Math.cos(a) * len, cy + Math.sin(a) * len] as const;
    const l = [
      cx + Math.cos(a - Math.PI / 2) * half,
      cy + Math.sin(a - Math.PI / 2) * half,
    ] as const;
    const r = [
      cx + Math.cos(a + Math.PI / 2) * half,
      cy + Math.sin(a + Math.PI / 2) * half,
    ] as const;
    flatTri(m, [cx, cy], l, tip, zz, main ? CREAM : OAK_LIGHT);
    flatTri(m, [cx, cy], tip, r, zz, main ? OCHRE : WALNUT);
  }
}

export const PAD_MODELS: ModelTable = {
  'avatar-pad': (m, { f }) => {
    const { x0, y0, x1, y1 } = f.foot;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    // Round from above, whatever its box (the owner, 2026-11-27: "avatar pad should be round not oval, thats a holdout
    // from the old 2d style"): as wide as the box's narrower side, in its middle.
    const R = Math.min(x1 - x0, y1 - y0) / 2;
    const H = AVATAR_PAD_HEIGHT;
    const o = { segments: 48 };
    // The platform: a walnut foot set in under it, the oak drum with a walnut band round it, a rounded lip.
    m.lathe(
      cx,
      cy,
      [
        { r: R * 0.93, z: 0 },
        { r: R * 0.93, z: 2.2 },
        { r: R * 0.99, z: 2.7 },
        { r: R, z: 3.6 },
        { r: R, z: H * 0.5 - 0.6 },
        { r: R * 1.004, z: H * 0.5 },
        { r: R * 1.004, z: H * 0.5 + 1 },
        { r: R, z: H * 0.5 + 1.6 },
        { r: R, z: H - 2.2 },
        { r: R * 0.99, z: H - 0.8 },
        { r: R * 0.97, z: H - 0.1 },
        { r: R * 0.945, z: H },
      ],
      OAK,
      {
        ...o,
        colours: [
          WALNUT,
          WALNUT,
          OAK_DARK,
          OAK,
          WALNUT,
          WALNUT,
          WALNUT,
          OAK,
          OAK,
          OAK_LIGHT,
          OAK_LIGHT,
        ],
      },
    );
    // The top: an oak ring round a round rug, its edge bound in terracotta, a cream field with a sage band, and a
    // walnut medallion rimmed in ochre in its middle.
    const rug = H + 0.25;
    m.lathe(
      cx,
      cy,
      [
        { r: R * 0.945, z: H },
        { r: R * 0.87, z: H },
        { r: R * 0.865, z: rug },
        { r: R * 0.8, z: rug },
        { r: R * 0.72, z: rug },
        { r: R * 0.68, z: rug },
        { r: R * 0.47, z: rug },
        { r: R * 0.44, z: rug + 0.05 },
        { r: R * 0.42, z: rug + 0.05 },
        { r: 0, z: rug + 0.05 },
      ],
      CREAM,
      {
        ...o,
        colours: [OAK_LIGHT, TERRACOTTA, TERRACOTTA, CREAM, SAGE, CREAM, OCHRE, OCHRE, WALNUT],
      },
    );
    // The compass rose, the spot a character arrives on, its points reaching into the rug.
    compassRose(m, cx, cy, rug + 0.12, R * 0.52);
    m.cylinder(cx, cy, rug + 0.12, rug + 0.3, R * 0.05, R * 0.05, OCHRE, { segments: 16 });
  },
};
