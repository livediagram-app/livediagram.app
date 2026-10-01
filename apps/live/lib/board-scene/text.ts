// Text mapping for a landed board scene (docs/specs/020-import-export/board-scene.md "Text"): the
// font size survives exactly (the nearest size preset times a text scale), families map to the
// catalogue's fonts, alignment and styles carry over.
import {
  LABEL_FONT_PX,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  type PenColourName,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/document';
import { textColourFields } from './colour';
import type { LandContext } from './context';
import type { SceneText } from './scene';

// A scale this close to 1 is no visible difference, so none is written.
export const TEXT_SCALE_EPSILON = 0.005;

// Source font families to the catalogue (fonts.ts): Excalifont, Virgil and Whiteboard's ink fonts
// read as hand; the board's own font for sans-serif.
export const SCENE_FONTS: Readonly<Record<SceneText['family'], string | undefined>> = {
  hand: 'caveat',
  mono: 'roboto-mono',
  serif: 'lora',
  sans: undefined,
};

const PRESETS: readonly TextSize[] = ['sm', 'md', 'lg'];

/** The size preset nearest a font px, by ratio; ties go to the larger. */
export function textPreset(fontPx: number): TextSize {
  let best: TextSize = 'md';
  let bestDistance = Infinity;
  for (const size of PRESETS) {
    const d = Math.abs(Math.log(fontPx / LABEL_FONT_PX[size]));
    if (d <= bestDistance) {
      best = size;
      bestDistance = d;
    }
  }
  return best;
}

/** The diagram profile's buckets, as the Excalidraw file importer has always used them. */
export function diagramTextSize(fontPx: number): TextSize {
  return fontPx <= 16 ? 'sm' : fontPx <= 22 ? 'md' : 'lg';
}

export type SceneTextFields = {
  label: string;
  textSize: TextSize;
  textScale?: number;
  font?: string;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  textBold?: true;
  textItalic?: true;
  textUnderline?: true;
  textStrikethrough?: true;
  textColor?: string;
  penTextColour?: PenColourName;
};

// A broken font px reads as the Medium preset's.
const fontPxOf = (t: SceneText) =>
  Number.isFinite(t.fontPx) && t.fontPx > 0 ? t.fontPx : LABEL_FONT_PX.md;

/** A label's fields: the nearest preset, family, alignment, styles and colour. */
export function labelFields(t: SceneText, ctx: LandContext): SceneTextFields {
  const font = SCENE_FONTS[t.family];
  return {
    label: t.text.replace(/\r\n?/g, '\n'),
    textSize: textPreset(fontPxOf(t)),
    ...(font ? { font } : {}),
    ...(t.alignX ? { textAlignX: t.alignX } : {}),
    ...(t.alignY ? { textAlignY: t.alignY } : {}),
    ...(t.bold ? { textBold: true as const } : {}),
    ...(t.italic ? { textItalic: true as const } : {}),
    ...(t.underline ? { textUnderline: true as const } : {}),
    ...(t.strike ? { textStrikethrough: true as const } : {}),
    ...textColourFields(ctx.colour(t.colour)),
  };
}

/** A text box's fields: the label's, with the scale that keeps the font px exact. */
export function textBoxFields(t: SceneText, ctx: LandContext): SceneTextFields {
  const fields = labelFields(t, ctx);
  const raw = fontPxOf(t) / LABEL_FONT_PX[fields.textSize];
  const scale = Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, raw));
  return Math.abs(scale - 1) > TEXT_SCALE_EPSILON ? { ...fields, textScale: scale } : fields;
}
