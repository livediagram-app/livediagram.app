// The animation vocabulary (docs/specs/008-canvas/canvas-and-palette.md): which looping animations exist for
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

// The body animation sets and the Text set live in './animation-sets'
// (docs/specs/028-animation/element-animations.md); re-exported here so every import path keeps working.
export * from './animation-sets';

// Animation / flow speed (docs/specs/008-canvas/canvas-and-palette.md): one copy for every product, in
// @liveworkspace/model-core/animation, so the shared element types and this document name the same type.
export {
  ANIMATION_SPEEDS,
  ANIMATION_SPEED_FACTOR,
  DEFAULT_ANIMATION_SPEED,
  type AnimationSpeed,
} from '@liveworkspace/model-core/animation';

// Looping animation for an `icon` shape's glyph (docs/specs/008-canvas/canvas-and-palette.md "Animated icons").
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

// The catalogue's four ANIMATED icons (docs/specs/008-canvas/canvas-and-palette.md) arrive moving.
//
// They are drawn to move: a spinner that does not spin is an arc with a gap, a
// heartbeat that does not beat is a heart. Every other glyph is static until
// you pick an animation; these four start on the one they were drawn for, and
// the icon menu can change or clear it like any other.
export const DEFAULT_ICON_ANIMATION: Readonly<Record<string, IconAnimation>> = {
  spinner: 'spin',
  gear: 'spin',
  heartbeat: 'beat',
  // A broadcast arc, so the ring that travels off it rather than a scale.
  signal: 'ping',
};

/** The animation an icon starts with, if it is one of the animated four. */
export function defaultIconAnimation(iconId: string | undefined): IconAnimation | undefined {
  return iconId ? DEFAULT_ICON_ANIMATION[iconId] : undefined;
}

// Progress elements (docs/specs/009-elements/progress.md): a horizontal bar + a donut ring that display a
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
