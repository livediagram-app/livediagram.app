// Who a person is at the liveworkspace accounts Worker (liveworkspace/docs/accounts.md "Settings" and
// "Profiles"), which keeps everyone's settings and profile: livedocuments keeps neither.
//
// An account is `user_…` in both places. A livedocuments guest is a server-minted UUID
// (routes/guest-id.ts), which the accounts Worker knows as `guest_<uuid>`, the shape of its own guest
// ids. Anything else (an id from before guest ids were minted, a made-up header) has no place there,
// and is answered as having nothing stored.

import { isAccountIdShape } from '@livedocuments/api-schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const GUEST_PREFIX = 'guest_';
// The accounts Worker's own limit on an account id (its src/ids.ts USER_ID).
const ACCOUNT_ID = /^user_[A-Za-z0-9]{1,64}$/;

// The id the accounts Worker keeps this owner's settings and profile under, or null when it can't.
export function accountsOwnerOf(ownerId: string): string | null {
  if (isAccountIdShape(ownerId)) return ACCOUNT_ID.test(ownerId) ? ownerId : null;
  return UUID.test(ownerId) ? `${GUEST_PREFIX}${ownerId}` : null;
}

// The livedocuments owner id for an id the accounts Worker answered with.
export function ownerFromAccounts(accountsOwner: string): string {
  return accountsOwner.startsWith(GUEST_PREFIX)
    ? accountsOwner.slice(GUEST_PREFIX.length)
    : accountsOwner;
}

// Whether an owner is a signed-in account, the only kind with an address, sign-ups and milestones.
export function isAccountOwner(ownerId: string): boolean {
  return ACCOUNT_ID.test(ownerId);
}
