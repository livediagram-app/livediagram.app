// The presence colours every app offers (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles"): the colour
// collaborators see on a person's cursor, comments and avatar, in every app and on liveworkspace.app.
// One palette, so a colour picked in one place is a named swatch in all of them. Each is a Tailwind
// 500 step, painted exactly in light mode; under white text in dark mode, where white falls below AA
// on every one of them, each is painted in its own 700 step, `deep`.

export interface PresenceColour {
  // The stored colour, lower-case #rrggbb, as a profile keeps it.
  value: string;
  // Its dark-mode shade, for a fill under white text.
  deep: string;
  name: string;
}

// In the apps' order: an app with no colour of its own for someone picks from these in turn.
export const PRESENCE_COLOURS: readonly PresenceColour[] = [
  { value: '#0ea5e9', deep: '#0369a1', name: 'Sky' },
  { value: '#10b981', deep: '#047857', name: 'Emerald' },
  { value: '#f59e0b', deep: '#b45309', name: 'Amber' },
  { value: '#ef4444', deep: '#b91c1c', name: 'Red' },
  { value: '#8b5cf6', deep: '#6d28d9', name: 'Violet' },
  { value: '#ec4899', deep: '#be185d', name: 'Pink' },
  { value: '#14b8a6', deep: '#0f766e', name: 'Teal' },
  { value: '#f97316', deep: '#c2410c', name: 'Orange' },
  { value: '#6366f1', deep: '#4338ca', name: 'Indigo' },
  { value: '#84cc16', deep: '#4d7c0f', name: 'Lime' },
];

// Just the colours, in the same order: what an app's PARTICIPANT_COLORS picks from.
export const PRESENCE_COLOUR_VALUES: readonly string[] = PRESENCE_COLOURS.map((c) => c.value);

const BY_VALUE = new Map(PRESENCE_COLOURS.map((c) => [c.value, c]));

// The palette's entry for a colour, in any case; undefined for one that isn't in it (a custom colour,
// or none).
export function presenceColour(color: string | null | undefined): PresenceColour | undefined {
  return color ? BY_VALUE.get(color.toLowerCase()) : undefined;
}

// The colour a person on Automatic (a profile with no colour of its own) wears, picked from the name collaborators see
// (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles", "Automatic"). The one rule for it: every avatar,
// cursor and author dot in every app and on liveworkspace.app, so one person is one colour everywhere. A hash of the
// trimmed, lower-cased name, so " Ada " and "ada" match; the same name always lands on the same colour.
export function automaticPresenceColour(name: string): PresenceColour {
  let hash = 0;
  for (const ch of name.trim().toLowerCase()) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return PRESENCE_COLOURS[hash % PRESENCE_COLOURS.length]!;
}

const HEX = /^#[0-9a-f]{6}$/i;

// A person's colour where a chosen one may ride along (a team member's `color`, an action's `assignee.color`): that
// colour when it is a #rrggbb, else the Automatic one picked from the name. Anything else in `color` (a stray value in a
// document blob) falls back, so it never reaches a style.
export function presenceColourOf(name: string, color: string | null | undefined): string {
  return color && HEX.test(color) ? color.toLowerCase() : automaticPresenceColour(name).value;
}

// The display name's limit, as the accounts Worker keeps it (liveworkspace/apps/accounts src/profiles.ts
// PROFILE_NAME_MAX), for the Settings panel's Profile field.
export const PROFILE_NAME_MAX = 120;

/** A display name as it would be stored: trimmed, and empty meaning "no name of my own" (the account's shows). */
export function cleanProfileName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed ? trimmed : null;
}
