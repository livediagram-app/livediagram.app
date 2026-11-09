// The Avatar Pad's drawing (docs/specs/009-elements/avatar-pad.md "The element"): a vector teleport platform both
// renderers paint, the editor's AvatarPadView and the headless svg-render-faces, from this one table. It is drawn
// in the Space's furniture style (the theme's stroke for the outlines, the seat wash for the body, a fixed light for
// the ring, as the office pieces keep their water and leaves) and scales cleanly at any size and zoom.
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
  FURNITURE_RAIL_OPACITY,
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
 * What a part is, which decides its paint (`avatarPadPaint`). `ring`, `glow` and `lamp` parts are the lights: they
 * sit in the shimmering group on the canvas. `core` is where the character stands.
 */
export type AvatarPadArtRole =
  | 'shadow'
  | 'side'
  | 'sideShade'
  | 'top'
  | 'bevel'
  | 'well'
  | 'glint'
  | 'glow'
  | 'ring'
  | 'ringLit'
  | 'lamp'
  | 'core'
  | 'coreHot';

export type AvatarPadArtPart =
  | { tag: 'ellipse'; role: AvatarPadArtRole; cx: number; cy: number; rx: number; ry: number }
  | { tag: 'path'; role: AvatarPadArtRole; d: string };

const LIGHT_ROLES: ReadonlySet<AvatarPadArtRole> = new Set(['glow', 'ring', 'ringLit', 'lamp']);
/** True for the parts that shimmer on the canvas. */
export const isAvatarPadLight = (role: AvatarPadArtRole): boolean => LIGHT_ROLES.has(role);

const r2 = (n: number) => Math.round(n * 100) / 100;
const ellipse = (role: AvatarPadArtRole, rx: number, ry: number, dy = 0): AvatarPadArtPart => ({
  tag: 'ellipse',
  role,
  cx: C.x,
  cy: r2(C.y + dy),
  rx,
  ry,
});

// The side: the band between the top's front arc and the same arc `DEPTH` lower.
const L = r2(C.x - TOP.rx);
const R = r2(C.x + TOP.rx);
const SIDE_D =
  `M${L} ${C.y}V${C.y + DEPTH}A${TOP.rx} ${TOP.ry} 0 0 0 ${R} ${C.y + DEPTH}` +
  `V${C.y}A${TOP.rx} ${TOP.ry} 0 0 1 ${L} ${C.y}Z`;

// The back half of an ellipse round the core, left to right over the top: a lit edge.
const backArc = (rx: number, ry: number) =>
  `M${r2(C.x - rx)} ${C.y}A${rx} ${ry} 0 0 1 ${r2(C.x + rx)} ${C.y}`;

// Lamps set into the side, spread along its front, each sat halfway down the side under the top's front arc.
const LAMP_XS = [-40, -20, 0, 20, 40];
const lamp = (dx: number): AvatarPadArtPart => ({
  tag: 'ellipse',
  role: 'lamp',
  cx: r2(C.x + dx),
  cy: r2(C.y + TOP.ry * Math.sqrt(1 - (dx / TOP.rx) ** 2) + DEPTH / 2),
  rx: 3,
  ry: 1.8,
});

/**
 * The pad's parts, back to front, in `AVATAR_PAD_VIEW` units: a fixed 17 nodes per pad, whatever its size.
 * Ring, core and well are concentric ellipses on `AVATAR_PAD_CORE_POINT`.
 */
export const AVATAR_PAD_ART: readonly AvatarPadArtPart[] = [
  ellipse('shadow', TOP.rx + 2, TOP.ry + 1, DEPTH + 3),
  { tag: 'path', role: 'side', d: SIDE_D },
  { tag: 'path', role: 'sideShade', d: SIDE_D },
  ...LAMP_XS.map(lamp),
  ellipse('top', TOP.rx, TOP.ry),
  ellipse('bevel', TOP.rx - 8, TOP.ry - 3.5),
  { tag: 'path', role: 'glint', d: backArc(TOP.rx - 4, TOP.ry - 2) },
  ellipse('well', 40, 15.5),
  ellipse('glow', 36, 14),
  ellipse('ring', 32, 12.3),
  { tag: 'path', role: 'ringLit', d: backArc(32, 12.3) },
  ellipse('core', 13, 5),
  ellipse('coreHot', 5.5, 2.1),
];

/** The fill of the radial glow: the ring's light at the core, fading out. Painted by a static gradient. */
export const AVATAR_PAD_GLOW = {
  color: AVATAR_PAD_TONES.ring,
  innerOpacity: 0.55,
} as const;

// The well's colour (sky-900): reads as a recess on light paper and dark alike.
const AVATAR_PAD_WELL = '#0c4a6e';

export type AvatarPadPaint = {
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  strokeLinecap?: 'round';
};

/**
 * A part's paint. `stroke` is the theme's line colour and `body` the seat wash furniture uses
 * (`chairSeatFill(undefined, stroke)`); `glowFill` is the renderer's gradient reference.
 */
export function avatarPadPaint(
  role: AvatarPadArtRole,
  stroke: string,
  body: string,
  glowFill: string,
): AvatarPadPaint {
  const T = AVATAR_PAD_TONES;
  switch (role) {
    case 'shadow':
      return { fill: FURNITURE_SHADOW.fill, opacity: FURNITURE_SHADOW.opacity };
    case 'side':
    case 'top':
      return { fill: body, stroke, strokeWidth: FURNITURE_PANEL_STROKE };
    // The side faces the room: shaded with the stroke colour, as a furniture face is.
    case 'sideShade':
      return { fill: stroke, opacity: FURNITURE_FACE_SHADE };
    case 'bevel':
      return {
        fill: 'none',
        stroke,
        strokeWidth: FURNITURE_RAIL_STROKE,
        opacity: FURNITURE_RAIL_OPACITY,
      };
    case 'glint':
      return {
        fill: 'none',
        stroke: FURNITURE_GLINT.stroke,
        strokeWidth: FURNITURE_RAIL_STROKE,
        opacity: FURNITURE_GLINT.opacity,
        strokeLinecap: 'round',
      };
    // The well the light is set into: a deep sky blue, sunk on either paper and tinted by the light.
    case 'well':
      return { fill: AVATAR_PAD_WELL, opacity: 0.24 };
    case 'glow':
      return { fill: glowFill };
    case 'ring':
      return { fill: 'none', stroke: T.ring, strokeWidth: 4 };
    case 'ringLit':
      return { fill: 'none', stroke: T.core, strokeWidth: 1.5, strokeLinecap: 'round' };
    case 'lamp':
      return { fill: T.lamp, stroke: T.ring, strokeWidth: 0.75 };
    case 'core':
      return { fill: T.core, stroke: T.ring, strokeWidth: 1.5 };
    case 'coreHot':
      return { fill: T.coreHot };
  }
}
