// Which animation sets an element takes (docs/specs/028-animation/element-animations.md "Animation
// sets"): the body set that animates the element itself, and whether it carries words for the
// Text set. The menu offers one category per set present in a selection, in a fixed order.

import {
  SHAPE_ANIMATIONS,
  SHAPE_MOTIONS,
  type AnimationSetId,
  type BodyAnimationSet,
  type ShapeAnimation,
} from './animation-sets';
import { takesTypedLabel } from './element-types';
import type { Element } from './index';
import { selfLabelled } from './svg-render-describe';

// Shapes with a set of their own (the Icon), owned outside these catalogues.
function hasOwnShapeSet(el: Element): boolean {
  return el.type === 'shape' && el.shape === 'icon';
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
      return 'media';
    case 'shape':
      return hasOwnShapeSet(el) ? undefined : 'shape';
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
    case 'path':
    case 'image':
      return true;
    case 'shape':
      return false;
    default:
      return false;
  }
}

/** The Shape values a Shape category offers the element: the whole set, the motions, or none. */
export function shapeAnimationsFor(el: Element): readonly ShapeAnimation[] {
  if (bodyAnimationSetOf(el) === 'shape') return SHAPE_ANIMATIONS;
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
    // A chart, progress bar or rating has no body set of its own: an older Shape value on it plays as it did, so its
    // Shape section shows it as the kept tile.
    if (body === undefined) return 'shape';
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
  'corridor',
  'meeting-table',
  'plant',
  'bookshelf',
  'water-cooler',
  'coffee-machine',
  'rug',
  'office-pod',
  'bar',
  'bar-stool',
  'drinks-cabinet',
  'drinks-fridge',
  'outdoor-plant',
  'tree',
  'garden-path',
  'grass',
  'garden-fence',
  // The social pieces (docs/specs/009-elements/social-pieces.md).
  'notice-board',
  'world-clock',
  'jukebox',
  'ping-pong-table',
  'arcade-machine',
  'fireplace',
  'campfire',
  'bench',
  'picnic-table',
  'hammock',
  'garden-umbrella',
  'fountain',
  'pond',
  'pool-table',
  'foosball-table',
  'dartboard',
  'vending-machine',
  'bean-bag',
  'reading-nook',
  'printer',
  'copier',
  'lockers',
  'coat-rack',
  'umbrella-stand',
  'kitchen-counter',
  'kitchen-sink',
  'fridge',
  'microwave',
  'kettle',
  'toilet-cubicle',
  'washbasin',
  'hand-dryer',
  'pillar',
  'column',
  'car-park',
  'bike-rack',
  'swimming-pool',
  'stage-curtains',
  'podium',
  // The workday pieces (docs/specs/009-elements/workday-pieces.md).
  'nap-pod',
  'treadmill',
  'weight-bench',
  'phone-booth',
  'standing-desk',
  'hot-desk',
  'pet-bed',
  'reception-desk',
  // The team pieces (docs/specs/009-elements/team-pieces.md).
  'calendar-wall',
  'suggestion-box',
  'signpost',
  'photo-wall',
  'door',
  'window',
  'directory',
  'elevator',
  'stairs',
  'screen',
  'room-sign',
  // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md).
  'timer',
  'stopwatch',
]);

/** Whether the element carries words the Text set can animate. */
export function carriesWords(el: Element): boolean {
  if (el.type === 'text' || el.type === 'sticky') return true;
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

const SET_ORDER: readonly AnimationSetId[] = ['shape', 'sticky', 'drawing', 'media', 'text'];

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
