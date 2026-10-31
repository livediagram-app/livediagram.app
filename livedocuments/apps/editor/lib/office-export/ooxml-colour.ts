// A CSS colour as Office Open XML names one (docs/specs/020-import-export/blueprints/office-export.md "Colours"):
// six hex digits and an opacity. An element's colours are what the canvas paints, so they reach here as CSS writes
// them: a hex, a name, `rgb()` / `rgba()`, or `transparent` / `none`. Anything else is not a colour a file can name,
// which sends a shape to a picture instead.

import { parseCssColourAlpha } from '@liveworkspace/model-core/css-colour';

export type OoxmlColour = { hex: string; alpha: number };

/** No paint at all: `none`, `transparent`, or a colour with no opacity. */
export const NO_PAINT = 'none' as const;

const hex2 = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

// rgb(1 2 3 / 0.5), rgb(1, 2, 3), rgba(1, 2, 3, 0.5), with percentages for the alpha.
const RGB = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i;

/** The colour, its opacity 0 to 1; `none` for no paint; null when the file cannot name it. */
export function ooxmlColour(css: string | undefined): OoxmlColour | typeof NO_PAINT | null {
  if (css === undefined) return null;
  const v = css.trim();
  if (v === '' || v === 'none' || v === 'transparent') return NO_PAINT;
  const m = RGB.exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
    if (![m[1], m[2], m[3]].every((c) => Number.isFinite(Number(c))) || !Number.isFinite(a))
      return null;
    if (a <= 0) return NO_PAINT;
    return {
      hex: hex2(Number(m[1])) + hex2(Number(m[2])) + hex2(Number(m[3])),
      alpha: Math.min(1, a),
    };
  }
  const c = parseCssColourAlpha(v);
  if (!c) return null;
  if (c.a === 0) return NO_PAINT;
  return { hex: hex2(c.r) + hex2(c.g) + hex2(c.b), alpha: c.a / 255 };
}

/** A DrawingML `<a:solidFill>` of the colour, its alpha folded with `opacity`. */
export function solidFillXml(colour: OoxmlColour, opacity = 1): string {
  const alpha = Math.round(colour.alpha * opacity * 100_000);
  const inner = alpha < 100_000 ? `<a:alpha val="${Math.max(0, alpha)}"/>` : '';
  return `<a:solidFill><a:srgbClr val="${colour.hex}">${inner}</a:srgbClr></a:solidFill>`;
}

/** The face a CSS font stack starts with, unquoted: what an app looks the font up by. */
export function fontFaceName(stack: string | undefined): string | undefined {
  const first = stack
    ?.split(',')[0]
    ?.trim()
    .replace(/^['"]|['"]$/g, '');
  if (!first || /^(ui-|system-ui|sans-serif|serif|monospace|cursive|fantasy)/.test(first))
    return undefined;
  return first;
}
