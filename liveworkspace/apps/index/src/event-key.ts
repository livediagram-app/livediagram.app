// The person part of a Timeline event id made per person (liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Closing an account"): an `edited` event's (`ed:<item>:<key>:<day>`) and an `action_assigned` one's
// (`aa:<item>:<tab>:<element>:<action>:<key>`). Event ids leave the index (browsers dismiss by them, webhook receivers
// get them as each delivery's key), so they carry a one-way key of the person rather than their id: the same person
// always makes the same key, so a day's edits still land on one event, and a closed account's id is in no new id.

// Hex characters kept of the SHA-256: 128 bits, as unguessable as the id it stands for.
export const TIMELINE_PERSON_KEY_LENGTH = 32;
// Fixed, so the key is the same on every isolate and every deploy; a new version would make new ids.
const PREFIX = 'liveworkspace:timeline:v1:';

export async function timelinePersonKey(personId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(PREFIX + personId));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, TIMELINE_PERSON_KEY_LENGTH);
}

// The keys of several people at once (an item's assignees), each worked out once.
export async function timelinePersonKeys(
  personIds: Iterable<string>,
): Promise<ReadonlyMap<string, string>> {
  const unique = [...new Set(personIds)];
  const keys = await Promise.all(unique.map(timelinePersonKey));
  return new Map(unique.map((id, i) => [id, keys[i]!]));
}
