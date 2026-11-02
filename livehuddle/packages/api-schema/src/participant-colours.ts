// The colour an identity takes when it has none of its own: a profile whose colour was never set
// (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles", `color` null), or a team member row keyed by email.
// It comes from liveworkspace's one presence palette (@liveworkspace/settings PRESENCE_COLOURS), the
// same in every app. Shared by the api worker, which fills in a missing colour, and the editor,
// which picks a fresh one from the same palette.

import { fnv1aString } from '@livehuddle/document';
import { PRESENCE_COLOUR_VALUES } from '@liveworkspace/settings';

// Deterministic palette pick: same key, same colour, every render and every device. FNV-1a over the
// key, mapped onto the palette.
export function colorForKey(key: string): string {
  // `| 0` reads the hash as signed, the way colours have always been picked, so no key changes colour.
  return PRESENCE_COLOUR_VALUES[Math.abs(fnv1aString(key) | 0) % PRESENCE_COLOUR_VALUES.length]!;
}
