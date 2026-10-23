// Theme metadata (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel"): the per-theme description blurbs
// shown on the theme cards. Pure catalogue data plus its lookup, split out of themes.ts (the recolouring engine) — this
// is consumed by the theme-picker UI, not by element recolouring, so it stands
// on its own. Type-only imports from ./themes (erased at build, no cycle).
import type { ThemeId } from './themes';

// Short, user-facing blurb per built-in theme, shown under the label on
// the picker's theme cards (docs/specs/007-editor/new-document-route.md). A `Record<ThemeId, string>` so the
// compiler forces every theme to carry one: add a ThemeId without a line
// here and the build fails, which is how this can't drift from THEMES.
// Custom themes have no entry (their card shows just the saved name).
const THEME_DESCRIPTIONS: Record<ThemeId, string> = {
  // The one scheme whose blurb describes a BEHAVIOUR rather than a palette:
  // Default is the same entry in both halves, and which you see is your own
  // appearance (docs/specs/007-editor/editor-app.md).
  brand: 'Light or dark, following your appearance.',
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
  plum: 'Soft violets on deep plum.',
  abyss: 'Aqua tones on deep teal.',
  espresso: 'Warm tan on dark-roast brown.',
  rainbow: 'A different hue per branch.',
  pastel: 'Soft multi-colour, a hue per branch.',
  tropical: 'Bright, summery hues per branch.',
  uml: 'Standard notation, each shape its colour.',
  sparkle: 'Gold on a midnight navy.',
  spring: 'Painted-egg pastels, a hue per branch.',
  pumpkin: 'Orange, purple and green on a moonless night.',
  yuletide: 'Holly red, pine green and tinsel gold.',
  frost: 'Icy blues on fresh snow.',
  evergreen: 'Berry red on deep fir green.',
};

// The blurb for a theme id, or undefined for an unknown / custom id.
export function themeDescription(id: string): string | undefined {
  return (THEME_DESCRIPTIONS as Record<string, string>)[id];
}
