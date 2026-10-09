// Class names for the animation sets (docs/specs/028-animation/element-animations.md). Each set's
// keyframes live in its own stylesheet (app/motion-<set>.css) under its own prefix, so a value that
// two sets share (a sticky's Pulse, a Text Glow) can never pick up the wrong set's rule.

import {
  bodyAnimationSetOf,
  isAnimationInSet,
  isRevealAnimation,
  type AnimationSetId,
  type BodyAnimationSet,
  type BoxedElement,
} from '@livediagram/document';

export const ANIMATION_CLASS_PREFIX: Readonly<Record<AnimationSetId, string>> = {
  shape: 'lvd-anim-',
  text: 'lvd-tx-',
  sticky: 'lvd-note-',
  drawing: 'lvd-draw-',
  media: 'lvd-media-',
  table: 'lvd-tbl-',
};

// The Sticky and Table values drawn by the Shape set's classes on the wrapper
// (useBoxedElementAnimation's wrapperShapeAnimation): a note and a table are rectangles.
const DRAWN_AS_SHAPE: Partial<Record<BodyAnimationSet, ReadonlySet<string>>> = {
  sticky: new Set(['pulse', 'glow', 'highlight']),
  table: new Set(['pulse', 'glow']),
};

/** The marker a reveal carries when Repeat is off: its keyframes play once and stay revealed. */
export const ONCE_CLASS = 'lvd-once';

/** A set class, plus the play-once marker for a reveal that does not repeat. */
export function setAnimationClass(
  set: AnimationSetId,
  value: string,
  repeat: boolean | undefined,
): string {
  const once = repeat === false && isRevealAnimation(set, value);
  return `${ANIMATION_CLASS_PREFIX[set]}${value}${once ? ` ${ONCE_CLASS}` : ''}`;
}

/**
 * The class the element's own face mounts for a Sticky, Drawing, Media or Table animation, or
 * undefined when the Shape set's classes draw it (or there is none).
 */
export function bodySetClass(el: BoxedElement, only?: BodyAnimationSet): string | undefined {
  const set = bodyAnimationSetOf(el);
  const value = el.animation;
  if (!set || set === 'shape' || !value || (only && set !== only)) return undefined;
  if (!isAnimationInSet(set, value) || DRAWN_AS_SHAPE[set]?.has(value)) return undefined;
  return setAnimationClass(set, value, el.animationRepeat);
}
