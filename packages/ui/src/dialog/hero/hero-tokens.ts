// The dialog hero header's colours (liveworkspace/docs/specs/004-index/dialog-hero-header.md "Colour"): every one a
// share of the host's brand ramp mixed into the dialog's own ground (white in light, slate 900 in dark), so the band
// takes each product's accent, and a themed tab's (useEditorAccent retints the ramp under body-portaled dialogs too),
// with no palette in JS. The recipes are data so the contrast test (hero-tokens.test.ts) resolves the very same
// mixes against every product's ramp; heroTokenStyle writes them as CSS custom properties on the header, each a
// `light-dark()` pair that follows the `color-scheme` the header sets from the app's `.dark` class.
import type { CSSProperties } from 'react';

/** What a token mixes: a stop of the brand ramp, or a slate stop as it is. */
export type HeroInk =
  | { brand: number; share: number; into: 'ground' }
  | { slate: number }
  | { ground: true }
  | { slate: number; share: number; into: 'ground' };

export type HeroTokenName =
  'paper' | 'soft' | 'wash' | 'faint' | 'line' | 'mark' | 'accent' | 'plate' | 'ink' | 'muted';

/** A token's recipe in light and in dark. */
export type HeroRecipe = { light: HeroInk; dark: HeroInk };

// The ground a dialog's panel paints (Dialog.tsx: bg-white, dark:bg-slate-900).
const GROUND = { light: 'white', dark: 'var(--color-slate-900)' } as const;

// The light shares are the start band's (start-band-colours.ts BAND_SHARES) over brand 600, the accent a light
// screen shows; the dark ones over brand 400, the accent dark lifts to. So Automations kept its look on the move.
export const HERO_TOKENS: Record<HeroTokenName, HeroRecipe> = {
  /** The band's ground. */
  paper: {
    light: { brand: 600, share: 0.06, into: 'ground' },
    dark: { brand: 400, share: 0.1, into: 'ground' },
  },
  /** A shade deeper: alternate lanes, a soft plate. */
  soft: {
    light: { brand: 600, share: 0.1, into: 'ground' },
    dark: { brand: 400, share: 0.15, into: 'ground' },
  },
  /** Deeper again: the title mark's tile, solid pieces that sit back. */
  wash: {
    light: { brand: 600, share: 0.15, into: 'ground' },
    dark: { brand: 400, share: 0.22, into: 'ground' },
  },
  /** The textures' fine lines (a grid, rings, the band's foot). */
  faint: {
    light: { brand: 600, share: 0.14, into: 'ground' },
    dark: { brand: 400, share: 0.16, into: 'ground' },
  },
  /** The textures' dots and heavier lines; outlines of plates. */
  line: {
    light: { brand: 600, share: 0.24, into: 'ground' },
    dark: { brand: 400, share: 0.26, into: 'ground' },
  },
  /** The art's strokes: dashed paths, a diamond's edge. */
  mark: {
    light: { brand: 600, share: 0.45, into: 'ground' },
    dark: { brand: 400, share: 0.5, into: 'ground' },
  },
  /** The one accent: the title mark's glyph, a small solid piece, the ring that spreads. */
  accent: {
    light: { brand: 600, share: 1, into: 'ground' },
    dark: { brand: 400, share: 1, into: 'ground' },
  },
  /** A card or pass lifted off the band. */
  plate: { light: { ground: true }, dark: { slate: 100, share: 0.1, into: 'ground' } },
  /** The title. */
  ink: { light: { slate: 900 }, dark: { slate: 100 } },
  /** The line under the title. */
  muted: { light: { slate: 600 }, dark: { slate: 400 } },
};

/** WCAG AA for body text: the title and its line reach it on the paper and the soft, light and dark. */
export const HERO_INK_CONTRAST = 4.5;

/** The grounds words may sit on: the paper, and a soft patch (a lane). The wash is for the mark and solid pieces. */
export const HERO_GROUNDS = ['paper', 'soft'] as const satisfies readonly HeroTokenName[];

const pct = (share: number) => `${Math.round(share * 1000) / 10}%`;

function css(ink: HeroInk, mode: 'light' | 'dark'): string {
  const ground = GROUND[mode];
  if ('ground' in ink) return ground;
  const stop =
    'brand' in ink ? `var(--color-brand-${ink.brand})` : `var(--color-slate-${ink.slate})`;
  if (!('share' in ink) || ink.share === 1) return stop;
  // sRGB, so the test's plain channel mix is exactly what the browser paints.
  return `color-mix(in srgb, ${stop} ${pct(ink.share)}, ${ground})`;
}

/** The custom property a token is read by: `fill="var(--hero-wash)"`. */
export const heroVar = (name: HeroTokenName) => `var(--hero-${name})`;

/** Every token as a custom property, light and dark in one value. Built once: the header passes the same object. */
export const HERO_TOKEN_STYLE = Object.fromEntries(
  (Object.entries(HERO_TOKENS) as [HeroTokenName, HeroRecipe][]).map(([name, r]) => [
    `--hero-${name}`,
    `light-dark(${css(r.light, 'light')}, ${css(r.dark, 'dark')})`,
  ]),
) as CSSProperties;

/** A ramp as hex by stop, as a product's tailwind-config declares it. */
export type HeroRamp = Readonly<Record<number, string>>;

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, share: number): string {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  const c = (x: number, y: number) => Math.round(x * share + y * (1 - share));
  return `#${[c(ar, br), c(ag, bg), c(ab, bb)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** The tokens as hex for a brand ramp and slate ramp in one mode: what the browser paints, for the contrast test. */
export function resolveHeroTokens(
  mode: 'light' | 'dark',
  brand: HeroRamp,
  slate: HeroRamp,
): Record<HeroTokenName, string> {
  const ground = mode === 'light' ? '#ffffff' : slate[900]!;
  const hex = (ink: HeroInk): string => {
    if ('ground' in ink) return ground;
    const stop = 'brand' in ink ? brand[ink.brand]! : slate[ink.slate]!;
    return 'share' in ink ? mix(stop, ground, ink.share) : stop;
  };
  return Object.fromEntries(
    (Object.entries(HERO_TOKENS) as [HeroTokenName, HeroRecipe][]).map(([name, r]) => [
      name,
      hex(r[mode]),
    ]),
  ) as Record<HeroTokenName, string>;
}
