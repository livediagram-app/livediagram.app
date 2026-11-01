// A guest's identity, from liveworkspace (lib/guest-token.ts, liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Guests"): its token's id, the same in every app. The first visit, and one whose token is near its end, leaves
// for the accounts site's handoff and comes back with a fresh one; a page that cannot (no accounts site) carries
// on with a stand-in id, and the api treats it as it treats a link visitor.

import { ensureGuestToken } from './guest-token';
import { ensureGuestSelfId } from './local-identity';

type GuestIdentity = { id: string };

export async function ensureGuestIdentity(): Promise<GuestIdentity> {
  const token = await ensureGuestToken();
  return { id: token?.id ?? ensureGuestSelfId() };
}
