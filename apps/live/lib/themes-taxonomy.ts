// Theme taxonomy + metadata (spec/14): the per-theme description blurbs and the
// colour-temperament categories the picker buckets themes into. Pure catalogue
// data plus its lookups, split out of themes.ts (the recolouring engine) — this
// is consumed by the theme-picker UI, not by element recolouring, so it stands
// on its own. Type-only imports from ./themes (erased at build, no cycle).
import type { ThemeId, ThemeCategory } from './themes';

// Short, user-facing blurb per built-in theme, shown under the label on
// the picker's theme cards (spec/14). A `Record<ThemeId, string>` so the
// compiler forces every theme to carry one: add a ThemeId without a line
// here and the build fails, which is how this can't drift from THEMES.
// Custom themes have no entry (their card shows just the saved name).
const THEME_DESCRIPTIONS: Record<ThemeId, string> = {
  brand: 'The plain, un-themed default.',
  slate: 'Soft pinks on a blush canvas.',
  forest: 'Deep greens on a leafy canvas.',
  sunset: 'Warm oranges and burnt amber.',
  lavender: 'Gentle purples on pale violet.',
  mono: 'Crisp black on white, no grid.',
  ocean: 'Cool cyans on a sea-glass canvas.',
  sky: 'Bright blues on a clear canvas.',
  midnight: 'Light slate on deep navy.',
  cream: 'Golden tones on warm ivory.',
  rose: 'Rich reds on a soft pink canvas.',
  sand: 'Neutral stone and warm greys.',
  olive: 'Muted greens on a pale lime canvas.',
  indigo: 'Deep indigo on a cool canvas.',
  pine: 'Light foliage on forest green.',
  steel: 'Cool greys with a slate edge.',
  mocha: 'Coffee browns on warm cream.',
  charcoal: 'Neutral greys on near-black.',
  plum: 'Soft violets on deep plum.',
  abyss: 'Aqua tones on deep teal.',
  espresso: 'Warm tan on dark-roast brown.',
  rainbow: 'A different hue per branch.',
  pastel: 'Soft multi-colour, a hue per branch.',
  tropical: 'Bright, summery hues per branch.',
  autumn: 'Warm reds, golds and browns.',
  jewel: 'Rich, saturated gem tones.',
  uml: 'Standard notation, each shape its colour.',
};

// The blurb for a theme id, or undefined for an unknown / custom id.
export function themeDescription(id: string): string | undefined {
  return (THEME_DESCRIPTIONS as Record<string, string>)[id];
}

export const THEME_CATEGORIES: { id: ThemeCategory; label: string; description: string }[] = [
  { id: 'formal', label: 'Formal', description: 'Standard notations like UML.' },
  { id: 'cool', label: 'Cool', description: 'Blues, greens and purples.' },
  { id: 'warm', label: 'Warm', description: 'Reds, oranges and earthy tones.' },
  { id: 'dark', label: 'Dark', description: 'Dark-backdrop themes.' },
  { id: 'multicolour', label: 'Multi-colour', description: 'A different hue per branch.' },
];

const THEME_CATEGORY: Record<ThemeId, ThemeCategory> = {
  // Cool: blues / greens / purples, plus the greyscale Mono.
  brand: 'cool',
  forest: 'cool',
  ocean: 'cool',
  sky: 'cool',
  lavender: 'cool',
  indigo: 'cool',
  steel: 'cool',
  mono: 'cool',
  // Warm: reds / oranges / pinks / earthy browns.
  slate: 'warm', // legacy id, now the Pink theme
  sunset: 'warm',
  rose: 'warm',
  cream: 'warm',
  sand: 'warm',
  mocha: 'warm',
  olive: 'warm',
  // Dark: dark-backdrop themes.
  midnight: 'dark',
  charcoal: 'dark',
  pine: 'dark',
  plum: 'dark',
  abyss: 'dark',
  espresso: 'dark',
  // Multi-colour "rainbow" themes (spec/29).
  rainbow: 'multicolour',
  pastel: 'multicolour',
  tropical: 'multicolour',
  autumn: 'multicolour',
  jewel: 'multicolour',
  // Formal notations.
  uml: 'formal',
};

export function themeCategory(id: ThemeId): ThemeCategory {
  return THEME_CATEGORY[id];
}
