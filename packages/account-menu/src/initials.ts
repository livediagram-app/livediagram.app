import { PRESENCE_COLOURS, type PresenceColour } from '@liveworkspace/settings/presence';

// The words of a name, or of an email's local part (`ada.lovelace@…`, `ada_lovelace`).
function wordsOf(name: string): string[] {
  const trimmed = name.trim();
  const local = trimmed.includes('@') && !/\s/.test(trimmed) ? trimmed.split('@')[0]! : trimmed;
  return local.split(/[\s._-]+/).filter(Boolean);
}

// A person's initials, for their avatar (accounts keep no pictures): always two letters where the name has
// them, the first letters of their first and last names, or the first two of the one name they gave.
export function initials(name: string): string {
  const parts = wordsOf(name);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return [...parts[0]!].slice(0, 2).join('').toUpperCase();
  return ([...parts[0]!][0]! + [...parts[parts.length - 1]!][0]!).toUpperCase();
}

// The avatar's colour: one of the presence colours, picked from the name, so the same person has the same disc
// in every app and on every visit.
export function avatarColour(name: string): PresenceColour {
  let hash = 0;
  for (const ch of name.trim().toLowerCase()) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return PRESENCE_COLOURS[hash % PRESENCE_COLOURS.length]!;
}
