// Writing an animation set's fields (docs/specs/028-animation/element-animations.md "The menu"):
// a category acts on every member of its set in the selection and on nothing else, so each write
// returns a non-member unchanged (the same reference, so nothing re-renders for it).
//
// Body sets write `animation` / `animationSpeed` / `animationRepeat`; the Text set writes the
// `textAnimation*` trio. A text element's old `animation` is legacy: a Text pick for it clears
// that trio, so a text element never carries both.

import {
  inAnimationSet,
  isAnimationInSet,
  type AnimationSetId,
  type AnimationSpeed,
  type Element,
} from '@livediagram/document';

type Fields = { value: string; speed: string; repeat: string };

const BODY: Fields = { value: 'animation', speed: 'animationSpeed', repeat: 'animationRepeat' };
const TEXT: Fields = {
  value: 'textAnimation',
  speed: 'textAnimationSpeed',
  repeat: 'textAnimationRepeat',
};

const fieldsOf = (set: AnimationSetId) => (set === 'text' ? TEXT : BODY);

// A text element still playing its legacy body animation (no Text animation yet): its Text
// section shows that animation, so its Speed and Repeat are the body fields it plays by.
const playsLegacy = (el: Element) =>
  el.type === 'text' &&
  !(el as { textAnimation?: string }).textAnimation &&
  !!(el as { animation?: string }).animation;
const fieldsFor = (set: AnimationSetId, el: Element) =>
  set === 'text' && playsLegacy(el) ? BODY : fieldsOf(set);

function patch(el: Element, entries: Record<string, unknown>): Element {
  const next: Record<string, unknown> = { ...el };
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined) delete next[k];
    else next[k] = v;
  }
  return next as Element;
}

/** Sets (or, with null, clears) the set's animation on a member; others are returned as they are. */
export function withSetAnimation(el: Element, set: AnimationSetId, value: string | null): Element {
  if (!inAnimationSet(set, el)) return el;
  // A value the set does not offer (a kept tile's old value) is already what the element plays:
  // writing it would store an invalid value and drop the one that is playing.
  if (value !== null && !isAnimationInSet(set, value)) return el;
  const f = fieldsOf(set);
  const legacy =
    set === 'text' && el.type === 'text'
      ? { animation: undefined, animationSpeed: undefined, animationRepeat: undefined }
      : {};
  return patch(el, { [f.value]: value ?? undefined, ...legacy });
}

export function withSetAnimationSpeed(
  el: Element,
  set: AnimationSetId,
  speed: AnimationSpeed,
): Element {
  return inAnimationSet(set, el) ? patch(el, { [fieldsFor(set, el).speed]: speed }) : el;
}

/**
 * Repeat is stored only when it differs from the set's default: body animations loop by default
 * (stored only when off); Text animations play once by default (stored only when on).
 */
export function withSetAnimationRepeat(el: Element, set: AnimationSetId, repeat: boolean): Element {
  if (!inAnimationSet(set, el)) return el;
  const f = fieldsFor(set, el);
  const stored = f === TEXT ? (repeat ? true : undefined) : repeat ? undefined : false;
  return patch(el, { [f.repeat]: stored });
}

/** Whether a stored Repeat field means the animation loops, by the set's default. */
export function setRepeats(set: AnimationSetId, stored: unknown): boolean {
  return set === 'text' ? stored === true : stored !== false;
}

/** Clear animation (the command palette): the body and the Text animation together. */
export function withoutAnimations(el: Element): Element {
  if (!('animation' in el) && !('textAnimation' in el)) return el;
  return patch(el, { animation: undefined, textAnimation: undefined });
}

/** What a category reads: the first member's value, Speed and Repeat. */
export function setAnimationState(
  elements: readonly Element[],
  set: AnimationSetId,
): { value: string | null; speed: AnimationSpeed | undefined; repeat: boolean } | undefined {
  const first = elements.find((el) => inAnimationSet(set, el));
  if (!first) return undefined;
  const f = fieldsFor(set, first);
  const rec = first as unknown as Record<string, unknown>;
  // A text element's legacy body value shows in its Text category, as the kept tile.
  const value =
    (rec[f.value] as string | undefined) ??
    (set === 'text' && first.type === 'text' ? (rec.animation as string | undefined) : undefined);
  return {
    value: value ?? null,
    speed: rec[f.speed] as AnimationSpeed | undefined,
    repeat: f === TEXT ? setRepeats('text', rec[f.repeat]) : setRepeats('shape', rec[f.repeat]),
  };
}
