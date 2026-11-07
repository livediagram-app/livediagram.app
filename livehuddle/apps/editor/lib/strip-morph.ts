// The Edit | Walk switch's morph, its numbers (docs/specs/007-editor/toolbar-layout.md "Switching morphs the
// strip"): the strip's card reads as ONE bar resizing from the outgoing strip's box to the incoming one's, while
// its contents crossfade inside it. Pure, so the timing and the geometry are unit-tested; the DOM half is
// components/palette/strip-morph-dom.ts.
import { MOTION_CEILING_MS, MOTION_MS } from '@liveworkspace/style-guards/motion';

/** The bar's resize, the toggle's ride along its edge and the pill's glide: just inside the chrome ceiling. */
export const STRIP_MORPH_MS = MOTION_CEILING_MS - 10;
/** A soft ease-out with no overshoot, so the bar never passes its new size. */
export const STRIP_MORPH_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** How far the contents slide as they leave and arrive (px). */
export const STRIP_CONTENT_SHIFT_PX = 12;
/** The outgoing contents fade out over the micro token, leaving faster than the bar settles. */
export const STRIP_OUT_MS = MOTION_MS.micro;
/** The incoming contents: a short beat after the outgoing start to go, then a small cascade. */
export const STRIP_IN_DELAY_MS = 50;
export const STRIP_IN_STEP_MS = 10;
export const STRIP_IN_MS = 160;
/** The cascade stops growing here, so the last item still lands within STRIP_MORPH_MS. */
export const STRIP_IN_MAX_STEPS = Math.floor(
  (STRIP_MORPH_MS - STRIP_IN_DELAY_MS - STRIP_IN_MS) / STRIP_IN_STEP_MS,
);

export type StripSide = 'edit' | 'walk';
export type Box = { left: number; top: number; width: number; height: number };

/** Which way the contents travel: Walk's arrive from the right (its half of the toggle), Edit's from the left. */
export function contentShift(to: StripSide): { leave: number; arrive: number } {
  const sign = to === 'walk' ? 1 : -1;
  return { leave: -sign * STRIP_CONTENT_SHIFT_PX, arrive: sign * STRIP_CONTENT_SHIFT_PX };
}

/** The incoming item at `index`'s delay: the beat, then one step per item, capped so all land in time. */
export function arriveDelayMs(index: number): number {
  return STRIP_IN_DELAY_MS + Math.min(Math.max(0, index), STRIP_IN_MAX_STEPS) * STRIP_IN_STEP_MS;
}

/**
 * The morph's keyframes, from two screen-px boxes (the outgoing card's, the incoming card's) and the strip root's,
 * at the strip's UI zoom (rects are screen px, styles the zoomed box's own px).
 * - `surface`: the bar drawn behind the contents, root-relative, from the old box to the new;
 * - `clip`: the incoming card's clip-path, the same rounded box relative to the card, so the contents show only
 *   inside the bar (negative where the bar is wider than the card);
 * - `ride`: how far the toggle starts from its place, so it rides the bar's start edge rather than jumping.
 */
export function morphFrames(
  from: Box,
  to: Box,
  root: Pick<Box, 'left' | 'top'>,
  zoom: number,
  radius: number,
): {
  surface: [Box, Box];
  clip: [string, string];
  ride: number;
} {
  const z = zoom > 0 ? zoom : 1;
  const local = (b: Box): Box => ({
    left: (b.left - root.left) / z,
    top: (b.top - root.top) / z,
    width: b.width / z,
    height: b.height / z,
  });
  const inset = (b: Box) => {
    const top = (b.top - to.top) / z;
    const left = (b.left - to.left) / z;
    const right = (to.left + to.width - (b.left + b.width)) / z;
    const bottom = (to.top + to.height - (b.top + b.height)) / z;
    return `inset(${px(top)} ${px(right)} ${px(bottom)} ${px(left)} round ${px(radius)})`;
  };
  return {
    surface: [local(from), local(to)],
    clip: [inset(from), inset(to)],
    ride: (from.left - to.left) / z,
  };
}

const px = (n: number) => `${Math.round(n * 100) / 100 || 0}px`;
