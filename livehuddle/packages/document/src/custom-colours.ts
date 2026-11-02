// A tab's custom colours (docs/specs/004-interface-design/colour-picker.md "Custom colours"): the
// colours someone picked with + in the colour picker, newest first, kept with the tab so every
// collaborator's pickers show them. Never derived from what the tab holds: a template or a theme
// writes its own hexes onto elements, and those are not anyone's pick.
import type { Tab } from './index';
import { isHexColour } from './standard-colours';

// How many a tab keeps; the picker shows at most this many across the document too.
export const CUSTOM_COLOURS_MAX = 12;

/** A tab's custom colours as stored: lower-case `#rrggbb`, deduped, capped; anything else dropped. */
export function customColoursOf(tab: Pick<Tab, 'customColours'>): string[] {
  const raw = Array.isArray(tab.customColours) ? tab.customColours : [];
  const out: string[] = [];
  for (const c of raw) {
    if (!isHexColour(c)) continue;
    const hex = c.toLowerCase();
    if (!out.includes(hex)) out.push(hex);
    if (out.length >= CUSTOM_COLOURS_MAX) break;
  }
  return out;
}

/**
 * The tab with `hex` as its newest custom colour (moved to the front if already there), capped.
 * Returns the tab itself when `hex` is not a colour or is already newest, so nothing re-renders.
 */
export function withCustomColour<T extends Pick<Tab, 'customColours'>>(tab: T, hex: string): T {
  if (!isHexColour(hex)) return tab;
  const colour = hex.toLowerCase();
  const now = customColoursOf(tab);
  if (now[0] === colour) return tab;
  const next = [colour, ...now.filter((c) => c !== colour)].slice(0, CUSTOM_COLOURS_MAX);
  return { ...tab, customColours: next };
}
