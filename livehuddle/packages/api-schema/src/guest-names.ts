// The two-word names a person without one of their own goes by, "Quiet Otter" (docs/specs/014-identity/
// auth-and-guest-access.md "Presence names"). Shared by the editor, which rolls a random one as a guest's first
// profile name, and the room, which gives a session it has no name for one picked from its collab key: the same
// browser (or person) is the same guest every time, so a reload never renames them.

import { fnv1aString } from '@livehuddle/document';

export const GUEST_NAME_ADJECTIVES = [
  'Curious',
  'Bright',
  'Witty',
  'Calm',
  'Eager',
  'Brave',
  'Clever',
  'Daring',
  'Gentle',
  'Lively',
  'Merry',
  'Nimble',
  'Quick',
  'Quiet',
  'Sunny',
  'Swift',
] as const;

export const GUEST_NAME_ANIMALS = [
  'Falcon',
  'Walrus',
  'Otter',
  'Lynx',
  'Heron',
  'Badger',
  'Marlin',
  'Fox',
  'Hawk',
  'Newt',
  'Robin',
  'Seal',
  'Tiger',
  'Toad',
  'Whale',
  'Wolf',
] as const;

/** The guest name a key always gets: two FNV-1a picks over the key, one per word list. */
export function guestNameForKey(key: string): string {
  const adjective = Math.abs(fnv1aString(`adjective:${key}`) | 0) % GUEST_NAME_ADJECTIVES.length;
  const animal = Math.abs(fnv1aString(`animal:${key}`) | 0) % GUEST_NAME_ANIMALS.length;
  return `${GUEST_NAME_ADJECTIVES[adjective]!} ${GUEST_NAME_ANIMALS[animal]!}`;
}
