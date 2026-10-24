// Account ids keep Clerk's `user_` prefix. Accounts imported from Clerk keep their exact
// id, so no document row in livediagram or liveplanner has to move, and new accounts
// share the shape. The apps rely on it: a `user_…` value in the guest `X-Owner-Id` header
// is refused as a replayed account id (packages/api-kit/src/request-auth.ts
// `isClerkIdShape`), which only protects new accounts if their ids carry the prefix too.
export function newUserId(): string {
  return `user_${crypto.randomUUID().replaceAll('-', '')}`;
}

// A guest's id (guests.ts): `guest_` and a v4-shaped UUID, lower case.
export const GUEST_ID = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// An account's id: `user_` and up to 64 letters and digits (new ones a UUID's hex, imported ones Clerk's).
export const USER_ID = /^user_[A-Za-z0-9]{1,64}$/;
