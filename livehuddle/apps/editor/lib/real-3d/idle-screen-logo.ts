// An idle Screen's logo (docs/specs/009-elements/screen-and-room-sign.md "The idle face", 3d-engine.md "An idle
// Screen shows the logo"): which Screens are idle, the prism's pose through its calm loop (open and turn as the header
// logo does on hover, settle, rest) and how a quad fits the logo's texture without stretching it. Pure: no three.js,
// no DOM.

import { screenFile, screenVideoTarget } from '@livehuddle/document';
import {
  easeOutCubic,
  PRISM_OPEN_MS,
  PRISM_SETTLE_MS,
  PRISM_SPIN_DEG_PER_S,
  PRISM_SPIN_RAMP_MS,
  restingTurn,
  settleTurn,
} from '@livehuddle/ui/brand';

/** The loop's beats, in ms: at rest, open and turning, then settling home. */
export const IDLE_LOGO_REST_MS = 3000;
export const IDLE_LOGO_OPEN_MS = 5000;
export const IDLE_LOGO_CYCLE_MS = IDLE_LOGO_REST_MS + IDLE_LOGO_OPEN_MS + PRISM_SETTLE_MS;
/** How often the texture may be redrawn while the prism moves. */
export const IDLE_LOGO_FPS = 15;

export type LogoPose = { turn: number; open: number };

/** The rest pose (the logo as drawn) and the still one reduced motion shows (open, unturned). */
export const LOGO_AT_REST: LogoPose = { turn: 0, open: 0 };
export const LOGO_STILL: LogoPose = { turn: 0, open: 1 };

/** Whether a Screen has nothing chosen to show: no file and no video link it can play (ScreenView's idle face). */
export function idleScreen(el: unknown): boolean {
  if (!el || typeof el !== 'object') return false;
  const e = el as { type?: unknown; shape?: unknown; screenUrl?: string; liveItem?: never };
  if (e.type !== 'shape' || e.shape !== 'screen') return false;
  return !screenFile(e) && !screenVideoTarget(e.screenUrl);
}

// How far the prism has turned `ms` into its open beat: its spin eases up to pace (useBrandSpin's ramp, integrated).
function turnAfter(ms: number): number {
  const v = PRISM_SPIN_DEG_PER_S / 1000;
  const ramp = PRISM_SPIN_RAMP_MS;
  const s = Math.min(1, Math.max(0, ms / ramp));
  // The integral of easeOutCubic, 1 - (1 - s)^3, from 0 to s.
  const ramped = v * ramp * (s + ((1 - s) ** 4 - 1) / 4);
  return ramped + v * Math.max(0, ms - ramp);
}

/** The prism's pose `ms` into the loop (any ms: the loop repeats), or the still open logo under reduced motion. */
export function idleLogoPose(ms: number, reduced = false): LogoPose {
  if (reduced) return LOGO_STILL;
  const t = ((ms % IDLE_LOGO_CYCLE_MS) + IDLE_LOGO_CYCLE_MS) % IDLE_LOGO_CYCLE_MS;
  if (t < IDLE_LOGO_REST_MS) return LOGO_AT_REST;
  const e = t - IDLE_LOGO_REST_MS;
  if (e < IDLE_LOGO_OPEN_MS) return { turn: turnAfter(e), open: easeOutCubic(e / PRISM_OPEN_MS) };
  // Settling: from where the spin got to, still moving, home to the nearest quarter turn (the box looks the same).
  const from = turnAfter(IDLE_LOGO_OPEN_MS);
  const v = PRISM_SPIN_DEG_PER_S / 1000;
  const home = restingTurn(from + v * PRISM_SETTLE_MS * 0.5);
  const s = (e - IDLE_LOGO_OPEN_MS) / PRISM_SETTLE_MS;
  return { turn: settleTurn(from, v, home, s), open: 1 - easeOutCubic(s) };
}

/** Whether the prism is still in this part of the loop, so the texture need not be drawn again. */
export function idleLogoResting(ms: number, reduced = false): boolean {
  if (reduced) return true;
  const t = ((ms % IDLE_LOGO_CYCLE_MS) + IDLE_LOGO_CYCLE_MS) % IDLE_LOGO_CYCLE_MS;
  return t < IDLE_LOGO_REST_MS;
}

/**
 * The texture coordinates that fit a texture `texAspect` wide per tall inside a place `placeAspect` (contain): the
 * place shows all of it, the margin beyond it is the texture's edge colour stretched (it is clamped), so the logo
 * keeps its proportions on any size of Screen. Bottom left, bottom right, top right, top left.
 */
export function containUvs(texAspect: number, placeAspect: number): Float32Array {
  let u0 = 0;
  let u1 = 1;
  let v0 = 0;
  let v1 = 1;
  if (texAspect > 0 && placeAspect > 0) {
    if (placeAspect > texAspect) {
      const grow = placeAspect / texAspect;
      u0 = (1 - grow) / 2;
      u1 = u0 + grow;
    } else {
      const grow = texAspect / placeAspect;
      v0 = (1 - grow) / 2;
      v1 = v0 + grow;
    }
  }
  return new Float32Array([u0, v0, u1, v0, u1, v1, u0, v1]);
}
