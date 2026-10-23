// Who an owner id is to the liveworkspace accounts Worker (liveworkspace/docs/accounts.md "Settings",
// "Profiles"), which keeps settings and profiles for every app. An account is `user_…` in both. A
// livediagram guest is the per-browser UUID it carries as X-Owner-Id (docs/specs/014-identity/
// auth-and-guest-access.md); liveworkspace spells a guest `guest_<uuid>`, so that is the guest's
// owner there. Any other id (a malformed header, a test fixture) has no record at liveworkspace.

import { isAccountIdShape } from '@livediagram/api-schema';
import { accountCredentials } from '../auth/accounts';
import type { Env } from '../types';
import type { ClientCredentials } from '@liveworkspace/auth-client';

const GUEST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const GUEST_PREFIX = 'guest_';

// The id liveworkspace knows this owner by, or null when it can't hold anything for them.
export function liveworkspaceOwnerOf(ownerId: string): string | null {
  if (isAccountIdShape(ownerId)) return ownerId;
  return GUEST_UUID.test(ownerId) ? `${GUEST_PREFIX}${ownerId}` : null;
}

// The reverse: the owner id this app uses for an id liveworkspace answers with.
export function appOwnerOf(liveworkspaceId: string): string {
  return liveworkspaceId.startsWith(GUEST_PREFIX)
    ? liveworkspaceId.slice(GUEST_PREFIX.length)
    : liveworkspaceId;
}

// This app's client at the accounts Worker, and the owner's id there: null when either is missing
// (a guest-only self-host, or an id liveworkspace can't hold), and the caller keeps to its fallback.
export function liveworkspaceTarget(
  env: Env,
  ownerId: string,
): { credentials: ClientCredentials; owner: string } | null {
  const credentials = accountCredentials(env);
  const owner = liveworkspaceOwnerOf(ownerId);
  return credentials && owner ? { credentials, owner } : null;
}
