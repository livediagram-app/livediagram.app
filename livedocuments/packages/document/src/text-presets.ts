// Write's text styles (docs/specs/008-canvas/canvas-and-palette.md "Text element", "Text styles"): the styles a
// document is written in, each a plain text element with its fields set as the style says. Nothing marks an element
// as a style afterwards: it is where the text starts, and the context menu restyles it like any other. Every size sits
// on a document's Size slider (24 to 72 px), and every text the editor makes is left aligned, top first.
import { createText } from './factories';
import { splitTextPx } from './label-text-scale';
import type { TextElement } from './index';

export const TEXT_PRESET_IDS = [
  'title',
  'subtitle',
  'heading',
  'subheading',
  'paragraph',
  'quote',
] as const;
export type TextPresetId = (typeof TEXT_PRESET_IDS)[number];

export type TextPreset = {
  id: TextPresetId;
  // Its name: the tile's, and the words it starts with.
  name: string;
  // Its size in canvas px, on the Size slider's 24 to 72.
  px: number;
  bold?: boolean;
  italic?: boolean;
  // A heading's box fits its words; body text wraps at this width.
  wrapWidth?: number;
};

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

// Every text the editor makes starts here: left, top.
export const NEW_TEXT_ALIGN = { textAlignX: 'left', textAlignY: 'top' } as const;

// The hug's padding round the words (the editor's lib/text-hug), and its leading, for the box before the words are
// measured.
const PAD_X = 4;
const PAD_Y = 2;
const LEADING = 1.25;
// A word's mean advance as a share of its size: generous, so a fitted box starts wide enough.
const GLYPH_WIDTH = 0.6;

/** A new text in a style, its top-left at (x, y). */
export function createPresetText(x: number, y: number, presetId: TextPresetId): TextElement {
  const preset = TEXT_PRESETS[presetId];
  const width =
    preset.wrapWidth ?? Math.ceil(preset.name.length * preset.px * GLYPH_WIDTH) + 2 * PAD_X;
  return {
    ...createText(x, y),
    width,
    height: Math.ceil(preset.px * LEADING) + 2 * PAD_Y,
    label: preset.name,
    ...splitTextPx(preset.px),
    ...(preset.bold ? { textBold: true } : {}),
    ...(preset.italic ? { textItalic: true } : {}),
    ...NEW_TEXT_ALIGN,
    sizing: preset.wrapWidth ? 'wrap' : 'fit',
  };
}

/** A box for words at `px`, before they are measured: the widest line's width (held to `wrapWidth` when given), and a
 *  line's height for every line it wraps to. For an agent's text, whose label is known when it is made. */
export function textBoxFor(
  label: string | undefined,
  px: number,
  wrapWidth?: number,
): { width: number; height: number } {
  const charPx = px * GLYPH_WIDTH;
  const lines = (label ? label : ' ').split('\n');
  const lineWidth = (line: string) => Math.ceil(line.length * charPx) + 2 * PAD_X;
  const widest = Math.max(...lines.map(lineWidth));
  const width = wrapWidth ? Math.min(wrapWidth, widest) : widest;
  const rows = lines.reduce((n, line) => n + Math.max(1, Math.ceil(lineWidth(line) / width)), 0);
  return { width, height: rows * Math.ceil(px * LEADING) + 2 * PAD_Y };
}
