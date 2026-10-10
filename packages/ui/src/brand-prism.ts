import { hexToRgb, rgbToHex } from '@livediagram/document';

// The Living Prism's colours (docs/specs/004-interface-design/brand-mark.md).
// Six stops, light to dark; each face of the mark is a gradient over them.
export const PRISM_STOPS = ['light', 'vivid', 'primary', 'deep', 'dark', 'highlight'] as const;
export type PrismStop = (typeof PRISM_STOPS)[number];
export type PrismPalette = Record<PrismStop, string>;
export type PrismScheme = 'light' | 'dark';

// The brand palettes, as drawn in the Living Prism source artwork. `vivid` is
// the anchor a theme accent replaces; every other stop is placed relative to it.
export const PRISM_PALETTES: Record<PrismScheme, PrismPalette> = {
  light: {
    light: '#38bdf8',
    vivid: '#0284c7',
    primary: '#2563eb',
    deep: '#1d4ed8',
    dark: '#1e1b4b',
    highlight: '#e0f2fe',
  },
  dark: {
    light: '#38bdf8',
    vivid: '#0ea5e9',
    primary: '#3b82f6',
    deep: '#1d4ed8',
    dark: '#0f172a',
    highlight: '#bae6fd',
  },
};

// How far (OKLCH lightness, 0..1) an accent may pull the cube lighter or darker
// than the brand. Small enough that a near-black (#0f172a) or pale (#86efac)
// theme stroke still gives a cube that reads on both header surfaces; 0 would
// ignore the accent's lightness entirely. Safe range 0..0.15.
export const PRISM_LIGHTNESS_PULL = 0.08;

// The most an accent may raise every stop's chroma over the brand's, so a
// saturated accent cannot push the ramp out of gamut into flat clipped colour.
// Safe range 1..2.
export const PRISM_CHROMA_RATIO_MAX = 1.4;

// How much of the brand ramp's hue travel (sky at `light` round to indigo at
// `dark`, about 40 degrees) an accent keeps. The full travel suits blue, but
// turns a pink theme red at its dark end; 0.4 keeps each ramp in its own hue
// family while still deepening. Safe range 0..1.
export const PRISM_HUE_SPREAD = 0.4;

type Oklch = { l: number; c: number; h: number };

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) =>
  255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055);

// Björn Ottosson's OKLab matrices (https://bottosson.github.io/posts/oklab/).
function hexToOklch(hex: string): Oklch | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = [toLinear(rgb.r), toLinear(rgb.g), toLinear(rgb.b)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180) / Math.PI };
}

// Linear sRGB channels for an OKLCH colour; out of [0, 1] when out of gamut.
function oklchToLinear({ l: L, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: [number, number, number]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

// Back to hex, holding lightness and hue and giving up chroma until the colour
// fits sRGB (a fixed 16-step bisection, so the cost is bounded per stop).
function oklchToHex(colour: Oklch): string {
  let rgb = oklchToLinear(colour);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = colour.c;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ ...colour, c: mid }))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinear({ ...colour, c: lo });
  }
  const [r, g, b] = rgb.map(fromLinear) as [number, number, number];
  return rgbToHex({ r, g, b });
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// The prism palette for a scheme, tinted to `accent` when one is given. The
// brand palette's shape (each stop's lightness offset, chroma ratio and, narrowed,
// hue offset from `vivid`) is carried onto the accent, so any theme gets the same
// glass depth. No accent, or one that is not `#rrggbb`, gives the brand palette.
export function prismPalette(scheme: PrismScheme, accent?: string | null): PrismPalette {
  const brand = PRISM_PALETTES[scheme];
  const target = accent ? hexToOklch(accent) : null;
  if (!target) return brand;
  const anchor = hexToOklch(brand.vivid)!;
  const lightness = clamp(target.l - anchor.l, -PRISM_LIGHTNESS_PULL, PRISM_LIGHTNESS_PULL);
  const chroma = Math.min(target.c / anchor.c, PRISM_CHROMA_RATIO_MAX);
  const palette = {} as PrismPalette;
  for (const stop of PRISM_STOPS) {
    const from = hexToOklch(brand[stop])!;
    palette[stop] = oklchToHex({
      l: clamp(from.l + lightness, 0, 1),
      c: from.c * chroma,
      h: target.h + (from.h - anchor.h) * PRISM_HUE_SPREAD,
    });
  }
  return palette;
}
