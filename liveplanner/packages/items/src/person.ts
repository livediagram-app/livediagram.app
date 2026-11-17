// The public id of a person on items (docs/specs/026-plan/blueprints/item-store.md "Security and
// trust"). A guest's owner id is their credential (docs/specs/014-identity/auth-and-guest-access.md),
// so items never carry it: authors and voters are keyed by a one-way hash every client can compute
// for itself (to find its own votes and its own face-down cards) and nobody can reverse.

import { sha256 } from './sha256';

const PREFIX = 'liveplanner-item-person:';

export async function itemPersonId(ownerId: string): Promise<string> {
  const bytes = new TextEncoder().encode(PREFIX + ownerId);
  const digest = await sha256(bytes);
  return Array.from(digest.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Whether a person id is one itemPersonId made, so a liveworkspace identity's (docs/specs/026-plan/items.md
// "Accounts are marked"): never a custom assignee's `n-` slug or a template's `example-` person.
const PERSON_ID = /^[0-9a-f]{24}$/;
export const isIdentityPersonId = (id: string): boolean => PERSON_ID.test(id);

// A team's member as people on cards name them (docs/specs/026-plan/items.md "Who may do what"): only someone who
// joined, with an account; named by their name, else their address's local part, and coloured by `colour` (the one
// Automatic rule, @liveworkspace/settings/presence, which this package does not take in). The editor's assignee picker
// and the api's import matching (tracker-import.md "Agents") both make them so, so a match is the same person.
export async function teamMemberPersonOf(
  member: { userId: string | null; email?: string | null; name: string | null; status: string },
  colour: (name: string) => string,
): Promise<{ id: string; name: string; color: string } | null> {
  if (member.status !== 'joined' || !member.userId) return null;
  const name = member.name ?? member.email?.split('@')[0] ?? null;
  if (!name) return null;
  return { id: await itemPersonId(member.userId), name, color: colour(name) };
}
