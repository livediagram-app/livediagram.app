// A sheet cell's colours as drawn on its Sheet: a cell stores literal colours (a fill picked on a light canvas stays `#ecfdf5`), so the drawing side resolves them for
// the surface it is drawn on. On a dark Sheet a pale fill (a band, a highlight, an input's yellow) is drawn as a tint
// of its hue on the dark surface, and on a light Sheet a near-black tint is drawn as a pale one, so a sheet set up in
// one theme reads in the other. Then the ink (the cell's own text colour, else the Sheet's) is lifted or deepened until
// it meets WCAG AA on what is behind it. Pure; the editor's cells and the cell editor read it.
import { contrastRatio, hexToRgb, MIN_TEXT_CONTRAST } from './colors';
import { mixHex } from '@liveworkspace/model-core/color-wash';

// A fill this close to white (its contrast with white below this) is pale: a tint drawn for a light canvas.
const PALE_CONTRAST = 1.35;
// A pale fill on a dark Sheet keeps this share of itself over the surface (its hue, quietly).
const PALE_ON_DARK_SHARE = 0.16;
// A fill this dark (its contrast with black below this) and this grey (its channels this close together) is a dark
// tint: drawn for a dark canvas. A deep accent (a header's #065f46) is too colourful to be one, and stays.
const DARK_TINT_CONTRAST = 2.2;
const DARK_TINT_CHROMA = 70;
// A dark tint on a light Sheet keeps this share of itself over white.
const DARK_ON_LIGHT_SHARE = 0.1;
// How far one step moves an ink toward white or black while it falls short.
const INK_STEP = 0.1;

export type CellSurface = {
  // What the Sheet draws behind cells without a fill, and its own ink.
  fill: string;
  ink: string;
  dark: boolean;
};

// How colourful a fill is: its widest channel less its narrowest (0 a grey).
function chroma(hex: string): number {
  const c = hexToRgb(hex)!;
  return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
}

// The fill a stored fill is drawn with on `surface`.
export function cellFill(bg: string, surface: CellSurface): string {
  if (!hexToRgb(bg) || !hexToRgb(surface.fill)) return bg;
  if (surface.dark && contrastRatio(bg, '#ffffff') < PALE_CONTRAST)
    return mixHex(bg, surface.fill, PALE_ON_DARK_SHARE);
  if (
    !surface.dark &&
    contrastRatio(bg, '#000000') < DARK_TINT_CONTRAST &&
    chroma(bg) < DARK_TINT_CHROMA
  )
    return mixHex(bg, '#ffffff', DARK_ON_LIGHT_SHARE);
  return bg;
}

// `ink` moved toward white (on a dark `behind`) or black (on a light one) until it reads at AA, keeping its hue as
// long as it can; the input when it already reads or cannot be parsed.
export function readableInk(ink: string, behind: string): string {
  if (!hexToRgb(ink) || !hexToRgb(behind)) return ink;
  if (contrastRatio(ink, behind) >= MIN_TEXT_CONTRAST) return ink;
  const toward =
    contrastRatio(behind, '#000000') > contrastRatio(behind, '#ffffff') ? '#000000' : '#ffffff';
  for (let t = INK_STEP; t < 1; t += INK_STEP) {
    const next = mixHex(toward, ink, t);
    if (contrastRatio(next, behind) >= MIN_TEXT_CONTRAST) return next;
  }
  return toward;
}

// A cell's drawn fill (undefined: none of its own) and ink, from its stored `bg` and `fc`.
export function cellColours(
  f: { bg?: string; fc?: string } | undefined,
  surface: CellSurface,
): { fill: string | undefined; ink: string } {
  const fill = f?.bg ? cellFill(f.bg, surface) : undefined;
  return { fill, ink: readableInk(f?.fc ?? surface.ink, fill ?? surface.fill) };
}
