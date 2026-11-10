// Text styles (livedocuments' and livedesign's docs/specs/008-canvas/canvas-and-palette.md "Text styles"): a style is
// a plain text element with its fields set as the style says. Nothing marks an element as a style afterwards: it is
// where the text starts, and restyling it (or reading which style it matches) goes by the same fields. Each product
// owns its table of styles (its sizes are its own: a written page's run 24 to 72 px, a wireframe's 12 to 40) and
// binds these helpers to it; the shared part is how a style becomes an element's fields, how a text is restyled, and
// how the style a text wears is read back.
import { labelFontPx, TEXT_PX_MAX } from '@liveworkspace/model-core/label-font';
import type { TextSize } from '@liveworkspace/model-core/basics';

/** Every style a product may offer, by id. A product offers a subset, in its own order. */
export type TextPresetId =
  'title' | 'subtitle' | 'heading' | 'subheading' | 'paragraph' | 'quote' | 'caption';

export type TextPreset<Id extends TextPresetId = TextPresetId> = {
  id: Id;
  // Its name: the tile's, and the words it starts with.
  name: string;
  // The size its words draw at, in canvas px.
  px: number;
  bold?: boolean;
  italic?: boolean;
  // A heading's box fits its words; body text wraps at this width.
  wrapWidth?: number;
};

// Every text a style makes starts here: left, top.
export const NEW_TEXT_ALIGN = { textAlignX: 'left', textAlignY: 'top' } as const;

// The hug's padding round the words (each editor's lib/text-hug), and its leading, for the box before the words are
// measured.
const PAD_X = 4;
const PAD_Y = 2;
const LEADING = 1.25;
// A word's mean advance as a share of its size: generous, so a fitted box starts wide enough.
const GLYPH_WIDTH = 0.6;

/** A px as a text or a shape stores it: whole px up to the model's most (48), the rest as `textScale`. */
export function splitTextPx(px: number): { textSize: number; textScale?: number } {
  const whole = Math.max(1, Math.round(px));
  if (whole <= TEXT_PX_MAX) return { textSize: whole };
  return { textSize: TEXT_PX_MAX, textScale: Math.round((whole / TEXT_PX_MAX) * 1000) / 1000 };
}

/** The fields a new text in a style carries, beside its factory's id, kind and place: its box (fitted to its name,
 *  or the style's wrap width), its name as its words, its size, weight and slant, left-and-top alignment and how its
 *  box sizes itself. */
export function presetTextFields(preset: TextPreset): {
  width: number;
  height: number;
  label: string;
  textSize: number;
  textScale?: number;
  textBold?: true;
  textItalic?: true;
  textAlignX: 'left';
  textAlignY: 'top';
  sizing: 'fit' | 'wrap';
} {
  const width =
    preset.wrapWidth ?? Math.ceil(preset.name.length * preset.px * GLYPH_WIDTH) + 2 * PAD_X;
  return {
    width,
    height: Math.ceil(preset.px * LEADING) + 2 * PAD_Y,
    label: preset.name,
    ...splitTextPx(preset.px),
    ...(preset.bold ? { textBold: true as const } : {}),
    ...(preset.italic ? { textItalic: true as const } : {}),
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

/** What restyling and reading a style touch on a text: its size and scale, weight and slant, and how its box sizes. */
export type StyledText = {
  type: string;
  width: number;
  textSize?: TextSize;
  textScale?: number;
  textBold?: boolean;
  textItalic?: boolean;
  fontWeight?: number;
  sizing?: 'fit' | 'wrap';
};

/** The px a text's words draw at: its stored size times its scale, rounded. */
function drawnPx(el: StyledText): number {
  return Math.round(labelFontPx(el.textSize) * (el.textScale ?? 1));
}

/**
 * A text restyled as `preset`: the style's size (a size past 48 px stores its rest as the scale, a smaller one drops
 * any scale), its weight (a wordmark weight gives way to it) and its slant, and its box: a wrapping style wraps at its
 * width when the text did not wrap already, and a fitting style fits its words. The words, their colour, font and
 * alignment are the text's own and stay. Anything but a text comes back as it was. The caller re-hugs the box to the
 * words, which only it can measure.
 */
export function restyleText<E extends StyledText>(el: E, preset: TextPreset): E {
  if (el.type !== 'text') return el;
  const next: StyledText = { ...el, ...splitTextPx(preset.px) };
  if (preset.px <= TEXT_PX_MAX) delete next.textScale;
  if (preset.bold) next.textBold = true;
  else delete next.textBold;
  if (preset.italic) next.textItalic = true;
  else delete next.textItalic;
  delete next.fontWeight;
  if (preset.wrapWidth) {
    if (el.sizing !== 'wrap') {
      next.sizing = 'wrap';
      next.width = preset.wrapWidth;
    }
  } else next.sizing = 'fit';
  return next as E;
}

/** The style a text wears, or null: the first style whose size, weight and slant its fields match. A style is
 *  never stored, so a text restyled by hand (a size off the table, a bold paragraph) wears none. */
export function textPresetOf<Id extends TextPresetId>(
  el: StyledText,
  presets: readonly TextPreset<Id>[],
): Id | null {
  if (el.type !== 'text') return null;
  const px = drawnPx(el);
  const bold = el.textBold === true;
  const italic = el.textItalic === true;
  const match = presets.find(
    (p) => p.px === px && (p.bold ?? false) === bold && (p.italic ?? false) === italic,
  );
  return match ? match.id : null;
}
