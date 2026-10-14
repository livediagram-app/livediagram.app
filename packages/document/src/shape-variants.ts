// Creation-time variants (docs/specs/009-elements/card.md "The Callout is a Card preset",
// docs/specs/009-elements/concept-graphics.md "Palette"): one shape kind placed as a particular variant, because the
// palette offers a tile per variant ("the variant is the decision"). The tile's `variant` rides the draw intent and is
// applied here to the factory's fresh element, so every placement path (tap, drag, drop, an article's Insert) lands
// the same thing.
//
// A LEAF module: types only from './index'.

import type { ShapeElement } from './index';

/** The Callout: a card with badge media, the callout's old size and copy, and no meta line, tags or icon. */
function calloutCard(el: ShapeElement): ShapeElement {
  const { pageSubtitle: _meta, tags: _tags, iconId: _icon, ...rest } = el;
  return {
    ...rest,
    width: 380,
    height: 116,
    cardMedia: 'badge',
    pageTitle: 'Heads up',
    label: 'A short note with some supporting detail.',
  };
}

/** `el` placed as `variant`, or `el` itself when the kind has no such variant. */
export function applyShapeVariant(el: ShapeElement, variant: string | undefined): ShapeElement {
  if (!variant) return el;
  if (el.shape === 'card' && variant === 'callout') return calloutCard(el);
  // The pyramid's variants (docs/specs/009-elements/concept-graphics.md): a Funnel starts from a conversion story.
  if (el.shape === 'pyramid' && variant === 'funnel')
    return {
      ...el,
      width: 340,
      pyramidVariant: 'funnel',
      conceptRows: [
        { label: 'Visited', note: '12,400' },
        { label: 'Signed up', note: '3,100' },
        { label: 'Activated', note: '820' },
        { label: 'Retained', note: '210' },
      ],
    };
  if (el.shape === 'pyramid' && variant === 'inverted')
    return { ...el, pyramidVariant: 'inverted' };
  return el;
}
