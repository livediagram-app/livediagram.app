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

// The card presets (docs/specs/009-elements/card.md "Card presets"): each starts from the card's own starting copy
// (the Service preset) and switches slots off or on. Every one stays an ordinary card.
function cardPreset(el: ShapeElement, variant: string): ShapeElement | null {
  const { pageSubtitle: _meta, tags: _tags, iconId: _icon, ...bare } = el;
  switch (variant) {
    case 'compact': {
      const { tags: _t, ...rest } = el;
      return { ...rest, width: 240, height: 64, label: '', textAlignY: 'middle' };
    }
    case 'panel': {
      const { tags: _t, ...rest } = el;
      return {
        ...rest,
        width: 280,
        height: 150,
        cardHeader: true,
        cardMedia: 'badge',
        iconId: 'server',
        pageTitle: 'Orders service',
        pageSubtitle: 'Go',
        label: 'Owns the order lifecycle and emits OrderPlaced events.',
      };
    }
    case 'person':
      return {
        ...bare,
        width: 280,
        height: 140,
        cardMedia: 'initial',
        pageTitle: 'Maya Chen',
        pageSubtitle: 'Product designer',
        label: 'Plans the week on Sunday evenings.',
        tags: ['Persona'],
      };
    case 'accent': {
      const { cardMedia: _m, ...rest } = bare;
      return {
        ...rest,
        width: 260,
        height: 110,
        accentEdge: 'left',
        pageTitle: 'Checkout',
        label: 'Takes the basket to a paid order in three steps.',
      };
    }
    default:
      return null;
  }
}

/** The card presets' variants, in palette order after the Service preset (no variant). */
export const CARD_PRESET_VARIANTS = ['compact', 'panel', 'person', 'accent', 'callout'] as const;

/** `el` placed as `variant`, or `el` itself when the kind has no such variant. */
export function applyShapeVariant(el: ShapeElement, variant: string | undefined): ShapeElement {
  if (!variant) return el;
  if (el.shape === 'card' && variant === 'callout') return calloutCard(el);
  if (el.shape === 'card') {
    const preset = cardPreset(el, variant);
    if (preset) return preset;
  }
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
