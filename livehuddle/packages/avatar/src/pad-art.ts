// The Avatar Pad (docs/specs/009-elements/avatar-pad.md): the pixel drawing both renderers paint (the editor's
// AvatarPadView and the headless svg-render-faces), and the geometry Avatar mode needs to put a character on it.
// The drawing is a fixed pixel grid in the avatar sprite's own palette, scaled whole into the element's box, so a
// resized pad scales its pixels rather than redrawing them. Pure: no React, no DOM, safe in a worker.

import { AVATAR_PALETTE as P } from './palette';

// The grid, in pixels. Wide and shallow: a round platform seen from the front and a little above.
export const AVATAR_PAD_GRID = { width: 32, height: 20 } as const;

// A new pad: four canvas px per grid pixel, the same chunkiness as a Regular character's pixels (40x56 canvas px
// over a 16x24 grid is 2.5 to 2.3 px), a touch bigger so the pad reads as the floor they stand on.
export const AVATAR_PAD_DEFAULT_SIZE = {
  width: AVATAR_PAD_GRID.width * 4,
  height: AVATAR_PAD_GRID.height * 4,
} as const;

// The top face's ellipse, its centre and radii in grid pixels. The platform's side drops `SIDE_DEPTH` pixels
// below it.
const TOP = { cx: 16, cy: 7.5, rx: 15, ry: 6 } as const;
const SIDE_DEPTH = 4;
// The ring of light set into the top face (outer and inner ellipse), and the bright core inside it.
const RING_OUTER = { rx: 10.5, ry: 4.3 } as const;
const RING_INNER = { rx: 8, ry: 3.1 } as const;
const RING_GROOVE = { rx: 11.6, ry: 4.9 } as const;
const CORE = { rx: 4.6, ry: 1.9 } as const;
const CORE_HOT = { rx: 2.2, ry: 0.9 } as const;

// The pad's tones: the sprite's (shoe slate for the outline, trouser blues for the side, white-coat greys for the
// top, denim for the groove the ring sits in) and the brand-cyan shirt for the light, mixed toward white for the ring's lit half
// and the core. The mixes are written out (`tint(shirt, 0.45 / 0.72 / 0.3)`, pinned by avatar-pad.test.ts) because
// colors.ts reaches this module through the shape factory, so importing `tint` here would be a cycle.
export const AVATAR_PAD_TONES = {
  outline: P.shoe,
  side: P.trousers,
  sideDark: P.trousersDark,
  top: P.coat,
  topShade: P.coatDark,
  rim: P.shirtWhite,
  groove: P.denim,
  ring: P.shirt,
  ringLit: '#7acef3',
  core: '#bce6f9',
  coreHot: P.shirtWhite,
  lamp: '#56c0f0',
} as const;

/**
 * What a run of pixels is, for the parts that move: the `ring` and `lamp` pixels shimmer, the `core` flashes on an
 * arrival. Everything else is `body`.
 */
export type AvatarPadPartRole = 'body' | 'ring' | 'core' | 'lamp';

/** One horizontal run of same-coloured pixels on the grid. */
export type AvatarPadPart = {
  x: number;
  y: number;
  width: number;
  role: AvatarPadPartRole;
  fill: string;
};

const inEllipse = (px: number, py: number, cx: number, cy: number, rx: number, ry: number) =>
  ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;

// The platform's silhouette at a grid point: the top ellipse swept down by the side's depth.
function inSlab(px: number, py: number, rx: number, ry: number): boolean {
  const dx = (px - TOP.cx) / rx;
  if (Math.abs(dx) > 1) return false;
  const half = ry * Math.sqrt(1 - dx * dx);
  return py >= TOP.cy - half && py <= TOP.cy + SIDE_DEPTH + half;
}

// Lamps round the platform's side, lit with the ring.
const LAMP_CELLS = new Set(['6,15', '11,16', '16,16', '21,16', '26,15']);

function cellAt(x: number, y: number): { fill: string; role: AvatarPadPartRole } | null {
  const px = x + 0.5;
  const py = y + 0.5;
  const T = AVATAR_PAD_TONES;
  if (!inSlab(px, py, TOP.rx + 1, TOP.ry + 1)) return null;
  if (!inSlab(px, py, TOP.rx, TOP.ry)) return { fill: T.outline, role: 'body' };
  if (inEllipse(px, py, TOP.cx, TOP.cy, TOP.rx, TOP.ry)) {
    if (inEllipse(px, py, TOP.cx, TOP.cy, CORE_HOT.rx, CORE_HOT.ry))
      return { fill: T.coreHot, role: 'core' };
    if (inEllipse(px, py, TOP.cx, TOP.cy, CORE.rx, CORE.ry)) return { fill: T.core, role: 'core' };
    if (inEllipse(px, py, TOP.cx, TOP.cy, RING_INNER.rx, RING_INNER.ry))
      return { fill: T.topShade, role: 'body' };
    if (inEllipse(px, py, TOP.cx, TOP.cy, RING_OUTER.rx, RING_OUTER.ry))
      // The far half of the ring catches the light; the near half is the cyan itself.
      return { fill: py < TOP.cy ? T.ringLit : T.ring, role: 'ring' };
    // The groove the ring is set into, seen only along its near side.
    if (py > TOP.cy && inEllipse(px, py, TOP.cx, TOP.cy, RING_GROOVE.rx, RING_GROOVE.ry))
      return { fill: T.groove, role: 'body' };
    // The top's rim: a lit edge along the back, the shaded grey along the front.
    if (!inEllipse(px, py, TOP.cx, TOP.cy, TOP.rx - 1, TOP.ry - 1))
      return { fill: py < TOP.cy ? T.rim : T.topShade, role: 'body' };
    return { fill: py > TOP.cy + 2.5 ? T.topShade : T.top, role: 'body' };
  }
  if (LAMP_CELLS.has(`${x},${y}`)) return { fill: T.lamp, role: 'lamp' };
  // The side: the trouser blue, its lowest pixels the darker one.
  const bottom = !inSlab(px, py + 2, TOP.rx, TOP.ry);
  return { fill: bottom ? T.sideDark : T.side, role: 'body' };
}

function buildParts(): AvatarPadPart[] {
  const parts: AvatarPadPart[] = [];
  for (let y = 0; y < AVATAR_PAD_GRID.height; y++) {
    let run: AvatarPadPart | null = null;
    for (let x = 0; x < AVATAR_PAD_GRID.width; x++) {
      const cell = cellAt(x, y);
      if (run && cell && cell.fill === run.fill && cell.role === run.role) {
        run.width += 1;
        continue;
      }
      if (run) parts.push(run);
      run = cell ? { x, y, width: 1, ...cell } : null;
    }
    if (run) parts.push(run);
  }
  return parts;
}

/**
 * The pad's drawing: horizontal runs of pixels on `AVATAR_PAD_GRID`, back to front, merged per row so the whole pad
 * is a couple of hundred rects at most. Worked out once: the grid is fixed and the box only scales it.
 */
export const AVATAR_PAD_PARTS: readonly AvatarPadPart[] = buildParts();

type PadBox = { x: number; y: number; width: number; height: number; rotation?: number };

/** Where the grid sits in a box: scaled whole (never stretched) and centred, as `preserveAspectRatio="xMidYMid meet"`. */
export function avatarPadArtRect(box: { width: number; height: number }): {
  x: number;
  y: number;
  scale: number;
} {
  const scale = Math.max(
    0,
    Math.min(box.width / AVATAR_PAD_GRID.width, box.height / AVATAR_PAD_GRID.height),
  );
  return {
    x: (box.width - AVATAR_PAD_GRID.width * scale) / 2,
    y: (box.height - AVATAR_PAD_GRID.height * scale) / 2,
    scale,
  };
}

/**
 * Where a character's feet go when it starts on this pad, in canvas px: the bright core, turned with the element's
 * rotation about its centre.
 */
export function avatarPadCore(pad: PadBox): { x: number; y: number } {
  const art = avatarPadArtRect(pad);
  const local = { x: art.x + TOP.cx * art.scale, y: art.y + (TOP.cy + 0.5) * art.scale };
  const cx = pad.width / 2;
  const cy = pad.height / 2;
  const rad = ((pad.rotation ?? 0) * Math.PI) / 180;
  const dx = local.x - cx;
  const dy = local.y - cy;
  return {
    x: pad.x + cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: pad.y + cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

/** The top face's half-width and half-height in canvas px, for "is this character standing on the pad". */
export function avatarPadFootprint(pad: PadBox): { rx: number; ry: number } {
  const { scale } = avatarPadArtRect(pad);
  return { rx: TOP.rx * scale, ry: (TOP.ry + 1) * scale };
}
