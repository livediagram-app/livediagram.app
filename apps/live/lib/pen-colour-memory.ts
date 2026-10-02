// Your colours (docs/specs/023-draw-mode/draw-mode.md "The colour picker"): the custom colours a
// user has used with the markers, up to eight, newest first; using one moves it to the front. They
// live in the user's synced preferences (lib/user-preferences.ts), read through here, never
// directly: a stored value is only trusted once parsed.
import { isCustomPenColour, type PenColour } from '@livediagram/document';
import type { UserPreferences } from './user-preferences';

export const YOUR_COLOURS_MAX = 8;

export type PenColourMemory = {
  // Custom hexes, lower case, newest first.
  yours: string[];
};

const customOf = (v: unknown): string | null => (isCustomPenColour(v) ? v.toLowerCase() : null);

export function readPenColourMemory(prefs: UserPreferences): PenColourMemory {
  const raw = prefs.whiteboardYourColours;
  const yours: string[] = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    const hex = customOf(v);
    if (hex && !yours.includes(hex)) yours.push(hex);
    if (yours.length === YOUR_COLOURS_MAX) break;
  }
  return { yours };
}

/**
 * The memory after a colour was used: a custom one goes to the front of Your colours; the ink or a
 * stock colour changes nothing. The same object when nothing changes.
 */
export function rememberPenColour(
  memory: PenColourMemory,
  colour: PenColour | null,
): PenColourMemory {
  const hex = customOf(colour);
  if (hex === null || memory.yours[0] === hex) return memory;
  return { yours: [hex, ...memory.yours.filter((c) => c !== hex)].slice(0, YOUR_COLOURS_MAX) };
}

/**
 * The memory without a custom colour (its Remove): strokes drawn in it and a marker set to it keep
 * it. The same object when it was not there.
 */
export function forgetPenColour(memory: PenColourMemory, colour: string): PenColourMemory {
  const hex = colour.toLowerCase();
  return memory.yours.includes(hex) ? { yours: memory.yours.filter((c) => c !== hex) } : memory;
}

export function withPenColourMemory(
  prefs: UserPreferences,
  memory: PenColourMemory,
): UserPreferences {
  return { ...prefs, whiteboardYourColours: memory.yours };
}
