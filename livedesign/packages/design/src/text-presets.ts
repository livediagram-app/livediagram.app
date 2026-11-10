// Write's text styles (docs/specs/008-canvas/canvas-and-palette.md "Text element", "Text styles"): the kinds of text
// a screen or a mark is set in, each a plain text element with its fields set as the style says. Nothing marks an
// element as a style afterwards: it is where the text starts, and the Text menu's Text Style restyles it (or any
// text). The sizes are a screen's, not a printed page's: every one sits on the Size slider (6 to 48 px), so a style
// stores no scale and the slider reads it exactly. The shared half (how a style becomes a text's fields, a restyle,
// reading a style back) is @liveworkspace/element-model/text-presets.
import {
  presetTextFields,
  restyleText,
  textPresetOf,
  type TextPreset as SharedTextPreset,
} from '@liveworkspace/element-model/text-presets';
import { createText } from './factories';
import type { Element, TextElement } from './index';

export { NEW_TEXT_ALIGN } from '@liveworkspace/element-model/text-presets';

// In the palette's order: the largest first, then body text, then the small print.
export const TEXT_PRESET_IDS = [
  'title',
  'subtitle',
  'heading',
  'subheading',
  'paragraph',
  'quote',
  'caption',
] as const;
export type TextPresetId = (typeof TEXT_PRESET_IDS)[number];

export type TextPreset = SharedTextPreset<TextPresetId>;

// Body text wraps at a phone screen's column (390 wide, less its margins), so a Paragraph dropped on any device
// reads as a block, and a drag sets a wider one.
export const TEXT_STYLE_WRAP_WIDTH = 320;

export const TEXT_PRESETS: Readonly<Record<TextPresetId, TextPreset>> = {
  title: { id: 'title', name: 'Title', px: 40, bold: true },
  subtitle: { id: 'subtitle', name: 'Subtitle', px: 24 },
  heading: { id: 'heading', name: 'Heading', px: 32, bold: true },
  subheading: { id: 'subheading', name: 'Subheading', px: 20, bold: true },
  paragraph: { id: 'paragraph', name: 'Paragraph', px: 16, wrapWidth: TEXT_STYLE_WRAP_WIDTH },
  quote: { id: 'quote', name: 'Quote', px: 20, italic: true, wrapWidth: TEXT_STYLE_WRAP_WIDTH },
  caption: { id: 'caption', name: 'Caption', px: 12 },
};

export const TEXT_PRESET_LIST: readonly TextPreset[] = TEXT_PRESET_IDS.map(
  (id) => TEXT_PRESETS[id],
);

// T and a double-click on empty canvas make body text.
export const DEFAULT_TEXT_PRESET: TextPresetId = 'paragraph';

/** A new text in a style, its top-left at (x, y). */
export function createPresetText(x: number, y: number, presetId: TextPresetId): TextElement {
  return { ...createText(x, y), ...presetTextFields(TEXT_PRESETS[presetId]) };
}

/** A text restyled (the Text menu's Text Style): the style's size, weight, slant and box; anything else unchanged.
 *  The caller re-hugs the box to its words. */
export function applyTextPreset<E extends Element>(el: E, presetId: TextPresetId): E {
  if (el.type !== 'text') return el;
  return restyleText(el, TEXT_PRESETS[presetId]) as Element as E;
}

/** The style a text wears, or null when its size, weight or slant is its own. */
export function textPresetOfElement(el: Element): TextPresetId | null {
  return el.type === 'text' ? textPresetOf(el, TEXT_PRESET_LIST) : null;
}
