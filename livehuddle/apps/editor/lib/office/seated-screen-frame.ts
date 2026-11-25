// Sitting facing a Screen frames it (docs/specs/008-canvas/avatar-mode.md "The camera", Work Tracker 1427): which
// Screen a seat looks at, and the view that shows it and the sitter together, clear of the palette strip above and
// the Call dock below. Pure: no React, no DOM; useSeatedScreenFrame runs it.
import type { AvatarFacing, AvatarPoint } from '@livehuddle/avatar/walk';

export type FrameBox = { x: number; y: number; width: number; height: number };
export type ViewPose = { zoom: number; offset: AvatarPoint };

/** The least the frame zooms out to: below it the Screen's words are too small to read. */
export const SEATED_FRAME_MIN_ZOOM = 0.6;
/** The chrome the frame keeps clear of, in screen px: the palette strip above, the Call dock below, a gutter aside. */
export const SEATED_FRAME_CLEAR = { top: 88, bottom: 120, side: 48 } as const;
// How far a sitter reaches above and beside its feet, in canvas px (a regular character, seated, with a little air).
const SITTER_ABOVE = 96;
const SITTER_BELOW = 16;
const SITTER_SIDE = 40;

/** The nearest Screen whose middle lies in the half of the room the sitter faces, or null. */
export function screenAhead(
  feet: AvatarPoint,
  facing: AvatarFacing,
  screens: readonly FrameBox[],
): FrameBox | null {
  let best: FrameBox | null = null;
  let bestGap = Infinity;
  for (const s of screens) {
    const mx = s.x + s.width / 2;
    const my = s.y + s.height / 2;
    const ahead =
      facing === 'up'
        ? my < feet.y
        : facing === 'down'
          ? my > feet.y
          : facing === 'left'
            ? mx < feet.x
            : mx > feet.x;
    if (!ahead) continue;
    const gap = Math.hypot(mx - feet.x, my - feet.y);
    if (gap < bestGap) {
      best = s;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * The view that shows the Screen and the sitter together inside the clear band: never closer than `zoom` (it only ever
 * zooms out), never further than SEATED_FRAME_MIN_ZOOM. When even that cannot hold both, the Screen wins, its top at
 * the top of the band. The offset follows the canvas's rule: the offset that centres a point is half the view less the
 * point, at any zoom.
 */
export function seatedScreenFrame(
  feet: AvatarPoint,
  screen: FrameBox,
  view: { width: number; height: number },
  zoom: number,
): ViewPose {
  const left = Math.min(screen.x, feet.x - SITTER_SIDE);
  const right = Math.max(screen.x + screen.width, feet.x + SITTER_SIDE);
  const top = Math.min(screen.y, feet.y - SITTER_ABOVE);
  const bottom = Math.max(screen.y + screen.height, feet.y + SITTER_BELOW);
  const bandW = Math.max(1, view.width - 2 * SEATED_FRAME_CLEAR.side);
  const bandH = Math.max(1, view.height - SEATED_FRAME_CLEAR.top - SEATED_FRAME_CLEAR.bottom);
  const fit = Math.min(bandW / (right - left), bandH / (bottom - top));
  const z = Math.max(Math.min(zoom, SEATED_FRAME_MIN_ZOOM), Math.min(zoom, fit));
  // The band's middle sits this far below the view's middle, in screen px (the dock is taller than the strip).
  const bandShift = (SEATED_FRAME_CLEAR.top - SEATED_FRAME_CLEAR.bottom) / 2;
  const fits = (bottom - top) * z <= bandH;
  // The canvas point at the view's middle.
  const midY = fits
    ? (top + bottom) / 2 - bandShift / z
    : top + (view.height / 2 - SEATED_FRAME_CLEAR.top) / z;
  const midX = (left + right) / 2;
  return { zoom: z, offset: { x: view.width / 2 - midX, y: view.height / 2 - midY } };
}
