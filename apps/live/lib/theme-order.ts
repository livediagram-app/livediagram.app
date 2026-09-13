import type { ThemeDefinition, ThemeId } from '@livediagram/diagram';
import { shufflePinned } from './shuffle';

// Which themes LEAD, whatever the shuffle does (spec/09).
//
// The theme browser deliberately shuffles, so a different set greets the user
// on each open. Two themes are exempt, because they are the ones a reader
// measures the others against:
//
//   - Basic leads the catalogue: the un-themed default.
//   - Charcoal leads the Dark category: the NEUTRAL dark (greys on
//     near-black, no hue). It is what most people mean by "dark", and the
//     tinted darks — Midnight's blue, Pine's green, Plum's purple — read as
//     variations on it.
//
// `shufflePinned` keeps pinned entries at the front in catalogue order, so a
// category filtered out of the result still sees its lead first.
export const LEAD_THEME_IDS = ['brand', 'charcoal'] as const satisfies readonly ThemeId[];

const LEADS: ReadonlySet<string> = new Set(LEAD_THEME_IDS);

export function isLeadTheme(id: string): boolean {
  return LEADS.has(id);
}

export function shuffledThemes(themes: ThemeDefinition[], rng?: () => number): ThemeDefinition[] {
  return shufflePinned(themes, (t) => isLeadTheme(t.id), rng);
}
