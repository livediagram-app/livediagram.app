// The quick style panel's colour rows (docs/specs/008-canvas/quick-style-panel.md "Colours"): seven
// swatches per role, derived from the active theme so they change with it.
// Slot 0 is the theme's own default; slots 1-6 are six colours from the
// theme's palette. A slot is a stable id, which is what lets a colour picked
// here follow a theme change (`strokeSwatch` / `fillSwatch` on the element).
import {
  canvasSurface,
  contrastRatio,
  hexToRgb,
  rgbToHex,
  unpaintedShapeInk,
  type RGB,
} from './colors';
import type { ThemeDefinition } from './themes';

export const QUICK_SWATCH_SLOTS = [1, 2, 3, 4, 5, 6] as const;
export type QuickSwatchSlot = (typeof QUICK_SWATCH_SLOTS)[number];
export type QuickSwatchRole = 'stroke' | 'fill';
export type QuickSwatch = {
  // 0 = the theme default (writes the theme's value, binds nothing).
  slot: 0 | QuickSwatchSlot;
  color: string;
  // The accessible name, and the tooltip: a colour word, never a hex.
  name: string;
};

export function isQuickSwatchSlot(value: unknown): value is QuickSwatchSlot {
  return (QUICK_SWATCH_SLOTS as readonly unknown[]).includes(value);
}

// The six canonical hues a single-accent theme is spun into, in the order a
// multi-colour theme's palette runs (red to violet), so slot 4 means green in
// every theme and survives a theme change as green.
const TONED_HUES: readonly { hue: number; name: string }[] = [
  { hue: 0, name: 'Red' },
  { hue: 28, name: 'Orange' },
  { hue: 46, name: 'Yellow' },
  { hue: 140, name: 'Green' },
  { hue: 215, name: 'Blue' },
  { hue: 270, name: 'Violet' },
];

// The accent's tone, clamped so a near-grey accent (Sand, Midnight) still
// yields colours and a near-black one (Mono) still yields visible ones.
const SATURATION_RANGE = [0.45, 0.85] as const;
const LIGHTNESS_RANGE = { light: [0.36, 0.52], dark: [0.6, 0.74] } as const;
// A derived stroke must read against its canvas (WCAG 1.4.11 non-text).
export const QUICK_STROKE_MIN_CONTRAST = 3;
// A derived background must keep the theme's label readable (WCAG 1.4.3).
export const QUICK_FILL_MIN_TEXT_CONTRAST = 4.5;
// How much of the hue a background carries: over white on light paper, so a
// background reads as a clean tint whatever the theme's own fill; over the
// theme's fill on dark paper, where a white base would glare.
const FILL_WASH = { light: 0.2, dark: 0.3 } as const;
const STEP = 0.02;

// The theme's defaults for a plain shape: its element colours, or the
// unpainted ink of the paper it is drawn on (the Default scheme sets none).
function themeInk(theme: ThemeDefinition): { fill: string; stroke: string; text: string } {
  const ink = unpaintedShapeInk(canvasSurface(theme.backgroundColor));
  return {
    fill: theme.elementFill ?? ink.fill,
    stroke: theme.elementStroke ?? ink.stroke,
    text: theme.elementText ?? ink.text,
  };
}

export function quickSwatches(theme: ThemeDefinition, role: QuickSwatchRole): QuickSwatch[] {
  const ink = themeInk(theme);
  const first: QuickSwatch = {
    slot: 0,
    color: role === 'stroke' ? ink.stroke : ink.fill,
    name: 'Theme default',
  };
  const six =
    theme.palette && theme.palette.length > 0 ? paletteSix(theme, role) : tonedSix(theme, role);
  return [
    first,
    ...six.map((s, i) => ({ slot: QUICK_SWATCH_SLOTS[i]!, color: s.color, name: s.name })),
  ];
}

export function quickSwatchColor(
  theme: ThemeDefinition,
  role: QuickSwatchRole,
  slot: 0 | QuickSwatchSlot,
): string {
  return quickSwatches(theme, role)[slot]!.color;
}

export function quickSwatchSlotOf(
  theme: ThemeDefinition,
  role: QuickSwatchRole,
  color: string | undefined,
): QuickSwatchSlot | null {
  if (!color) return null;
  const key = color.toLowerCase();
  const hit = quickSwatches(theme, role).find((s) => s.slot !== 0 && s.color.toLowerCase() === key);
  return hit && hit.slot !== 0 ? hit.slot : null;
}

// A multi-colour theme names its own six: the branch colours, strokes for
// the stroke row and the matching fills for the background row. Padded from
// the toned set when a palette is short, so a row is always seven.
function paletteSix(
  theme: ThemeDefinition,
  role: QuickSwatchRole,
): { color: string; name: string }[] {
  const palette = theme.palette!.slice(0, QUICK_SWATCH_SLOTS.length);
  const own = palette.map((p) => ({
    color: role === 'stroke' ? p.stroke : p.fill,
    name: hueName(p.stroke),
  }));
  const padded = [...own, ...tonedSix(theme, role).slice(own.length)];
  return disambiguate(padded);
}

function tonedSix(
  theme: ThemeDefinition,
  role: QuickSwatchRole,
): { color: string; name: string }[] {
  const ink = themeInk(theme);
  const surface = canvasSurface(theme.backgroundColor);
  const accent = rgbToHsl(hexToRgb(ink.stroke) ?? { r: 14, g: 165, b: 233 });
  const s = clamp(accent.s, SATURATION_RANGE[0], SATURATION_RANGE[1]);
  const [lMin, lMax] = LIGHTNESS_RANGE[surface];
  const l = clamp(accent.l, lMin, lMax);
  return TONED_HUES.map(({ hue, name }) => {
    const stroke = visibleOn(hue, s, l, theme.backgroundColor, surface);
    const base = surface === 'light' ? '#ffffff' : ink.fill;
    const wash = FILL_WASH[surface];
    return { color: role === 'stroke' ? stroke : readableWash(stroke, base, ink.text, wash), name };
  });
}

// Step the lightness away from the canvas until the stroke reads against it.
function visibleOn(
  hue: number,
  s: number,
  l: number,
  background: string,
  surface: 'light' | 'dark',
): string {
  let lightness = l;
  let colour = hslToHex(hue, s, lightness);
  while (contrastRatio(colour, background) < QUICK_STROKE_MIN_CONTRAST) {
    const next = surface === 'light' ? lightness - STEP : lightness + STEP;
    if (next < 0 || next > 1) break;
    lightness = next;
    colour = hslToHex(hue, s, lightness);
  }
  return colour;
}

// A wash of the hue over the theme's fill, thinned until the label reads.
function readableWash(stroke: string, baseFill: string, text: string, start: number): string {
  let wash = start;
  let colour = mix(stroke, baseFill, wash);
  while (wash > 0 && contrastRatio(text, colour) < QUICK_FILL_MIN_TEXT_CONTRAST) {
    wash = Math.max(0, wash - STEP);
    colour = mix(stroke, baseFill, wash);
  }
  return colour;
}

// A colour word for a hue, for the accessible name.
const HUE_NAMES: readonly [number, string][] = [
  [15, 'Red'],
  [30, 'Orange'],
  [38, 'Amber'],
  [65, 'Yellow'],
  [85, 'Lime'],
  [165, 'Green'],
  [185, 'Teal'],
  [200, 'Cyan'],
  [250, 'Blue'],
  [290, 'Violet'],
  [345, 'Pink'],
  [360, 'Red'],
];

const BROWN_HUES = [15, 45] as const;
const BROWN_MAX_LIGHTNESS = 0.33;

export function hueName(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'Colour';
  const { h, s, l } = rgbToHsl(rgb);
  if (s < 0.12) return 'Grey';
  // A dark orange reads as brown, and a warm palette leans on it.
  if (h >= BROWN_HUES[0] && h < BROWN_HUES[1] && l < BROWN_MAX_LIGHTNESS) return 'Brown';
  return HUE_NAMES.find(([upTo]) => h < upTo)?.[1] ?? 'Red';
}

// Two swatches must never share a name: a repeat becomes "Deep" or "Light"
// against the first, and a third of the same word is numbered.
function disambiguate(six: { color: string; name: string }[]): { color: string; name: string }[] {
  const taken = new Set<string>();
  return six.map((entry) => {
    const first = six.find((e) => e.name === entry.name)!;
    let name = entry.name;
    if (taken.has(name)) {
      const darker = lightnessOf(entry.color) < lightnessOf(first.color);
      name = `${darker ? 'Deep' : 'Light'} ${entry.name.toLowerCase()}`;
    }
    for (let n = 2; taken.has(name); n++) name = `${entry.name} ${n}`;
    taken.add(name);
    return { ...entry, name };
  });
}

function lightnessOf(hex: string): number {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb).l : 0;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function mix(a: string, b: string, amountOfA: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return b;
  return rgbToHex({
    r: x.r * amountOfA + y.r * (1 - amountOfA),
    g: x.g * amountOfA + y.g * (1 - amountOfA),
    b: x.b * amountOfA + y.b * (1 - amountOfA),
  });
}

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rr
      ? ((gg - bb) / d + (gg < bb ? 6 : 0)) * 60
      : max === gg
        ? ((bb - rr) / d + 2) * 60
        : ((rr - gg) / d + 4) * 60;
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}
