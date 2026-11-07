// Creation-time variants (docs/specs/009-elements/card.md "The Callout is a Card preset",
// docs/specs/009-elements/timeline.md "Palette"): one shape kind placed as a particular variant, because the
// palette offers a tile per variant ("the variant is the decision"). The tile's `variant` rides the draw intent and is
// applied here to the factory's fresh element, so every placement path (tap, drag, drop, an article's Insert) lands
// the same thing.
//
// A LEAF module: types only from './index', and the leaf tables of the presets (piece-variants, room-preset-shapes).

import type { ShapeElement } from './index';
import { BADGE_NEW_LABEL, isChipLook, type ChipLook } from './chip';
import { PIECE_VARIANT_SIZES, storesVariant, variantsOf } from './piece-variants';
import { roomAsPreset, roomPreset } from './room-preset-shapes';

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

// The badge presets (docs/specs/009-elements/badge.md "Badge presets"): a text and a look; the badge fits its text as
// it settles.
const BADGE_PRESETS: Record<string, Partial<ShapeElement>> = {
  beta: { label: 'Beta', chipLook: 'tinted' },
  version: { label: 'v2.1', chipLook: 'outline' },
  count: { label: '3×', chipLook: 'ink' },
  draft: { label: 'Draft', chipLook: 'quiet' },
  warning: { label: 'PII', chipLook: 'solid', strokeColor: '#e11d48' },
};

/** What a badge preset looks like as it lands (its text, look and own colour, if any): the palette draws its tile
 *  from this, so the tile is the badge. No variant is the New preset, a fresh badge. */
export function badgePresetFace(variant: string | undefined): {
  label: string;
  look: ChipLook;
  accent?: string;
} {
  const preset = variant && Object.hasOwn(BADGE_PRESETS, variant) ? BADGE_PRESETS[variant]! : {};
  return {
    label: preset.label ?? BADGE_NEW_LABEL,
    look: isChipLook(preset.chipLook) ? preset.chipLook : 'solid',
    ...(preset.strokeColor ? { accent: preset.strokeColor } : {}),
  };
}

/** `el` with the colours its variant fixes put back, the last step of placing it: the Warning badge's rose. Placing
 *  dresses a new element in the tab's theme and then in the style remembered for its kind, and either would paint
 *  over a preset's own colour, which is what the preset is (docs/specs/009-elements/badge.md "Badge presets"). A
 *  variant that fixes no colour leaves `el` as it is. */
export function withVariantColours<T extends ShapeElement>(el: T, variant: string | undefined): T {
  if (el.shape !== 'badge' || !variant || !Object.hasOwn(BADGE_PRESETS, variant)) return el;
  const { strokeColor } = BADGE_PRESETS[variant]!;
  if (!strokeColor || el.strokeColor === strokeColor) return el;
  // The colour is the preset's, not a swatch's or a colour preset's: no binding re-derives it on a theme change.
  const {
    strokeSwatch: _s,
    colorPreset: _p,
    ...rest
  } = el as T & {
    strokeSwatch?: number;
    colorPreset?: string;
  };
  return { ...rest, strokeColor } as T;
}

/** The Restroom room preset's variant (docs/specs/009-elements/office-amenities.md "The Restroom preset"): the Room
 *  is named Restroom, and its pieces come with it (room-presets.ts). */
export const RESTROOM_VARIANT = 'restroom';

/** The badge presets' variants, in palette order after the New preset (no variant). */
export const BADGE_PRESET_VARIANTS = ['beta', 'version', 'count', 'draft', 'warning'] as const;

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
  if (el.shape === 'badge' && Object.hasOwn(BADGE_PRESETS, variant))
    return { ...el, ...BADGE_PRESETS[variant] };
  if (el.shape === 'room' && variant === RESTROOM_VARIANT) return { ...el, label: 'Restroom' };
  // The Room tile's presets (docs/specs/009-elements/office.md "Room presets"): a size, a name, a shaped one's walls.
  const preset = el.shape === 'room' ? roomPreset(variant) : null;
  if (preset) return roomAsPreset(el, preset);
  // A Door's, Rug's or Corridor's type (room-builder.md "Door types", office.md "Rug types", corridor.md): stored,
  // because its drawing reads it, with the type's size.
  if (storesVariant(el.shape) && variantsOf(el.shape).includes(variant)) {
    const size = PIECE_VARIANT_SIZES[el.shape]?.[variant];
    const typed: ShapeElement = { ...el, variant, ...size };
    // A Long Table is drawn to its width, so it takes any (office.md "Long Table").
    if (el.shape === 'meeting-table' && variant === 'long') {
      const { aspectLocked: _held, ...long } = typed;
      return long;
    }
    if (el.shape !== 'rug') return typed;
    // A Round rug stays a circle; the other patterned rugs are drawn to their box, so they take any.
    if (variant === 'round') return { ...typed, aspectLocked: true };
    const { aspectLocked: _locked, ...free } = typed;
    return free;
  }
  return el;
}
