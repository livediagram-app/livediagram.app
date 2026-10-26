# Moving livediagram off Clerk

The new livediagram, like liveplanner, livedocuments and livedesign, signs in with liveworkspace accounts only: a
hard switch, with no Clerk fallback and no period of accepting both tokens. Only the historical livediagram.app, on
the previous Cloudflare account, uses Clerk, and it stops when its people and documents move across.

That move is [docs/migration.md](../../../../docs/migration.md). What it does about sign-in:

- **Account ids stay.** Each Clerk user is imported with their Clerk id (`user_…`), by
  `apps/accounts/scripts/import-clerk-users.ts`, so every document, team and token keeps its owner. Someone who
  already made an account on the new side with the same email keeps theirs, and their old work is written to it
  through the migration's owner map.
- **Google-only Clerk users** have no password, and they don't need one. Signing in with Google or a code to the
  same address lands on the same account, because the import matched on the primary email.
- **Teams** are recreated in the accounts Worker with their ids, members and roles.
- **API tokens** (`lvd_…`) are carried over by their hashes and keep working until they expire; liveworkspace
  mints only `lwt_` tokens. The MCP server's OAuth already signs in through liveworkspace.
- **`isAccountIdShape`** (`packages/api-kit/src/request-auth.ts`, renamed from `isClerkIdShape`) holds for both:
  new accounts get `user_` ids too.

## Removing Clerk

This repository has no Clerk code, settings or copy. After the migration's quiet period (its step 10), the Clerk
users are deleted and the Clerk application closed, and the historical livediagram.app's Clerk code goes with that
deployment.
