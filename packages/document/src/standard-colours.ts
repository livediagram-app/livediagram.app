// The standard colours (docs/specs/004-interface-design/colour-picker.md "The colours"): the same
// ten named colours in every colour picker, in two tones. The strong tone is the marker stock set
// plus Grey, tuned per surface (penColourHex). The soft tone is the same hues as washes, pale on
// light paper and deep on dark, with White in Ink's place, for fills, backgrounds and highlights.
// Built once at module load.

import {
  GREY_PEN_COLOUR,
  INK_PEN_COLOUR,
  PEN_COLOURS,
  oklchHex,
  penColourHex,
  penColourLabel,
  type PenColourName,
} from './pen-colours';
import type { Appearance } from './themes';

export const STANDARD_COLOUR_NAMES = [
  INK_PEN_COLOUR,
  GREY_PEN_COLOUR,
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'violet',
  'pink',
] as const satisfies readonly PenColourName[];
export type StandardColourName = (typeof STANDARD_COLOUR_NAMES)[number];

/** Which version of the standard colours a picker offers: lines and text, or fills. */
export type StandardTone = 'strong' | 'soft';

export type StandardColour = { name: StandardColourName; label: string; hex: string };

// The soft tone's lightness per surface: Tailwind 100-200 on light paper, 800-900 on dark.
// Safe ranges 0.88 to 0.96 (light) and 0.28 to 0.4 (dark).
export const SOFT_LIGHTNESS: Readonly<Record<Appearance, number>> = { light: 0.93, dark: 0.34 };
// How much of the strong chroma a wash keeps, and its ceiling: Tailwind 200's chroma, so a wash
// stays pastel. Safe ranges 0.3 to 0.6 and 0.05 to 0.1.
export const SOFT_CHROMA_SCALE = 0.45;
export const SOFT_MAX_CHROMA = 0.08;
// Ink's soft counterpart: a white wash is a real fill; an ink-coloured one is not.
export const SOFT_WHITE = '#ffffff';

function softHex(name: StandardColourName, appearance: Appearance): string {
  if (name === INK_PEN_COLOUR) return SOFT_WHITE;
  const spec = PEN_COLOURS.find((c) => c.id === name);
  const chroma = spec ? Math.min(spec.chroma * SOFT_CHROMA_SCALE, SOFT_MAX_CHROMA) : 0;
  return oklchHex(SOFT_LIGHTNESS[appearance], chroma, spec?.hue ?? 0);
}

function build(tone: StandardTone, appearance: Appearance): readonly StandardColour[] {
  return STANDARD_COLOUR_NAMES.map((name) => ({
    name,
    label: tone === 'soft' && name === INK_PEN_COLOUR ? 'White' : penColourLabel(name),
    hex: tone === 'strong' ? penColourHex(name, appearance) : softHex(name, appearance),
  }));
}

const TABLES: Readonly<
  Record<StandardTone, Readonly<Record<Appearance, readonly StandardColour[]>>>
> = {
  strong: { light: build('strong', 'light'), dark: build('strong', 'dark') },
  soft: { light: build('soft', 'light'), dark: build('soft', 'dark') },
};

/** The ten standard colours in a tone, each in its version for a surface. */
export function standardColours(
  tone: StandardTone,
  appearance: Appearance,
): readonly StandardColour[] {
  return TABLES[tone][appearance];
}

export type StandardColourHit = {
  name: StandardColourName;
  label: string;
  tone: StandardTone;
  appearance: Appearance;
};

const BY_HEX: ReadonlyMap<string, StandardColourHit> = new Map(
  (['strong', 'soft'] as const).flatMap((tone) =>
    (['light', 'dark'] as const).flatMap((appearance) =>
      TABLES[tone][appearance].map(
        (c) => [c.hex.toLowerCase(), { name: c.name, label: c.label, tone, appearance }] as const,
      ),
    ),
  ),
);

/** Which standard colour a `#rrggbb` is, in any tone and version, or null. */
export function standardColourAt(hex: string): StandardColourHit | null {
  return BY_HEX.get(hex.toLowerCase()) ?? null;
}

/** A `#rrggbb` colour: the one hex shape colours are stored and compared in. */
export function isHexColour(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
}
