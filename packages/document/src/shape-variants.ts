// Creation-time variants (docs/specs/009-elements/card.md "The Callout is a Card preset",
// docs/specs/009-elements/concept-graphics.md "Palette"): one shape kind placed as a particular variant, because the
// palette offers a tile per variant ("the variant is the decision"). The tile's `variant` rides the draw intent and is
// applied here to the factory's fresh element, so every placement path (tap, drag, drop, an article's Insert) lands
// the same thing.
//
// A LEAF module: types only from './index'.

import type { ShapeElement } from './index';
import { BADGE_NEW_LABEL, isChipLook, type ChipLook } from './chip';

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
  // A wireframe part's greys are the part (a dark button, a grey picture): put back over the theme's.
  if (variant && Object.hasOwn(WIREFRAME_PARTS, variant)) {
    const { fillColor, strokeColor, textColor, strokeWidth } = WIREFRAME_PARTS[variant]!.part;
    const {
      strokeSwatch: _s,
      fillSwatch: _f,
      colorPreset: _p,
      ...rest
    } = el as T & { strokeSwatch?: number; fillSwatch?: number; colorPreset?: string };
    return {
      ...rest,
      ...(fillColor ? { fillColor } : {}),
      ...(strokeColor ? { strokeColor } : {}),
      ...(textColor ? { textColor } : {}),
      ...(strokeWidth ? { strokeWidth } : {}),
    } as T;
  }
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

// The Wireframe palette's parts (docs/specs/007-editor/wireframe-pages.md "The Wireframe palette"):
// one shape placed as a screen's part, at a real interface's size, in wireframe greys (their
// colours are the part, so placing keeps them, withVariantColours).
const WF_INK = '#0f172a';
const WF_LINE = '#cbd5e1';
const WF_MUTED = '#64748b';
const WF_PLACE = '#e2e8f0';
const WIREFRAME_PARTS: Record<
  string,
  { shape: ShapeElement['shape']; part: Partial<ShapeElement> }
> = {
  'wf-button': {
    shape: 'square',
    part: {
      width: 160,
      height: 48,
      label: 'Button',
      textSize: 16,
      textBold: true,
      borderRadius: 'md',
      fillColor: WF_INK,
      textColor: '#ffffff',
      strokeWidth: 'none',
    },
  },
  'wf-button-outline': {
    shape: 'square',
    part: {
      width: 160,
      height: 48,
      label: 'Button',
      textSize: 16,
      textBold: true,
      borderRadius: 'md',
      fillColor: '#ffffff',
      textColor: WF_INK,
      strokeColor: WF_LINE,
      strokeWidth: 'thin',
    },
  },
  'wf-field': {
    shape: 'square',
    part: {
      width: 320,
      height: 48,
      label: 'Placeholder',
      textSize: 15,
      textAlignX: 'left',
      padding: 'md',
      borderRadius: 'md',
      fillColor: '#ffffff',
      textColor: WF_MUTED,
      strokeColor: WF_LINE,
      strokeWidth: 'thin',
    },
  },
  'wf-search': {
    shape: 'square',
    part: {
      width: 320,
      height: 44,
      label: 'Search',
      iconId: 'search',
      textSize: 15,
      textAlignX: 'left',
      padding: 'md',
      borderRadius: 'full',
      fillColor: '#f1f5f9',
      textColor: WF_MUTED,
      strokeWidth: 'none',
    },
  },
  'wf-image': {
    shape: 'square',
    part: {
      width: 320,
      height: 200,
      label: 'Image',
      iconId: 'image',
      textSize: 15,
      borderRadius: 'lg',
      fillColor: WF_PLACE,
      textColor: WF_MUTED,
      strokeWidth: 'none',
    },
  },
  'wf-avatar': {
    shape: 'circle',
    part: {
      width: 56,
      height: 56,
      label: 'AB',
      textSize: 18,
      textBold: true,
      fillColor: WF_PLACE,
      textColor: WF_MUTED,
      strokeWidth: 'none',
    },
  },
  'wf-chip': {
    shape: 'square',
    part: {
      width: 96,
      height: 34,
      label: 'Chip',
      textSize: 14,
      borderRadius: 'full',
      fillColor: '#ffffff',
      textColor: '#334155',
      strokeColor: WF_LINE,
      strokeWidth: 'thin',
    },
  },
  'wf-divider': {
    shape: 'square',
    part: {
      width: 320,
      height: 1,
      label: '',
      borderRadius: 'none',
      fillColor: WF_LINE,
      strokeWidth: 'none',
    },
  },
};

/** The Wireframe palette's variants, in palette order. */
export const WIREFRAME_PART_VARIANTS = Object.keys(WIREFRAME_PARTS);

/** The badge presets' variants, in palette order after the New preset (no variant). */
export const BADGE_PRESET_VARIANTS = ['beta', 'version', 'count', 'draft', 'warning'] as const;

/** The card presets' variants, in palette order after the Service preset (no variant). */
export const CARD_PRESET_VARIANTS = ['compact', 'panel', 'person', 'accent', 'callout'] as const;

/** `el` placed as `variant`, or `el` itself when the kind has no such variant. */
export function applyShapeVariant(el: ShapeElement, variant: string | undefined): ShapeElement {
  if (!variant) return el;
  const part = Object.hasOwn(WIREFRAME_PARTS, variant) ? WIREFRAME_PARTS[variant]! : undefined;
  if (part && el.shape === part.shape) return { ...el, ...part.part };
  if (el.shape === 'card' && variant === 'callout') return calloutCard(el);
  if (el.shape === 'card') {
    const preset = cardPreset(el, variant);
    if (preset) return preset;
  }
  // The org chart (docs/specs/009-elements/org-chart.md): a person root in the Downward flow.
  if (el.shape === 'mind-node' && variant === 'org-chart')
    return {
      ...el,
      width: 220,
      height: 64,
      mindLook: 'person',
      mindFlow: 'downward',
      label: 'Ana Kim',
      pageSubtitle: 'Head of Engineering',
      textAlignX: 'left',
    };
  if (el.shape === 'badge' && Object.hasOwn(BADGE_PRESETS, variant))
    return { ...el, ...BADGE_PRESETS[variant] };
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
