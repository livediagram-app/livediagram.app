// The Avatar Pad (docs/specs/009-elements/avatar-pad.md): the geometry both drawings and Avatar mode share (the grid
// the vector drawing is laid out on, where a character's feet go, the top face a character stands on) and the pad's
// fixed tones. The drawing itself is packages/document avatar-pad-art.ts. Pure: no React, no DOM, safe in a worker.

// The grid, in pixels. Wide and shallow: a round platform seen from the front and a little above.
export const AVATAR_PAD_GRID = { width: 32, height: 20 } as const;

// A new pad: four canvas px per grid pixel, the same chunkiness as a Regular character's pixels (40x56 canvas px
// over a 16x24 grid is 2.5 to 2.3 px), a touch bigger so the pad reads as the floor they stand on.
export const AVATAR_PAD_DEFAULT_SIZE = {
  width: AVATAR_PAD_GRID.width * 4,
  height: AVATAR_PAD_GRID.height * 4,
} as const;

// The top face's ellipse, its centre and radii in grid pixels; the platform's side drops below it.
const TOP = { cx: 16, cy: 7.5, rx: 15, ry: 6 } as const;

// The pad's tones (docs/specs/009-elements/avatar-pad.md "Theme lines, fixed woods"): a grounded arrival spot, not a
// teleporter (the owner, 2026-11-27: "make it less scifi"). Oak for the platform, walnut for its band and the
// medallion, a cream rug bound in terracotta with a sage band, and an ochre compass rose; the same woods and rug the
// 3D model is built in (apps/editor/lib/real-3d/models/pad.ts). Fixed whatever the theme, as a plant keeps its leaves:
// the theme gives only the outline and the side's shade.
export const AVATAR_PAD_TONES = {
  oak: '#c8955c',
  oakLight: '#dcb27e',
  walnut: '#6b4428',
  cream: '#f1e6cf',
  terracotta: '#c86f4a',
  sage: '#9bab7e',
  ochre: '#d6a24a',
} as const;

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
