// The public id of a person on items (docs/specs/026-plan/blueprints/item-store.md "Security and
// trust"). A guest's owner id is their credential (docs/specs/014-identity/auth-and-guest-access.md),
// so items never carry it: authors and voters are keyed by a one-way hash every client can compute
// for itself (to find its own votes and its own face-down cards) and nobody can reverse.

import { sha256 } from './sha256';

const PREFIX = 'livedesign-item-person:';

export async function itemPersonId(ownerId: string): Promise<string> {
  const bytes = new TextEncoder().encode(PREFIX + ownerId);
  const digest = await sha256(bytes);
  return Array.from(digest.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}
