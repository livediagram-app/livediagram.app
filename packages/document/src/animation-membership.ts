// Which animation sets an element takes (docs/specs/028-animation/element-animations.md "Animation
// sets"): the body set that animates the element itself, and whether it carries words for the
// Text set. The menu offers one category per set present in a selection, in a fixed order.

import {
  CONTAINER_ANIMATIONS,
  SHAPE_ANIMATIONS,
  SHAPE_MOTIONS,
  type AnimationSetId,
  type BodyAnimationSet,
  type ShapeAnimation,
} from './animation-sets';
import { isChartShape, isProgressShape, isRatingShape } from './data-shapes';
import { isSankeyShape } from './sankey-model';
import { isConceptShape } from './concept';
import { takesTypedLabel } from './element-types';
import type { Element } from './index';
import { selfLabelled } from './svg-render-describe';

// Shapes with a set of their own (Icon, Chart, Sankey, Progress, Rating), owned outside these catalogues.
function hasOwnShapeSet(el: Element): boolean {
  return (
    el.type === 'shape' &&
    (el.shape === 'icon' ||
      isChartShape(el.shape) ||
      isSankeyShape(el.shape) ||
      isProgressShape(el.shape) ||
      isRatingShape(el.shape))
  );
}

// Shapes whose rows are what moves, not the box (Concept, Sequence), so they take their own set instead of Shape. One
// that carries words of its own beyond its rows (a layer stack, pyramid, onion or chevrons) takes the Text set too; a
// self-labelled one (sequence, cycle, hub) does not. A Shape `animation` stored on one before it had its own set plays
// only when it is a motion (takesShapeMotions): the menu has no tile for the rest to change or clear it.
export function hasOwnBodySet(el: Element): boolean {
  return el.type === 'shape' && (isConceptShape(el.shape) || el.shape === 'sequence');
}

/** The body set that animates the element itself, or undefined when it takes none of these. */
export function bodyAnimationSetOf(el: Element): BodyAnimationSet | undefined {
  switch (el.type) {
    case 'sticky':
      return 'sticky';
    case 'freehand':
      return 'drawing';
    case 'image':
    case 'video':
      return 'media';
    case 'table':
      return 'table';
    case 'shape':
      return hasOwnShapeSet(el) || hasOwnBodySet(el) ? undefined : 'shape';
    case 'annotation':
    case 'link-card':
      return 'shape';
    default:
      return undefined;
  }
}

/**
 * Whether the element takes the Shape set's motions beside a set of its own (docs/specs/028-animation/element-animations.md
 * "Shape motions"): every element whose own set animates inside it. Icons and text elements do not: the Icon and Text
 * sets already bounce, float and swing them.
 */
export function takesShapeMotions(el: Element): boolean {
  switch (el.type) {
    case 'sticky':
    case 'freehand':
    case 'image':
    case 'video':
    case 'table':
      return true;
    case 'shape':
      return el.shape !== 'icon' && (hasOwnShapeSet(el) || hasOwnBodySet(el));
    default:
      return false;
  }
}

/** The Shape values a Shape category offers the element: the whole set, a boundary's six, the motions, or none. */
export function shapeAnimationsFor(el: Element): readonly ShapeAnimation[] {
  if (bodyAnimationSetOf(el) === 'shape') {
    return el.type === 'shape' && el.shape === 'boundary' ? CONTAINER_ANIMATIONS : SHAPE_ANIMATIONS;
  }
  return takesShapeMotions(el) ? SHAPE_MOTIONS : [];
}

/**
 * The body category that shows the element's stored `animation` value: Shape for a motion on an element that takes
 * the motions beside its own set, else the element's own body set (which shows a value it does not offer as its kept
 * tile; a chart's older Shape value, kept, in its Shape section). Undefined when no body category shows it.
 */
export function animationSectionOf(
  el: Element,
  value: string | null | undefined,
): BodyAnimationSet | undefined {
  const body = bodyAnimationSetOf(el);
  if (value != null && takesShapeMotions(el)) {
    if ((SHAPE_MOTIONS as readonly string[]).includes(value)) return 'shape';
    // A chart, Sankey, progress bar or rating has no body set of its own: an older Shape value on it plays as it did,
    // so its Shape section shows it as the kept tile. A concept graphic or sequence does not play one (hasOwnBodySet).
    if (body === undefined && !hasOwnBodySet(el)) return 'shape';
  }
  return body;
}

// Shapes that keep their words still: their caption is part of the art or drawn by the shape.
const WORDLESS_SHAPES = new Set<string>([
  'icon',
  'chair',
  'desk',
  'sofa',
  'fence',
  'avatar-pad',
  'sticker',
  // The office pieces (docs/specs/009-elements/office.md) but the room, whose label is its name plate.
  'meeting-table',
  'plant',
  'bookshelf',
  'water-cooler',
  'coffee-machine',
  'rug',
]);

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
  if (set === 'text') return carriesWords(el);
  return bodyAnimationSetOf(el) === set || (set === 'shape' && takesShapeMotions(el));
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
    if (takesShapeMotions(el)) present.add('shape');
    if (carriesWords(el)) present.add('text');
  }
  return SET_ORDER.filter((s) => present.has(s));
}
