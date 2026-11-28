// Palette portraits (docs/specs/008-canvas/3d-engine.md "Palette portraits"): the avatar palette's pictures of your
// character are the scene's own game character, rendered offscreen (components/canvas/real-3d/figure-portraits.ts).
// This is their pure part: what a picture is asked for by, its key, how it is framed and posed, and the store of
// finished images every tile reads. No three.js, no React.

import type { AvatarReactionKind } from '@livehuddle/avatar/reactions';
import type { AvatarStatus } from '@livehuddle/avatar/status';
import { behaviourStill } from '@/lib/avatar-palette';
import { BODY, type CharacterLook } from './character';
import { gameLook, gameLookKey } from './game-look';

/**
 * How a picture is framed: the whole figure, the whole figure with room for raised arms, the head, or the preview
 * card's stage (room for raised arms and a hop besides).
 */
export type PortraitCrop = 'full' | 'action' | 'head' | 'stage';

/** One picture: a look, framed, standing or caught mid-move, at a size in CSS px. */
export type PortraitRequest = {
  look: CharacterLook;
  crop: PortraitCrop;
  move: AvatarReactionKind | null;
  width: number;
  height: number;
  /** A status whose signature the figure wears (the preview card's), or none. */
  status?: AvatarStatus | null;
};

/** The device pixels a picture is rendered at, per CSS px, at most (a retina screen's 2). */
export const PORTRAIT_MAX_RATIO = 2;
/** The side of the renderer's square drawing buffer: the largest picture (the preview card's) fits in it. */
export const PORTRAIT_BUFFER_PX = 512;
/** Images kept before the oldest goes: every look tile of every flyout, both genders, with room to spare. */
export const PORTRAIT_CACHE_CAP = 160;
/** Dressed figures kept for stills, one per look: a flyout's worth of looks for both genders. */
export const PORTRAIT_FIGURE_CAP = 24;
/** The rendering a frame may take before the rest waits for the next (keeps the walk at 60 fps). */
export const PORTRAIT_FRAME_BUDGET_MS = 6;
/** With nothing to draw this long, the renderer and its WebGL context are let go. */
export const PORTRAIT_IDLE_RELEASE_MS = 15_000;
/** The camera's vertical field of view, narrow, so a portrait is not distorted. */
export const PORTRAIT_FOV_DEG = 20;
/** The camera turned off straight on, so the figure has depth. */
export const PORTRAIT_TURN_DEG = 15;
/** The camera raised above the figure's middle. */
export const PORTRAIT_PITCH_DEG = 12;
/** A still's pose settles over this many updates of this many seconds (the arms ease about 0.1 s). */
export const PORTRAIT_SETTLE_STEPS = 12;
export const PORTRAIT_SETTLE_DT = 0.05;
/** The pause between two plays of a Behaviour in the preview card (as the sprite preview's). */
export const PORTRAIT_LOOP_REST_MS = 500;
/** The ink pass's grade, as a CSS filter on the image (outline-pass.ts: saturation 1.14, contrast 1.07). */
export const PORTRAIT_GRADE = 'saturate(1.14) contrast(1.07)';
/** Canvas px per sprite px of a Regular character (Real3DLayer's 60/24 a sprite px, at the Regular scale 1.9). */
export const CANVAS_PX_PER_SPRITE_PX = (60 / 24) * 1.9;

/** The device pixel ratio a picture renders at. */
export function portraitRatio(dpr: number | undefined): number {
  return Math.max(1, Math.min(PORTRAIT_MAX_RATIO, dpr || 1));
}

/** A picture's size in device px, never past the renderer's buffer. */
export function portraitPixels(
  req: Pick<PortraitRequest, 'width' | 'height'>,
  ratio: number,
): { w: number; h: number } {
  const clamp = (v: number) => Math.max(1, Math.min(PORTRAIT_BUFFER_PX, Math.round(v * ratio)));
  return { w: clamp(req.width), h: clamp(req.height) };
}

/**
 * The picture's key: what the scene would draw (the game look's key, so two options that wear the same parts share
 * one image), the move, the crop and the device size.
 */
export function portraitKey(req: PortraitRequest, ratio: number): string {
  const { w, h } = portraitPixels(req, ratio);
  // A status only when worn, so every other picture keeps its key.
  const st = req.status ? `#st=${req.status}` : '';
  return `${gameLookKey(gameLook(req.look))}#${req.move ?? 'stand'}#${req.crop}#${w}x${h}${st}`;
}

/** The game pack a picture needs loaded. */
export function portraitPack(req: PortraitRequest): 'men' | 'women' {
  return gameLook(req.look).pack;
}

/** What a crop frames, in sprite px about the feet: the middle's height, and the height and width to fit. */
export function portraitFrame(crop: PortraitCrop): {
  centreZ: number;
  span: number;
  across: number;
} {
  const H = BODY.height;
  switch (crop) {
    case 'head':
      return { centreZ: H * 0.92, span: H * 0.28, across: H * 0.28 };
    case 'action':
      return { centreZ: H * 0.56, span: H * 1.22, across: H * 1.0 };
    case 'stage':
      return { centreZ: H * 0.66, span: H * 1.46, across: H * 1.1 };
    case 'full':
      return { centreZ: H * 0.5, span: H * 1.1, across: H * 0.7 };
  }
}

/** The figure's yaw for each facing, as the scene turns a character (figure-motion.ts YAW, the sheet's). */
const FACING_YAW = { down: 0, left: Math.PI / 2, up: Math.PI, right: -Math.PI / 2 } as const;

/** The arms, legs and facing of a still: standing, or a Behaviour at its telling moment. */
export function portraitMove(move: AvatarReactionKind | null): {
  armsUp: boolean;
  armsOut: boolean;
  waving: boolean;
  legsApart: boolean;
  yaw: number;
} {
  if (!move) return { armsUp: false, armsOut: false, waving: false, legsApart: false, yaw: 0 };
  const p = behaviourStill(move);
  return {
    armsUp: p.armsUp,
    armsOut: p.armsOut,
    waving: p.waveArm,
    legsApart: p.legsApart,
    yaw: FACING_YAW[p.facing ?? 'down'],
  };
}

/** A facing's yaw (a spin's turns, played in the preview card). */
export function facingYaw(facing: keyof typeof FACING_YAW | undefined): number {
  return FACING_YAW[facing ?? 'down'];
}

/** A Behaviour's lift (canvas px) in the figure's sprite px. */
export function liftInSpritePx(lift: number): number {
  return Math.max(0, lift) / CANVAS_PX_PER_SPRITE_PX;
}

/** The camera's place for a crop at an aspect: where it stands and what it looks at, in canvas coordinates. */
export function portraitCamera(
  crop: PortraitCrop,
  aspect: number,
): { position: [number, number, number]; target: [number, number, number] } {
  const f = portraitFrame(crop);
  const v = (PORTRAIT_FOV_DEG * Math.PI) / 180 / 2;
  const h = Math.atan(Math.tan(v) * aspect);
  // Backed off until both the height and the width fit.
  const d = Math.max(f.span / 2 / Math.tan(v), f.across / 2 / Math.tan(h));
  const turn = (PORTRAIT_TURN_DEG * Math.PI) / 180;
  const pitch = (PORTRAIT_PITCH_DEG * Math.PI) / 180;
  const flat = d * Math.cos(pitch);
  // A character facing `down` faces canvas +y: the camera stands there, turned a little to its left.
  return {
    position: [-Math.sin(turn) * flat, Math.cos(turn) * flat, f.centreZ + d * Math.sin(pitch)],
    target: [0, 0, f.centreZ],
  };
}

// The store of finished pictures. A value is an image URL, or PORTRAIT_FAILED when it cannot be drawn (no WebGL, the
// pack failed), so the tile shows its sprite.
export const PORTRAIT_FAILED = 'failed';

const images = new Map<string, string>();
const listeners = new Set<() => void>();
let revoke: (url: string) => void = (url) => {
  if (url !== PORTRAIT_FAILED && typeof URL !== 'undefined' && URL.revokeObjectURL)
    URL.revokeObjectURL(url);
};

/** A stored picture's URL (or PORTRAIT_FAILED), or undefined while it is not drawn. */
export function portraitUrl(key: string): string | undefined {
  return images.get(key);
}

/** Stores a picture, the oldest going (its URL revoked) past the cap, and tells every tile. */
export function putPortrait(key: string, url: string): void {
  const had = images.get(key);
  if (had !== undefined && had !== url) revoke(had);
  images.delete(key);
  images.set(key, url);
  while (images.size > PORTRAIT_CACHE_CAP) {
    const [oldest, old] = images.entries().next().value as [string, string];
    images.delete(oldest);
    revoke(old);
  }
  for (const l of listeners) l();
}

export function subscribePortraits(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For tests: empties the store, and swaps how a URL is let go. */
export function resetPortraits(revokeUrl?: (url: string) => void): void {
  for (const url of images.values()) revoke(url);
  images.clear();
  if (revokeUrl) revoke = revokeUrl;
}

/** How many pictures are stored (for the performance probe and tests). */
export function portraitCount(): number {
  return images.size;
}
