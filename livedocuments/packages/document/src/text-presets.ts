// Write's text styles (docs/specs/008-canvas/canvas-and-palette.md "Text element", "Text styles"): the styles a
// document is written in, each a plain text element with its fields set as the style says. Nothing marks an element
// as a style afterwards: it is where the text starts, and the context menu restyles it like any other. Every size sits
// on a document's Size slider (24 to 72 px), and every text the editor makes is left aligned, top first.
import { createText } from './factories';
import {
  presetTextFields,
  type TextPreset as SharedTextPreset,
} from '@liveworkspace/element-model/text-presets';
import type { TextElement } from './index';

// The shared half (how a style becomes a text's fields, the box for known words, the alignment every text starts
// with) is @liveworkspace/element-model/text-presets; this file is livedocuments' table of styles and its factory.
export { NEW_TEXT_ALIGN, textBoxFor } from '@liveworkspace/element-model/text-presets';

export const TEXT_PRESET_IDS = [
  'title',
  'subtitle',
  'heading',
  'subheading',
  'paragraph',
  'quote',
] as const;
export type TextPresetId = (typeof TEXT_PRESET_IDS)[number];

// A style: its name (the tile's, and the words it starts with), its size in canvas px on the Size slider's 24 to 72,
// its weight and slant, and the width body text wraps at (a heading's box fits its words).
export type TextPreset = SharedTextPreset<TextPresetId>;

export const TEXT_PRESETS: Readonly<Record<TextPresetId, TextPreset>> = {
  title: { id: 'title', name: 'Title', px: 64, bold: true },
  subtitle: { id: 'subtitle', name: 'Subtitle', px: 36 },
  heading: { id: 'heading', name: 'Heading', px: 48, bold: true },
  subheading: { id: 'subheading', name: 'Subheading', px: 32, bold: true },
  paragraph: { id: 'paragraph', name: 'Paragraph', px: 24, wrapWidth: 600 },
  quote: { id: 'quote', name: 'Quote', px: 30, italic: true, wrapWidth: 600 },
};

// T, a double-click on empty canvas and a node's quick add Text make body text.
export const DEFAULT_TEXT_PRESET: TextPresetId = 'paragraph';

/** A new text in a style, its top-left at (x, y). */
export function createPresetText(x: number, y: number, presetId: TextPresetId): TextElement {
  return { ...createText(x, y), ...presetTextFields(TEXT_PRESETS[presetId]) };
}
