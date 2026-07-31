// The animation vocabulary (spec/09): which looping animations exist for
// boxed elements, icon glyphs and progress fills, how fast they run, and
// whether a given one loops. Lifted out of index.ts, which had grown to
// 871 lines by accreting every vocabulary in the model side by side.
//
// A LEAF module: it imports nothing from the barrel, so it can be read at
// module-init time without a runtime cycle, the same reason './data-shapes'
// stands alone. Re-exported from index.ts, so every import path is
// unchanged.
//
// Arrow flow (ArrowFlow / ARROW_FLOWS) is deliberately NOT here: it is the
// arrows' own vocabulary and stays beside them.

// Looping element animation (spec/09 "Animated elements"). Applied to a boxed
// element as a CSS class; deterministic (no broadcast), reduced-motion-safe
// (the keyframes are disabled under prefers-reduced-motion), and freezes to a
// static frame on PNG / SVG export. 'pulse' is an attention ping (an
// expanding ring), 'blink' a status breathe (opacity), 'glow' a soft halo,
// 'trace' a light running the element's outline, 'gradient' a moving gradient
// blending the fill + accent colours, 'bounce' a vertical bob, 'wobble' a
// tilt wiggle, 'shake' a quick horizontal jitter, 'jelly' a squash-and-stretch,
// 'float' a slow circular drift, 'swing' a pendulum from the top edge. The
// emphasis set stays in place and draws the eye without travelling:
// 'heartbeat' is a lub-dub double-pump (uniform scale), 'breathe' a slow
// gentle swell, 'shimmer' an occasional quick brightness glint, 'highlight' a
// periodic dip-then-brighten of the fill (a luminous "look here" swell that
// reads on any colour). trace / gradient render against the true shape
// outline (an SVG stroke / fill for SVG-rendered shapes, the CSS border /
// background for CSS-rendered shapes + other boxed elements); shimmer /
// highlight are `filter`-based so they follow any silhouette with no SVG
// special case; bounce / wobble / shake / jelly / float / swing / heartbeat /
// breathe drive the independent `translate` / `rotate` / `scale` CSS
// properties so they compose with an element's own rotation rather than
// clobbering it (swing also pivots from `transform-origin: top center`).
export type ElementAnimation =
  | 'pulse'
  | 'blink'
  | 'glow'
  | 'trace'
  | 'gradient'
  | 'heartbeat'
  | 'breathe'
  | 'shimmer'
  | 'highlight'
  | 'bounce'
  | 'wobble'
  | 'shake'
  | 'jelly'
  | 'float'
  | 'swing';
export const ELEMENT_ANIMATIONS: readonly ElementAnimation[] = [
  'pulse',
  'blink',
  'glow',
  'trace',
  'gradient',
  'heartbeat',
  'breathe',
  'shimmer',
  'highlight',
  'bounce',
  'wobble',
  'shake',
  'jelly',
  'float',
  'swing',
];

// Animation / flow speed (spec/09). A multiplier on each animation's tuned
// base duration (so every animation keeps its own feel; speed just scales it):
// 'slowest' quadruples the duration, 'slow' doubles it, 'fast' halves it.
// Shared by boxed-element animations (`animationSpeed`), arrow flow
// (`flowSpeed`), icon animations, and the data-shape anims. 'slow' is the
// default when unset (animations should whisper, not shout); renderers read
// DEFAULT_ANIMATION_SPEED so the fallback can't drift per surface. The
// renderer feeds the factor to CSS via a custom property the keyframe
// classes multiply into their duration.
export type AnimationSpeed = 'slowest' | 'slow' | 'normal' | 'fast';
export const ANIMATION_SPEEDS: readonly AnimationSpeed[] = ['slowest', 'slow', 'normal', 'fast'];
export const ANIMATION_SPEED_FACTOR: Record<AnimationSpeed, number> = {
  slowest: 4,
  slow: 2,
  normal: 1,
  fast: 0.5,
};
export const DEFAULT_ANIMATION_SPEED: AnimationSpeed = 'slow';

// Looping animation for an `icon` shape's glyph (spec/09 "Animated icons").
// A separate, glyph-oriented set from the boxed-element ElementAnimation: any
// icon can opt into one of these via the icon context menu (they used to be
// hard-wired to a few icon ids and always-on). 'spin' rotates, 'beat' is the
// heart double-pump (scale), 'pulse' breathes opacity, 'bounce' bobs, 'wiggle'
// tilts, 'flash' blinks, 'tada' is a celebratory scale + rotate, 'flip' a coin
// flip (rotateY), 'jump' a squash-and-stretch hop, 'swing' a pendulum from the
// top, 'float' a slow circular drift. The emphasis set draws the eye without
// travelling: 'glow' breathes a soft halo hugging the glyph's silhouette,
// 'ping' emits an expanding fading ring off it, 'breathe' is a slow gentle
// swell (vs beat's quick double-pump), 'shimmer' an occasional quick
// brightness glint. Undefined = static. Mapped to a `lvd-icon-*` class; loop
// speed comes from the separate `iconAnimationSpeed` field, same as boxed
// elements.
export type IconAnimation =
  | 'spin'
  | 'beat'
  | 'pulse'
  | 'glow'
  | 'ping'
  | 'breathe'
  | 'shimmer'
  | 'bounce'
  | 'wiggle'
  | 'flash'
  | 'tada'
  | 'flip'
  | 'jump'
  | 'swing'
  | 'float';
export const ICON_ANIMATIONS: readonly IconAnimation[] = [
  'spin',
  'beat',
  'pulse',
  'glow',
  'ping',
  'breathe',
  'shimmer',
  'bounce',
  'wiggle',
  'flash',
  'tada',
  'flip',
  'jump',
  'swing',
  'float',
];

// Progress elements (spec/46): a horizontal bar + a donut ring that display a
// 0–100 `progress` value. `progressAnim` animates HOW the filled portion
// behaves: 'fill' repeatedly grows it from 0 to the value, 'pulse' breathes its
// opacity, 'stripes' runs a barber-pole / marching pattern over the fill.
// Undefined = a static fill. Mapped to `lvd-prog-*` classes by ProgressView.
export type ProgressAnim = 'fill' | 'pulse' | 'stripes';
export const PROGRESS_ANIMS: readonly ProgressAnim[] = ['fill', 'pulse', 'stripes'];
// Progress animations that loop by default: 'fill' fills in once and holds;
// 'pulse' / 'stripes' cycle forever (see animLoops).
export const PROGRESS_LOOPING_ANIMS: readonly ProgressAnim[] = ['pulse', 'stripes'];

// Whether an element's animation should loop. The explicit per-element `repeat`
// override wins; otherwise it loops only if it's one of `loopingAnims` (the
// rest play once and hold). Centralises the "does this anim loop by default"
// rule the progress / rating / pie renderers + their context-menu Repeat
// toggles all share, so adding a looping animation is a one-line change.
export function animLoops<T>(
  anim: T | null | undefined,
  repeat: boolean | undefined,
  loopingAnims: readonly T[],
): boolean {
  return repeat ?? (anim != null && loopingAnims.includes(anim));
}
