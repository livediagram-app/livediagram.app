// Light and dark halves (docs/specs/011-theme/light-and-dark.md): every theme works in both appearances. A theme is
// written as one half (its native half, light or dark by its canvas); the other is derived from it in OKLCH, keeping
// each colour's hue and moving its lightness to the role's place in that appearance. Both halves are then tuned to the
// contrast floor (text on its fill 4.5:1, outlines and arrows on the canvas 3:1). Pure and memoised per theme object.
import { canvasSurface, contrastRatio } from './colors';
import { hexOklch, oklchHex } from './pen-colours';
import { DEFAULT_SCHEME_ID, defaultScheme, type Appearance, type ThemeDefinition } from './themes';
import type { ShapeKind } from './index';
import { shapeColorPresets } from './theme-presets';

type Role = 'background' | 'pattern' | 'fill' | 'stroke' | 'text';

/** Where each role sits in each appearance: its OKLCH lightness, and how much of the colour's chroma it keeps. */
const ROLE_TARGETS: Record<Appearance, Record<Role, { l: number; keep: number; max: number }>> = {
  dark: {
    background: { l: 0.2, keep: 0.5, max: 0.035 },
    pattern: { l: 0.3, keep: 0.6, max: 0.045 },
    fill: { l: 0.32, keep: 0.75, max: 0.08 },
    stroke: { l: 0.76, keep: 1, max: 0.16 },
    text: { l: 0.94, keep: 0.35, max: 0.04 },
  },
  light: {
    background: { l: 0.975, keep: 0.4, max: 0.02 },
    pattern: { l: 0.89, keep: 0.6, max: 0.04 },
    fill: { l: 0.935, keep: 0.6, max: 0.05 },
    stroke: { l: 0.52, keep: 1, max: 0.17 },
    text: { l: 0.32, keep: 0.9, max: 0.1 },
  },
};

/** The WCAG 2.2 AA floors: text on its fill, and outlines / arrows (non-text) on the canvas. */
export const THEME_TEXT_CONTRAST = 4.5;
export const THEME_LINE_CONTRAST = 3;

/** Which appearance a theme is written for: a light canvas is a light theme, a dark canvas a dark one. */
export function nativeAppearance(theme: ThemeDefinition): Appearance {
  return canvasSurface(theme.backgroundColor) === 'dark' ? 'dark' : 'light';
}

function moveTo(hex: string, role: Role, target: Appearance): string {
  const o = hexOklch(hex);
  if (!o) return hex;
  const t = ROLE_TARGETS[target][role];
  return oklchHex(t.l, Math.min(o.c * t.keep, t.max), o.h);
}

/** `fg` with its lightness walked away from `bg` until it reaches `min` contrast (or the end of the range). */
function reachContrast(fg: string, bg: string, min: number): string {
  if (contrastRatio(fg, bg) >= min) return fg;
  const o = hexOklch(fg);
  const b = hexOklch(bg);
  if (!o || !b) return fg;
  const step = b.l >= 0.6 ? -0.02 : 0.02;
  let l = o.l;
  let out = fg;
  for (let i = 0; i < 50; i++) {
    l = Math.min(1, Math.max(0, l + step));
    out = oklchHex(l, o.c, o.h);
    if (contrastRatio(out, bg) >= min || l === 0 || l === 1) break;
  }
  return out;
}

type Paint = { fill?: string | null; stroke?: string | null; text?: string | null };

// One paint (fill, outline, text) moved into an appearance, or kept, then tuned against the canvas.
function paintIn<P extends Paint>(p: P, background: string, target: Appearance | null): P {
  const fill = p.fill ? (target ? moveTo(p.fill, 'fill', target) : p.fill) : p.fill;
  const stroke = p.stroke ? (target ? moveTo(p.stroke, 'stroke', target) : p.stroke) : p.stroke;
  const text = p.text ? (target ? moveTo(p.text, 'text', target) : p.text) : p.text;
  return {
    ...p,
    ...(fill !== undefined ? { fill } : {}),
    ...(stroke ? { stroke: reachContrast(stroke, background, THEME_LINE_CONTRAST) } : {}),
    ...(text ? { text: reachContrast(text, fill || background, THEME_TEXT_CONTRAST) } : {}),
  };
}

// The theme in an appearance: moved there when `target` is given, kept otherwise, and tuned either way.
function buildHalf(theme: ThemeDefinition, target: Appearance | null): ThemeDefinition {
  const background = target
    ? moveTo(theme.backgroundColor, 'background', target)
    : theme.backgroundColor;
  const patternColor = target ? moveTo(theme.patternColor, 'pattern', target) : theme.patternColor;
  const base = paintIn(
    { fill: theme.elementFill, stroke: theme.elementStroke, text: theme.elementText },
    background,
    target,
  );
  const half: ThemeDefinition = {
    ...theme,
    backgroundColor: background,
    patternColor,
    elementFill: base.fill ?? null,
    elementStroke: base.stroke ?? null,
    elementText: base.text ?? null,
  };
  if (theme.palette) half.palette = theme.palette.map((p) => paintIn(p, background, target));
  if (theme.rootColor) half.rootColor = paintIn(theme.rootColor, background, target);
  if (theme.shapeColors) {
    half.shapeColors = Object.fromEntries(
      Object.entries(theme.shapeColors).map(([kind, c]) => [
        kind,
        c ? paintIn(c, background, target) : c,
      ]),
    ) as Partial<Record<ShapeKind, NonNullable<ThemeDefinition['shapeColors']>[ShapeKind]>>;
  }
  return half;
}

const HALVES = new WeakMap<ThemeDefinition, Partial<Record<Appearance, ThemeDefinition>>>();

/** A theme in the viewer's appearance: its native half (tuned) or its derived other half. Default keeps its own two
 *  hand-made halves. */
export function themeHalf(theme: ThemeDefinition, appearance: Appearance): ThemeDefinition {
  if (theme.id === DEFAULT_SCHEME_ID) return defaultScheme(appearance);
  const cached = HALVES.get(theme)?.[appearance];
  if (cached) return cached;
  const half = buildHalf(theme, appearance === nativeAppearance(theme) ? null : appearance);
  HALVES.set(theme, { ...HALVES.get(theme), [appearance]: half });
  return half;
}

// Every colour slot a theme paints, read from one definition, in priority order: element paints first (so a colour
// shared with the canvas maps as an element colour), then the palette, the root, the shape kinds, then the backdrop.
function slots(theme: ThemeDefinition): (string | null | undefined)[] {
  const out: (string | null | undefined)[] = [
    theme.elementFill,
    theme.elementStroke,
    theme.elementText,
  ];
  for (const p of theme.palette ?? []) out.push(p.fill, p.stroke, p.text);
  if (theme.rootColor) out.push(theme.rootColor.fill, theme.rootColor.stroke, theme.rootColor.text);
  for (const kind of Object.keys(theme.shapeColors ?? {}).sort()) {
    const c = theme.shapeColors?.[kind as ShapeKind];
    out.push(c?.fill, c?.stroke, c?.text);
  }
  out.push(theme.backgroundColor, theme.patternColor);
  return out;
}

const MAPS = new WeakMap<
  ThemeDefinition,
  Partial<Record<Appearance, ReadonlyMap<string, string>>>
>();

/** Every colour the theme paints, in either half (and as written, before tuning), mapped to the same slot in
 *  `appearance`'s half. Keys are lower case. A colour not in the map is someone's choice and is drawn as it is. */
export function themeColourMap(
  theme: ThemeDefinition,
  appearance: Appearance,
): ReadonlyMap<string, string> {
  const cached = MAPS.get(theme)?.[appearance];
  if (cached) return cached;
  const target = slots(themeHalf(theme, appearance));
  const sources = [slots(theme), slots(themeHalf(theme, 'light')), slots(themeHalf(theme, 'dark'))];
  const map = new Map<string, string>();
  for (const source of sources) {
    source.forEach((from, i) => {
      const to = target[i];
      if (!from || !to) return;
      const key = from.toLowerCase();
      if (!map.has(key)) map.set(key, to);
    });
  }
  // Then the theme's colour presets (Soft, Tinted, a branch card, ...), each mapped to the same preset in the
  // target half, so a preset-styled shape follows the viewer's half too.
  const targetPresets = new Map(
    shapeColorPresets(themeHalf(theme, appearance)).map((p) => [p.id, p] as const),
  );
  for (const half of [theme, themeHalf(theme, 'light'), themeHalf(theme, 'dark')]) {
    for (const p of shapeColorPresets(half)) {
      const to = targetPresets.get(p.id);
      if (!to) continue;
      for (const k of ['fill', 'stroke', 'text'] as const) {
        const key = p[k].toLowerCase();
        if (!map.has(key)) map.set(key, to[k]);
      }
    }
  }
  MAPS.set(theme, { ...MAPS.get(theme), [appearance]: map });
  return map;
}

// The element colour fields a theme paints (any element kind), which a viewer's half redraws.
const VIEWED_FIELDS = ['fillColor', 'strokeColor', 'textColor', 'arrowheadColor'] as const;

/** An element drawn in a theme half: each colour that is one of the theme's (per `map`, from themeColourMap) becomes
 *  that slot's colour in the half; any other colour is someone's choice and stays. The same object when nothing
 *  changes, so a memoised view keeps its identity. */
export function viewElementInTheme<T extends object>(el: T, map: ReadonlyMap<string, string>): T {
  if (map.size === 0) return el;
  let patch: Record<string, string> | null = null;
  for (const field of VIEWED_FIELDS) {
    const value = (el as Record<string, unknown>)[field];
    if (typeof value !== 'string') continue;
    const to = map.get(value.toLowerCase());
    if (to && to !== value) (patch ??= {})[field] = to;
  }
  if (patch && breaksTextPair(el as Record<string, unknown>, patch)) {
    delete patch.fillColor;
    delete patch.textColor;
    if (Object.keys(patch).length === 0) patch = null;
  }
  return patch ? { ...el, ...patch } : el;
}

// A box's text and fill are drawn as a pair (docs/specs/011-theme/light-and-dark.md "What a viewer sees"): redrawing
// only one of them (a template's white box under its own slate text) can sink the text into its fill. True when the
// view would put the text on its fill below the floor and read worse than the stored pair; the box then keeps both.
function breaksTextPair(el: Record<string, unknown>, patch: Record<string, string>): boolean {
  if (!('fillColor' in patch) && !('textColor' in patch)) return false;
  const fill = el.fillColor;
  const text = el.textColor;
  if (typeof fill !== 'string' || typeof text !== 'string') return false;
  const viewed = pairContrast(patch.textColor ?? text, patch.fillColor ?? fill);
  return viewed < THEME_TEXT_CONTRAST && viewed < pairContrast(text, fill);
}

/** How many text-on-fill ratios the canvas keeps: a tab's boxes repeat a handful of pairs, so a small cache answers
 *  nearly every draw (5,000 boxes: 70 ms of luminance maths uncached). Cleared whole when full; safe range 64..4096. */
const PAIR_CONTRAST_CACHE_SIZE = 512;
const PAIR_CONTRAST = new Map<string, number>();

function pairContrast(text: string, fill: string): number {
  const key = `${text}|${fill}`;
  let ratio = PAIR_CONTRAST.get(key);
  if (ratio === undefined) {
    if (PAIR_CONTRAST.size >= PAIR_CONTRAST_CACHE_SIZE) PAIR_CONTRAST.clear();
    ratio = contrastRatio(text, fill);
    PAIR_CONTRAST.set(key, ratio);
  }
  return ratio;
}

/** A stored backdrop drawn in a theme half: a canvas or pattern colour the theme painted, in either half, becomes the
 *  half's; a colour someone picked stays. */
export function viewBackdropInTheme(
  backdrop: { backgroundColor: string; patternColor: string },
  theme: ThemeDefinition,
  appearance: Appearance,
): { backgroundColor: string; patternColor: string } {
  const halves = [theme, themeHalf(theme, 'light'), themeHalf(theme, 'dark')];
  const target = themeHalf(theme, appearance);
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const bgOnTheme = halves.some((h) => same(h.backgroundColor, backdrop.backgroundColor));
  const patternOnTheme = halves.some((h) => same(h.patternColor, backdrop.patternColor));
  return {
    backgroundColor: bgOnTheme ? target.backgroundColor : backdrop.backgroundColor,
    patternColor: patternOnTheme ? target.patternColor : backdrop.patternColor,
  };
}
