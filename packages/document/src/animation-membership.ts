// Which animation sets an element takes (docs/specs/028-animation/element-animations.md "Animation
// sets"): the body set that animates the element itself, and whether it carries words for the
// Text set. The menu offers one category per set present in a selection, in a fixed order.

import type { AnimationSetId, BodyAnimationSet } from './animation-sets';
import { isChartShape, isProgressShape, isRatingShape } from './data-shapes';
import { takesTypedLabel } from './element-types';
import type { Element } from './index';
import { selfLabelled } from './svg-render-describe';

// Shapes with a set of their own (Icon, Chart, Progress, Rating), owned outside these catalogues.
function hasOwnShapeSet(el: Element): boolean {
  return (
    el.type === 'shape' &&
    (el.shape === 'icon' ||
      isChartShape(el.shape) ||
      isProgressShape(el.shape) ||
      isRatingShape(el.shape))
  );
}

/** The body set that animates the element itself, or undefined when it takes none of these. */
export function bodyAnimationSetOf(el: Element): BodyAnimationSet | undefined {
  switch (el.type) {
    case 'sticky':
      return 'sticky';
    case 'freehand':
    case 'path':
      return 'drawing';
    case 'image':
    case 'video':
      return 'media';
    case 'table':
      return 'table';
    case 'shape':
      return hasOwnShapeSet(el) ? undefined : 'shape';
    case 'annotation':
    case 'link-card':
      return 'shape';
    default:
      return undefined;
  }
}

// Shapes that keep their words still: their caption is part of the art or drawn by the shape.
const WORDLESS_SHAPES = new Set<string>(['icon', 'chair', 'sticker']);

/** Whether the element carries words the Text set can animate. */
export function carriesWords(el: Element): boolean {
  if (el.type === 'text' || el.type === 'sticky' || el.type === 'table') return true;
  if (el.type !== 'shape') return false;
  return (
    takesTypedLabel(el) &&
    !selfLabelled(el) &&
    !hasOwnShapeSet(el) &&
    !WORDLESS_SHAPES.has(el.shape)
  );
}

/** Whether a category for `set` acts on this element. */
export function inAnimationSet(set: AnimationSetId, el: Element): boolean {
  return set === 'text' ? carriesWords(el) : bodyAnimationSetOf(el) === set;
}

const SET_ORDER: readonly AnimationSetId[] = [
  'shape',
  'sticky',
  'drawing',
  'media',
  'table',
  'text',
];

/** The sets present among the elements, in menu order, each once. */
export function animationSetsOf(elements: readonly Element[]): AnimationSetId[] {
  const present = new Set<AnimationSetId>();
  for (const el of elements) {
    const body = bodyAnimationSetOf(el);
    if (body) present.add(body);
    if (carriesWords(el)) present.add('text');
  }
  return SET_ORDER.filter((s) => present.has(s));
}
