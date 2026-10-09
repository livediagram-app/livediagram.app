import { useMemo, type CSSProperties } from 'react';
import {
  ANIMATION_SPEED_FACTOR,
  DEFAULT_ANIMATION_SPEED,
  hasRichFormatting,
  isTextAnimation,
  type AnimationSpeed,
  type TextRun,
  type Element,
} from '@livediagram/document';
import { setAnimationClass } from '@/lib/animation-classes';
import { planTextAnimation, type TextAnimPlan } from './animated-words';

// The Text animation of a label (docs/specs/028-animation/element-animations.md "Text"): the class
// and variables its content node wears, and the plan its words split by. Undefined when the element
// has no Text animation, while its label is being edited, or when it has no words: the label then
// renders exactly as it always has.
export type TextAnimView = {
  className: string;
  style: CSSProperties;
  // The full text, as the content node's accessible name (its units are aria-hidden).
  ariaLabel: string;
  plan: TextAnimPlan;
};

// The accents a label without a stroke colour animates with: brand sky, and a marker's yellow.
const TEXT_ACCENT = '#0ea5e9';
const MARKER_YELLOW = '#facc15';

type Words = {
  id: string;
  textAnimation?: string;
  textAnimationSpeed?: AnimationSpeed;
  textAnimationRepeat?: boolean;
  strokeColor?: string;
};

export function textAnimationView(
  element: Element,
  texts: readonly string[],
  textColor: string,
  isEditing: boolean,
): TextAnimView | undefined {
  const words = element as Words;
  const value = words.textAnimation;
  if (isEditing || !isTextAnimation(value)) return undefined;
  const ariaLabel = texts.join('').trim();
  if (!ariaLabel) return undefined;
  const plan = planTextAnimation(texts, value, words.id);
  // Text plays once and stays revealed unless Repeat is on (docs/specs/028-animation/element-animations.md).
  const repeat = words.textAnimationRepeat === true;
  return {
    className: `lvd-tx ${setAnimationClass('text', plan.animation, repeat)}`,
    style: {
      ['--lvd-text-n' as string]: plan.count,
      ['--lvd-text-speed' as string]:
        ANIMATION_SPEED_FACTOR[words.textAnimationSpeed ?? DEFAULT_ANIMATION_SPEED],
      ...(repeat ? {} : { ['--lvd-text-iter' as string]: 1 }),
      ['--lvd-tx-color' as string]: textColor,
      // A label's own ink makes a muddy halo or marker; the stroke is a colour chosen to accent it.
      ['--lvd-anim-color' as string]: words.strokeColor ?? TEXT_ACCENT,
      ['--lvd-tx-mark' as string]: words.strokeColor ?? MARKER_YELLOW,
    },
    ariaLabel,
    plan,
  };
}

/** `textAnimationView`, memoised on what the split depends on. */
export function useTextAnimation(
  element: Element,
  texts: readonly string[],
  textColor: string,
  isEditing: boolean,
): TextAnimView | undefined {
  const words = element as Words;
  const key = texts.join('\u0000');
  return useMemo(
    () => textAnimationView(element, texts, textColor, isEditing),
    // The element object changes on every edit; only these fields shape the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      key,
      words.id,
      words.textAnimation,
      words.textAnimationSpeed,
      words.textAnimationRepeat,
      words.strokeColor,
      textColor,
      isEditing,
    ],
  );
}

/**
 * The Text animation of a boxed element's label: split by the runs a rich label renders, so the
 * unit index runs through the whole label, else by the plain label.
 */
export function useLabelTextAnimation(
  element: Element,
  label: string,
  textColor: string,
  isEditing: boolean,
): TextAnimView | undefined {
  const runs = (element as { richText?: TextRun[] }).richText;
  const texts = useMemo(
    () => (hasRichFormatting(runs) ? runs!.map((r) => r.text) : [label]),
    [runs, label],
  );
  return useTextAnimation(element, texts, textColor, isEditing);
}
