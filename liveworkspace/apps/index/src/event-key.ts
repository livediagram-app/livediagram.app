// The person part of an event id made per person (liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Closing an account"): an `edited` event's (`ed:<item>:<key>:<day>`) and an `action_assigned` one's
// (`aa:<item>:<tab>:<element>:<action>:<key>`). Event ids leave the index (webhook receivers get them as each delivery's
// key), so they carry a one-way key of the person rather than their id: the same person
// always makes the same key, so a day's edits still land on one event, and a closed account's id is in no new id.

// Hex characters kept of the SHA-256: 128 bits, as unguessable as the id it stands for.
export const PERSON_EVENT_KEY_LENGTH = 32;
// Fixed, so the key is the same on every isolate and every deploy; a new version would make new ids. It keeps the
// Timeline's old name for that reason: renaming it would change every key.
const PREFIX = 'liveworkspace:timeline:v1:';

export async function personEventKey(personId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(PREFIX + personId));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, PERSON_EVENT_KEY_LENGTH);
}

// The keys of several people at once (an item's assignees), each worked out once.
export async function personEventKeys(
  personIds: Iterable<string>,
): Promise<ReadonlyMap<string, string>> {
  const unique = [...new Set(personIds)];
  const keys = await Promise.all(unique.map(personEventKey));
  return new Map(unique.map((id, i) => [id, keys[i]!]));
}
