// Who an owner id is to the liveworkspace accounts Worker (liveworkspace/docs/accounts.md "Settings",
// "Profiles"), which keeps settings and profiles for every app. Ids are liveworkspace's own: an account
// is `user_…` and a guest `guest_<uuid>` (its guest token's, docs/specs/014-identity/auth-and-guest-access.md),
// the same here and there. Any other id (a test fixture, a stand-in) has no record at liveworkspace.

import { isAccountIdShape } from '@livediagram/api-schema';
import { accountCredentials } from '../auth/accounts';
import type { Env } from '../types';
import type { ClientCredentials } from '@liveworkspace/auth-client';

const GUEST_ID = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// The id liveworkspace knows this owner by (the same id), or null when it can't hold anything for them.
export function liveworkspaceOwnerOf(ownerId: string): string | null {
  return isAccountIdShape(ownerId) || GUEST_ID.test(ownerId) ? ownerId : null;
}

// This app's client at the accounts Worker, and the owner's id there: null when either is missing
// (a guest-only deployment, or an id liveworkspace can't hold), and the caller keeps to its fallback.
export function liveworkspaceTarget(
  env: Env,
  ownerId: string,
): { credentials: ClientCredentials; owner: string } | null {
  const credentials = accountCredentials(env);
  const owner = liveworkspaceOwnerOf(ownerId);
  return credentials && owner ? { credentials, owner } : null;
}
