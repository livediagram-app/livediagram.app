// Colour maths for every product's elements (liveworkspace/docs/specs/002-architecture/architecture.md "The shared
// element model"): a written colour to channels and back, WCAG contrast, tint and shade, the ink that reads on a fill
// and the paper a canvas colour amounts to. No element kind in it: each product's colors.ts keeps its element defaults
// and re-exports these.
import { parseCssColour, parseCssColourAlpha } from '@liveworkspace/model-core/css-colour';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
} from '@liveworkspace/model-core/canvas-colors';

// Standard hex → rgb / rgb → hex / brightness math used to derive colours
// for new elements when the tab background or pattern colour has been
// customised. Failsafe: returns design defaults on unparseable input.

export type RGB = { r: number; g: number; b: number };

// A colour as written to 0-255 channels, or null for anything it cannot read. It reads `#rrggbb` and the shorthand
// `#rgb` (the `#` optional, surrounding spaces ignored), either with an alpha digit pair or digit (`#rrggbbaa`, `#rgba`, the alpha set aside: the
// channels are what an ink is judged against), and the CSS named colours (`red`, `slategray`; any case, trimmed),
// because agents write all of them (docs/specs/011-theme/light-and-dark.md "Colours an agent writes"). An rgb()
// string, `transparent` and anything else stay null. The one colour parser, shared by the models
// (@liveworkspace/model-core/css-colour): callers that know their input is a catalogue hex assert it rather than
// re-parsing.
export function hexToRgb(hex: string): RGB | null {
  return parseCssColour(hex);
}

// Any colour hexToRgb reads, as `#rrggbb`; null for the rest. For code that hands a colour on to a parser that only
// knows `#rrggbb` (mixing, OKLCH walks).
export function normaliseHex(colour: string): string | null {
  const c = parseCssColour(colour);
  return c ? rgbToHex(c) : null;
}

// Whether a colour reads and is fully opaque: `#fff8` and `#0ea5e980` read but show what is under them.
export function colourIsOpaque(colour: string): boolean {
  return parseCssColourAlpha(colour)?.a === 255;
}

// WCAG 2.2 SC 1.4.3: the minimum contrast for normal-size text (AA).
export const MIN_TEXT_CONTRAST = 4.5;

// WCAG 2.2 contrast ratio of two colours hexToRgb reads, in [1, 21] and
// order-independent. NaN for any other input, so a `>=` threshold check
// can never pass on a colour it could not read.
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return NaN;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

// Channels back to `#rrggbb`, rounded and clamped into 0-255 first.
export function rgbToHex({ r, g, b }: RGB): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function mixWithWhite(rgb: RGB, amount: number): RGB {
  return {
    r: rgb.r + (255 - rgb.r) * amount,
    g: rgb.g + (255 - rgb.g) * amount,
    b: rgb.b + (255 - rgb.b) * amount,
  };
}

function darken(rgb: RGB, amount: number): RGB {
  return { r: rgb.r * (1 - amount), g: rgb.g * (1 - amount), b: rgb.b * (1 - amount) };
}

// Hex-level tint (mix toward white) / shade (toward black) by `amount`
// in 0..1. Used to spin a single theme hue into a light → base → dark
// ramp for the colour-picker presets so the user has several on-theme
// versions to apply without opening the full swatch. Failsafe: returns
// the input unchanged on unparseable hex.
export function tint(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(mixWithWhite(rgb, amount)) : hex;
}

export function shade(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(darken(rgb, amount)) : hex;
}

export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  // Perceived-brightness (NTSC weighted) — < 155 reads as dark.
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 155;
}

// For new shapes on a customised tab: stroke = pattern colour as the accent;
// fill = a very light tint of that colour; text = a deep version of it.
// On a default-coloured tab, returns null to defer to the design system.
export function deriveShapeColours(
  patternColor: string,
  backgroundColor: string,
): { fill: string; stroke: string; text: string } | null {
  if (patternColor === DEFAULT_PATTERN_COLOR && backgroundColor === DEFAULT_BACKGROUND_COLOR) {
    return null;
  }
  const rgb = hexToRgb(patternColor);
  if (!rgb) return null;
  return {
    fill: rgbToHex(mixWithWhite(rgb, 0.85)),
    stroke: rgbToHex(rgb),
    text: rgbToHex(darken(rgb, 0.45)),
  };
}

// Whichever of a dark and a light ink contrasts more with `fill`. A brightness cut-off (isLightColor) gave mid-tones
// light text they could not carry (orange, #f97316, at 2.6:1 under slate-100 where slate-800 reads 5.4:1); off the
// mid-tones the two rules agree. An unparseable colour reads as light, as isLightColor has it, so it takes the dark ink.
export function bestInk(fill: string, dark: string, light: string): string {
  if (!hexToRgb(fill)) return dark;
  return contrastRatio(dark, fill) >= contrastRatio(light, fill) ? dark : light;
}

// For new text elements: a label colour that contrasts with the bg (slate-800 or slate-100).
export function deriveTextColorForBg(backgroundColor: string): string {
  return bestInk(backgroundColor, '#1e293b', '#f1f5f9');
}

// Which paper an element is being drawn on. NOT the same thing as the
// viewer's Appearance (docs/specs/007-editor/editor-app.md): a Midnight-schemed tab is dark paper in
// light chrome, and the Default scheme is whichever paper the viewer's
// appearance resolves to. The element defaults below take it because an
// element with no colour of its own has nothing else to read — and a Default
// tab deliberately stores no element colours, so this IS the colour.
export type CanvasSurface = 'light' | 'dark';

/** The paper a canvas colour amounts to. Unset / unparseable is the white default. */
export function canvasSurface(backgroundColor: string | undefined | null): CanvasSurface {
  if (!backgroundColor || !backgroundColor.startsWith('#')) return 'light';
  return isLightColor(backgroundColor) ? 'light' : 'dark';
}

// The ink that reads on a SOLID fill of `color`: whichever of white and the app's near-black reads better
// (bestInk), so a pale theme accent never carries white text (livediagram's Collaborate cards' accent buttons, on the
// canvas and in the export).
export function inkOn(color: string): string {
  return bestInk(color, '#0f172a', '#ffffff');
}
