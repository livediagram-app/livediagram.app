// The Avatar Pad's drawing (docs/specs/009-elements/avatar-pad.md "The element"): a low round oak platform both
// renderers paint, the editor's AvatarPadView and the headless svg-render-faces, from this one table. It is drawn in
// the Space's furniture style (the theme's stroke for the outlines and the side's shade) with its own fixed woods and
// rug (`AVATAR_PAD_TONES`), as a plant keeps its leaves: a walnut band round its side, a round rug in its top and a
// compass rose inlaid in a walnut medallion where the character stands. No light, no glow, nothing that moves (the
// owner, 2026-11-27: "make it less scifi"). It scales cleanly at any size and zoom.
//
// The view box is the shared pad grid at 4 units a pixel, the same 32:20 box `avatarPadArtRect` fits, so the drawn
// core is centred on `avatarPadCore` and the top face matches `avatarPadFootprint` at every size: both are read from
// the shared geometry below, never retyped. Pure: no React, no DOM, safe in a worker.

import {
  AVATAR_PAD_GRID,
  AVATAR_PAD_TONES,
  avatarPadCore,
  avatarPadFootprint,
} from '@livehuddle/avatar/pad-art';
import {
  FURNITURE_FACE_SHADE,
  FURNITURE_GLINT,
  FURNITURE_PANEL_STROKE,
  FURNITURE_RAIL_STROKE,
  FURNITURE_SHADOW,
} from './seating';

/** The drawing's own units: the pad grid at 4 a pixel (a new pad's 128 x 80 box draws 1:1). */
export const AVATAR_PAD_VIEW = {
  width: AVATAR_PAD_GRID.width * 4,
  height: AVATAR_PAD_GRID.height * 4,
} as const;

const VIEW_BOX = { x: 0, y: 0, ...AVATAR_PAD_VIEW };
/** Where a starting character's feet go, in view units: the shared core, so the walk and the drawing agree. */
export const AVATAR_PAD_CORE_POINT = avatarPadCore(VIEW_BOX);
const FOOT = avatarPadFootprint(VIEW_BOX);

const C = AVATAR_PAD_CORE_POINT;
// The top face: the footprint less the outline, a touch shallower (the footprint's extra depth is the side).
const TOP = { rx: FOOT.rx - 2, ry: FOOT.ry - 5 };
// How far the platform's side drops below the top face.
const DEPTH = 12;

/**
 * What a part is, which decides its paint (`avatarPadPaint`). `core` is the medallion where the character stands.
 */
export type AvatarPadArtRole =
  | 'shadow'
  | 'side'
  | 'sideShade'
  | 'band'
  | 'top'
  | 'glint'
  | 'rug'
  | 'rugBand'
  | 'core'
  | 'roseLight'
  | 'roseDark'
  | 'hub';

export type AvatarPadArtPart =
  | { tag: 'ellipse'; role: AvatarPadArtRole; cx: number; cy: number; rx: number; ry: number }
  | { tag: 'path'; role: AvatarPadArtRole; d: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
const ellipse = (role: AvatarPadArtRole, rx: number, ry: number, dy = 0): AvatarPadArtPart => ({
  tag: 'ellipse',
  role,
  cx: C.x,
  cy: r2(C.y + dy),
  rx,
  ry,
});

// A band round the side: between the top's front arc dropped by `from` and by `to`.
const L = r2(C.x - TOP.rx);
const R = r2(C.x + TOP.rx);
const sideBand = (from: number, to: number) =>
  `M${L} ${C.y + from}V${C.y + to}A${TOP.rx} ${TOP.ry} 0 0 0 ${R} ${C.y + to}` +
  `V${C.y + from}A${TOP.rx} ${TOP.ry} 0 0 1 ${L} ${C.y + from}Z`;
// The side: the band between the top's front arc and the same arc `DEPTH` lower.
const SIDE_D = sideBand(0, DEPTH);

// The back half of an ellipse round the core, left to right over the top: a lit edge.
const backArc = (rx: number, ry: number) =>
  `M${r2(C.x - rx)} ${C.y}A${rx} ${ry} 0 0 1 ${r2(C.x + rx)} ${C.y}`;

// The rug and the medallion, laid on the top face (its radii in view units, foreshortened like the top).
const RUG = { rx: TOP.rx - 7, ry: TOP.ry - 3 };
const RUG_BAND = { rx: 37, ry: 14 };
const MEDALLION = { rx: 21, ry: 8.2 };
// The compass rose lies flat, so it is foreshortened as the top is.
const FLAT = TOP.ry / TOP.rx;
const ROSE_LONG = 18;

/**
 * The compass rose's halves as two paths: each of its eight points (four long, four short between) split down its
 * middle, the light halves in one path and the dark in the other, as an inlay is cut.
 */
function rose(light: boolean): string {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const main = i % 2 === 0;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const len = main ? ROSE_LONG : ROSE_LONG * 0.62;
    const half = main ? ROSE_LONG * 0.17 : ROSE_LONG * 0.13;
    const side = light ? -1 : 1;
    const pt = (r: number, t: number) =>
      `${r2(C.x + Math.cos(t) * r)} ${r2(C.y + Math.sin(t) * r * FLAT)}`;
    d += `M${C.x} ${C.y}L${pt(half, a + (side * Math.PI) / 2)}L${pt(len, a)}Z`;
  }
  return d;
}

/**
 * The pad's parts, back to front, in `AVATAR_PAD_VIEW` units: a fixed 12 nodes per pad, whatever its size. The top,
 * the rug, the medallion and the rose are centred on `AVATAR_PAD_CORE_POINT`.
 */
export const AVATAR_PAD_ART: readonly AvatarPadArtPart[] = [
  ellipse('shadow', TOP.rx + 2, TOP.ry + 1, DEPTH + 3),
  { tag: 'path', role: 'side', d: SIDE_D },
  { tag: 'path', role: 'band', d: sideBand(DEPTH * 0.42, DEPTH * 0.62) },
  { tag: 'path', role: 'sideShade', d: SIDE_D },
  ellipse('top', TOP.rx, TOP.ry),
  { tag: 'path', role: 'glint', d: backArc(TOP.rx - 3, TOP.ry - 1.5) },
  ellipse('rug', RUG.rx, RUG.ry),
  ellipse('rugBand', RUG_BAND.rx, RUG_BAND.ry),
  ellipse('core', MEDALLION.rx, MEDALLION.ry),
  { tag: 'path', role: 'roseLight', d: rose(true) },
  { tag: 'path', role: 'roseDark', d: rose(false) },
  ellipse('hub', 1.8, 1),
];

export type AvatarPadPaint = {
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  strokeLinecap?: 'round';
  strokeLinejoin?: 'round';
};

/**
 * A part's paint. `stroke` is the theme's line colour, which outlines the platform and shades its side toward the
 * room; everything else is the pad's own fixed tones, so it reads the same on light and dark paper.
 */
export function avatarPadPaint(role: AvatarPadArtRole, stroke: string): AvatarPadPaint {
  const T = AVATAR_PAD_TONES;
  switch (role) {
    case 'shadow':
      return { fill: FURNITURE_SHADOW.fill, opacity: FURNITURE_SHADOW.opacity };
    case 'side':
      return { fill: T.oak, stroke, strokeWidth: FURNITURE_PANEL_STROKE };
    // The side faces the room: shaded with the stroke colour, as a furniture face is.
    case 'sideShade':
      return { fill: stroke, opacity: FURNITURE_FACE_SHADE };
    case 'band':
      return { fill: T.walnut };
    case 'top':
      return { fill: T.oakLight, stroke, strokeWidth: FURNITURE_PANEL_STROKE };
    case 'glint':
      return {
        fill: 'none',
        stroke: FURNITURE_GLINT.stroke,
        strokeWidth: FURNITURE_RAIL_STROKE,
        opacity: FURNITURE_GLINT.opacity,
        strokeLinecap: 'round',
      };
    // The rug: a cream field bound in terracotta, with a sage band.
    case 'rug':
      return { fill: T.cream, stroke: T.terracotta, strokeWidth: 3.5 };
    case 'rugBand':
      return { fill: 'none', stroke: T.sage, strokeWidth: 2 };
    // The medallion where the character stands: walnut, rimmed in ochre.
    case 'core':
      return { fill: T.walnut, stroke: T.ochre, strokeWidth: 1.5 };
    case 'roseLight':
      return { fill: T.cream, strokeLinejoin: 'round' };
    case 'roseDark':
      return { fill: T.ochre, strokeLinejoin: 'round' };
    case 'hub':
      return { fill: T.ochre };
  }
}
