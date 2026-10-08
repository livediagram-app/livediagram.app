// The whiteboard markers' stock colours (docs/specs/023-draw-mode/draw-mode.md "The colour
// picker"): Ink (the board's own, WHITEBOARD_INK), then eight named colours, each stored by name
// ("blue") and drawn in the version tuned for the board it is shown on: darker on the light board,
// lighter on the dark one. Each version is found in OKLCH: the hue and chroma stay, the lightness
// walks in from the board's far end until the colour would drop under its contrast on that board
// (PEN_STOCK_CONTRAST unless the colour sets its own), so every version is at least 4.5:1 (WCAG
// 1.4.11 with room to spare). A leaf module: no value imports, so the validator can read the names.

import type { Appearance } from './themes';

type PenColourSpec = {
  readonly id: string;
  readonly label: string;
  readonly hue: number;
  readonly chroma: number;
  // The contrast this colour's version stops at on a board, where it is not PEN_STOCK_CONTRAST.
  readonly contrast?: Readonly<Partial<Record<Appearance, number>>>;
};

// Yellow's contrast on the dark board: a golden yellow (#fdca04), as bright as a yellow marker. Safe
// range 9 (amber) to 13 (pale).
export const YELLOW_DARK_CONTRAST = 12;

export const PEN_COLOURS = [
  { id: 'blue', label: 'Blue', hue: 255, chroma: 0.18 },
  { id: 'red', label: 'Red', hue: 25, chroma: 0.19 },
  { id: 'orange', label: 'Orange', hue: 50, chroma: 0.17 },
  // Yellow is the lightest hue: at the others' 6:1 on the dark board it is mustard, so there it
  // stops at YELLOW_DARK_CONTRAST, a golden yellow. On the light board no yellow is light and
  // readable, so it is a deep gold there like the others.
  {
    id: 'yellow',
    label: 'Yellow',
    hue: 90,
    chroma: 0.18,
    contrast: { dark: YELLOW_DARK_CONTRAST },
  },
  { id: 'green', label: 'Green', hue: 145, chroma: 0.16 },
  { id: 'teal', label: 'Teal', hue: 190, chroma: 0.12 },
  { id: 'violet', label: 'Violet', hue: 295, chroma: 0.19 },
  { id: 'pink', label: 'Pink', hue: 350, chroma: 0.18 },
] as const satisfies readonly PenColourSpec[];
/** The eight hued stock colours, each tuned per board. */
export type HuedPenColourName = (typeof PEN_COLOURS)[number]['id'];

// Ink by name (docs/specs/007-editor/editor-modes.md "One look"): the board's own drawing colour,
// a stock colour like the eight, drawn in PEN_INK for each appearance.
export const INK_PEN_COLOUR = 'ink';
export type PenColourName = typeof INK_PEN_COLOUR | HuedPenColourName;

/** The eight hued stock colours, in the pickers' order after Ink. */
export const PEN_COLOUR_NAMES: readonly HuedPenColourName[] = PEN_COLOURS.map((c) => c.id);

// The ink per appearance (WHITEBOARD_INK): at least 4.5:1 on its board.
export const PEN_INK: Readonly<Record<Appearance, string>> = {
  light: '#1c1917',
  dark: '#e2e8f0',
};

// The contrast each stock colour's version aims for on its board: over the 4.5:1 the spec asks, so
// the light board's version is clearly darker than the dark board's.
export const PEN_STOCK_CONTRAST = 6;
// WCAG 1.4.11: under this, a custom colour is hard to see on a board.
export const PEN_MIN_CONTRAST = 3;

// The boards the versions are tuned against: WHITEBOARD_BOARD, repeated here to keep this a leaf
// (a test pins them equal).
export const PEN_BOARDS: Readonly<Record<Appearance, string>> = {
  light: '#fbfaf7',
  dark: '#0d121a',
};

// Lightness steps of the search, from the board's far end towards it.
const L_STEP = 0.0045;
const L_STEPS = 200;

const NAMES = new Set<string>([INK_PEN_COLOUR, ...PEN_COLOUR_NAMES]);

export function isPenColourName(v: unknown): v is PenColourName {
  return typeof v === 'string' && NAMES.has(v);
}

/** "Blue": the swatch's tooltip and accessible name. */
export function penColourLabel(name: PenColourName): string {
  if (name === INK_PEN_COLOUR) return 'Ink';
  return PEN_COLOURS.find((c) => c.id === name)!.label;
}

// --- Colour maths (sRGB, WCAG luminance, OKLCH per Björn Ottosson) ---------------------------

type Rgb = [number, number, number];

function hexRgb(hex: string): Rgb | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: Rgb) =>
  '#' +
  rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(toLinear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastOf(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** WCAG contrast of a `#rrggbb` on a board, or NaN for anything else. */
export function penContrast(hex: string, board: Appearance): number {
  const rgb = hexRgb(hex);
  return rgb ? contrastOf(rgb, hexRgb(PEN_BOARDS[board])!) : NaN;
}

function oklchLinear(l: number, c: number, h: number): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

// The colour at OKLCH (l, c, h), its chroma reduced until it fits sRGB.
function oklchRgb(l: number, c: number, h: number): Rgb {
  let chroma = c;
  let lin = oklchLinear(l, chroma, h);
  while (chroma > 0 && lin.some((v) => v < -0.0001 || v > 1.0001)) {
    chroma = Math.max(0, chroma - 0.005);
    lin = oklchLinear(l, chroma, h);
  }
  return lin.map((v) => Math.round(Math.min(1, Math.max(0, fromLinear(v))) * 255)) as Rgb;
}

function rgbOklch(rgb: Rgb): { l: number; c: number; h: number } {
  const [r, g, b] = rgb.map(toLinear) as Rgb;
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

// A colour's version for a board: walking in from the board's far end, the last lightness that
// still reaches its contrast on it.
function tune(colour: PenColourSpec, board: Appearance): string {
  const boardRgb = hexRgb(PEN_BOARDS[board])!;
  const target = colour.contrast?.[board] ?? PEN_STOCK_CONTRAST;
  let best: Rgb | null = null;
  for (let i = 0; i <= L_STEPS; i++) {
    const l = board === 'light' ? 0.05 + i * L_STEP : 0.98 - i * L_STEP;
    const rgb = oklchRgb(l, colour.chroma, colour.hue);
    if (contrastOf(rgb, boardRgb) < target) break;
    best = rgb;
  }
  return toHex(best!);
}

const TABLE: Readonly<Record<Appearance, Readonly<Record<HuedPenColourName, string>>>> = {
  light: Object.fromEntries(PEN_COLOURS.map((c) => [c.id, tune(c, 'light')])) as Record<
    HuedPenColourName,
    string
  >,
  dark: Object.fromEntries(PEN_COLOURS.map((c) => [c.id, tune(c, 'dark')])) as Record<
    HuedPenColourName,
    string
  >,
};

/** The `#rrggbb` a named colour is drawn in on a board. */
export function penColourHex(name: PenColourName, board: Appearance): string {
  return name === INK_PEN_COLOUR ? PEN_INK[board] : TABLE[board][name];
}

/**
 * A marker's colour as stored: a stock name ("blue") that adapts to the board, or a custom
 * `#rrggbb` that is the same on both. Null is the board's own ink.
 */
export type PenColour = PenColourName | string;

export function isCustomPenColour(v: unknown): v is string {
  return typeof v === 'string' && hexRgb(v) !== null;
}

/** What a stored colour draws in on a board; null (the ink) draws in `ink`. */
export function penColourCss(colour: PenColour | null, board: Appearance, ink: string): string {
  if (colour === null) return ink;
  return isPenColourName(colour) ? penColourHex(colour, board) : colour;
}

/** The boards a custom colour is under 3:1 on: the picker's "Hard to see on the dark board". */
export function penColourHardToSee(hex: string): Appearance[] {
  return (['light', 'dark'] as const).filter((b) => !(penContrast(hex, b) >= PEN_MIN_CONTRAST));
}

/** A `#rrggbb` colour in OKLCH (lightness 0..1, chroma, hue in degrees), or null for anything else. */
export function hexOklch(hex: string): { l: number; c: number; h: number } | null {
  const rgb = hexRgb(hex);
  return rgb ? rgbOklch(rgb) : null;
}

// Snap colours (docs/specs/023-draw-mode/draw-mode.md "Snap colours"): under this OKLCH chroma a
// colour is neutral (black, grey, white, slate) and becomes the ink. Greys measure 0 to 0.03 and
// slates about 0.04; dusty pastels start near 0.06. Safe range 0.03 to 0.08.
export const PEN_NEUTRAL_CHROMA = 0.05;

/** What a custom colour snaps to: a stock colour, or the board's own ink. */
export type SnapTarget = PenColourName | 'ink';

/** How far a hue (degrees) is from a stock colour's, round the circle: 0 to 180. */
export function penColourHueDistance(hue: number, name: HuedPenColourName): number {
  const d = Math.abs((((hue - PEN_COLOURS.find((c) => c.id === name)!.hue) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}

/** The stock colour nearest a hue (degrees, round the circle); a tie goes to the earlier one. */
export function penColourAtHue(hue: number): HuedPenColourName {
  let best: HuedPenColourName = PEN_COLOURS[0].id;
  let bestDist = Infinity;
  for (const c of PEN_COLOURS) {
    const dist = penColourHueDistance(hue, c.id);
    if (dist < bestDist) {
      best = c.id;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * The stock colour a custom `#rrggbb` snaps to: the ink when it is neutral, else the stock colour
 * nearest in hue (lightness is not compared: each stock colour takes its own per board). Null for
 * anything that is not `#rrggbb`.
 */
export function nearestPenColour(hex: string): SnapTarget | null {
  const oklch = hexOklch(hex);
  if (!oklch) return null;
  return oklch.c < PEN_NEUTRAL_CHROMA ? 'ink' : penColourAtHue(oklch.h);
}

/**
 * A nearby version of a custom colour that is at least 3:1 on both boards: the same OKLCH hue and
 * chroma, its lightness moved the least that reaches it. The colour itself when it already is.
 */
export function readablePenColour(hex: string): string {
  const rgb = hexRgb(hex);
  if (!rgb) return hex;
  if (penColourHardToSee(hex).length === 0) return hex.toLowerCase();
  const { l, c, h } = rgbOklch(rgb);
  for (let step = 1; step <= 400; step++) {
    for (const dl of [-step * 0.0025, step * 0.0025]) {
      const L = l + dl;
      if (L < 0 || L > 1) continue;
      const candidate = toHex(oklchRgb(L, c, h));
      if (penColourHardToSee(candidate).length === 0) return candidate;
    }
  }
  return '#808080';
}
