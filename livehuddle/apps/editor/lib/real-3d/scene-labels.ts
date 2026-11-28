// Real 3D's room names (docs/specs/008-canvas/3d-engine.md "Room names read in 3D"): a room's name on a nameplate on
// the wall that carries it (over its doorway, or its back wall), on both of the wall's faces so it reads from every
// side the camera turns to, and never mirrored. Built as geometry (text-mesh.ts), crisp at any zoom. Pure but for
// the text raster.

import type { SpaceWall } from '@/lib/space-3d/space-3d-walls';
import { SPACE_DOOR_HEIGHT } from '@/lib/space-3d/space-3d-walls';
import { mix, type MeshBuilder, type Rgb, type Vec3 } from './mesh-builder';
import { faceText, textWidth } from './text-mesh';

/** A room name's capital letters, in canvas px as built (the wall rises 1.2 times): big enough to read at 100%. */
export const ROOM_NAME_CAP = 15;
/** The nameplate's margin round the name, and how far it stands proud of the wall. */
const PLATE_PAD = 7;
const PLATE_T = 1.4;
/** The plate's colours: a warm cream with dark ink, readable on any wall colour and in evening light. */
export const NAMEPLATE = { plate: 0xf7f3ea, ink: 0x1f2430, rim: 0x8a6a45 } as const;

/**
 * A nameplate on one face: the plate centred at `at` (on the face), running along `right`, standing proud along
 * `normal`, with `text` in dark ink on it. `maxWidth` bounds the plate; a long name is shrunk to fit it.
 */
export function nameplate(
  m: MeshBuilder,
  text: string,
  o: {
    at: { x: number; y: number; z: number };
    right: { x: number; y: number };
    normal: { x: number; y: number };
    cap: number;
    maxWidth: number;
    colours?: { plate: Rgb; ink: Rgb; rim: Rgb };
  },
): boolean {
  const c = o.colours ?? NAMEPLATE;
  const want = textWidth(text, o.cap);
  if (want <= 0) return false;
  const textW = Math.min(want, o.maxWidth - 2 * PLATE_PAD);
  if (textW <= 0) return false;
  const cap = o.cap * (textW / want);
  const half = textW / 2 + PLATE_PAD;
  const h = cap + 2 * PLATE_PAD * 0.8;
  const { x, y, z } = o.at;
  const along = (d: number, out: number) => ({
    x: x + o.right.x * d + o.normal.x * out,
    y: y + o.right.y * d + o.normal.y * out,
  });
  // A thin dark rim behind the plate, then the plate, then the name.
  m.slab(
    along(-half - 0.8, PLATE_T / 2),
    along(half + 0.8, PLATE_T / 2),
    PLATE_T,
    z - h / 2 - 0.8,
    z + h / 2 + 0.8,
    c.rim,
    {
      bare: true,
    },
  );
  m.slab(
    along(-half, PLATE_T + 0.3),
    along(half, PLATE_T + 0.3),
    0.8,
    z - h / 2,
    z + h / 2,
    mix(c.plate, 0xffffff, 0.1),
    {
      top: c.plate,
      bare: true,
    },
  );
  const face = PLATE_T + 0.75;
  const at: Vec3 = [x + o.normal.x * face, y + o.normal.y * face, z];
  // Seen from the side `normal` points to, the line reads along normal x up (canvas y runs down the screen).
  const right: Vec3 = [o.normal.y, -o.normal.x, 0];
  faceText(m, text, {
    at,
    right,
    up: [0, 0, 1],
    normal: [o.normal.x, o.normal.y, 0],
    height: cap,
    maxWidth: textW,
    colour: c.ink,
  });
  return true;
}

/**
 * A labelled wall's nameplates: over a doorway on its lintel, else high on the wall, on both faces. A wall cut down
 * below the plate (`cap`) shows none.
 */
export function wallLabel(
  m: MeshBuilder,
  wall: SpaceWall,
  thickness: number,
  cap = Infinity,
): void {
  const text = wall.label?.trim();
  if (!text) return;
  const { a, b, height: h } = wall;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1) return;
  const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const n = { x: -u.y, y: u.x };
  const top = wall.kind === 'doorway' ? SPACE_DOOR_HEIGHT : h * 0.55;
  const z = (top + h) / 2 - 2;
  if (z - ROOM_NAME_CAP > cap) return;
  // A doorway's name may run past its frame onto the wall either side; a plain wall keeps it on itself.
  const maxWidth = wall.kind === 'doorway' ? Math.max(len * 2.2, 160) : len - 16;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  for (const s of [1, -1] as const) {
    const normal = { x: n.x * s, y: n.y * s };
    nameplate(m, text, {
      at: { x: mid.x + normal.x * (thickness / 2), y: mid.y + normal.y * (thickness / 2), z },
      right: u,
      normal,
      cap: ROOM_NAME_CAP,
      maxWidth,
    });
  }
}
