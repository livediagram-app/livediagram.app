// Account ids keep Clerk's `user_` prefix. Accounts imported from Clerk keep their exact
// id, so no document row in livediagram or liveplanner has to move, and new accounts
// share the shape. The apps rely on it: a `user_…` value in the guest `X-Owner-Id` header
// is refused as a replayed account id (livediagram packages/api-schema/src/request-auth.ts
// `isClerkIdShape`), which only protects new accounts if their ids carry the prefix too.
export function newUserId(): string {
  return `user_${crypto.randomUUID().replaceAll('-', '')}`;
}
