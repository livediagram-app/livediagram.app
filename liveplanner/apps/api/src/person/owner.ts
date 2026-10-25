// Who a person is at the liveworkspace accounts Worker (liveworkspace/docs/accounts.md "Settings" and
// "Profiles"), which keeps everyone's settings and profile: liveplanner keeps neither.
//
// liveplanner's owners are the accounts Worker's own ids: an account's `user_…`, or a guest's
// `guest_<uuid>` from its guest token (docs/specs/014-identity/auth-and-guest-access.md). Anything
// else (a malformed id) has no place there, and is answered as having nothing stored.

// The accounts Worker's own limits on its ids (its src/ids.ts).
const ACCOUNT_ID = /^user_[A-Za-z0-9]{1,64}$/;
const GUEST_ID = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// The id the accounts Worker keeps this owner's settings and profile under, or null when it can't. Whether an owner
// is a signed-in account is @liveworkspace/auth-client's isAccountId.
export function accountsOwnerOf(ownerId: string): string | null {
  return ACCOUNT_ID.test(ownerId) || GUEST_ID.test(ownerId) ? ownerId : null;
}
