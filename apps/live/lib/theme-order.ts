import {
  DEFAULT_SCHEME_DARK,
  DEFAULT_SCHEME_ID,
  type ThemeDefinition,
  type ThemeId,
} from '@livediagram/diagram';
import { shufflePinned } from './shuffle';
import { themeCategory } from './themes-taxonomy';

// Which themes LEAD, whatever the shuffle does (spec/09).
//
// The scheme browser deliberately shuffles, so a different set greets the user
// on each open. Default is exempt, because it is the one a reader measures the
// others against: the un-themed canvas, and the scheme a tab has until someone
// picks otherwise.
//
// `shufflePinned` keeps pinned entries at the front in catalogue order, so a
// category filtered out of the result still sees its lead first.
export const LEAD_THEME_IDS = [DEFAULT_SCHEME_ID] as const satisfies readonly ThemeId[];

const LEADS: ReadonlySet<string> = new Set(LEAD_THEME_IDS);

export function isLeadTheme(id: string): boolean {
  return LEADS.has(id);
}

export function shuffledThemes(themes: ThemeDefinition[], rng?: () => number): ThemeDefinition[] {
  return shufflePinned(themes, (t) => isLeadTheme(t.id), rng);
}

// The Dark category's list: the dark canvases, led by DEFAULT — the same
// scheme that leads the catalogue, appearing a second time in the slot
// Charcoal held before the two merged. It leads for the reason Charcoal did:
// it is the NEUTRAL dark (greys on near-black, no hue), so the tinted darks —
// Midnight's blue, Pine's green, Plum's purple — read as variations on it.
//
// Its card previews the DARK half regardless of the reader's own chrome: the
// card sits among dark canvases and is showing what the scheme looks like
// there. Picking it stores the one Default id either way.
export function darkCategorySchemes(themes: ThemeDefinition[]): ThemeDefinition[] {
  return [
    DEFAULT_SCHEME_DARK,
    ...themes.filter((t) => t.id !== DEFAULT_SCHEME_ID && themeCategory(t.id) === 'dark'),
  ];
}
