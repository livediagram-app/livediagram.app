# Moving livediagram off Clerk

livediagram goes first. liveplanner follows the same steps once livediagram has run cleanly for a
while.

## What stays the same

- **Account ids.** Each Clerk user is imported with their Clerk id (`user_…`), so no row in
  livediagram's D1 changes.
- **The API's shape.** The browser still sends `Authorization: Bearer <JWT>`, and the API still
  checks it locally against a JWKS. Only the issuer, the key URL and where the browser gets the
  token change.
- **Guest mode.** Without the accounts config set, the app is still guest-only, so local
  development keeps working.

## Steps

1. **Deploy the accounts Worker** to staging and production (README "First deploy").
2. **Register livediagram** in both environments and store the client secrets as livediagram
   Worker secrets.
3. **Import the Clerk users.** In the Clerk dashboard, go to Users → Export, then:

   ```sh
   node apps/accounts/scripts/import-clerk-users.ts users.csv > clerk-import.sql
   wrangler d1 execute liveworkspace-accounts --remote --file clerk-import.sql
   ```

   It is safe to re-run. Do it once now to rehearse, and again just before the switch to catch
   new sign-ups.

4. **Accept both tokens for a while.** In livediagram's API, try the liveworkspace verifier first
   and fall back to `CLERK_JWKS_URL`. People with an open Clerk session keep working through
   the switch.
5. **Switch sign-in.** `/sign-in` and `/get-started` redirect to `/auth/sign-in`, and the browser
   gets tokens from `/auth/token` instead of Clerk's `getToken()`
   ([integrating-an-app.md](integrating-an-app.md)). Guest migration (`POST /api/migrate`) runs
   on the first signed-in load, as it does now.
6. **Update the MCP server's OAuth.** `apps/mcp/src/oauth.ts` currently mints its own token on
   a Clerk-authed consent page. Point that consent page at the new sign-in (simplest), or later
   register the MCP server as its own client.
7. **Remove Clerk** once the Clerk fallback has stopped seeing traffic: `@clerk/react`,
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_JWKS_URL`.

## Things to check during the switch

- **Google-only Clerk users** have no password, and they don't need one. Signing in with a code
  to the same address lands on the same account, because the import matched on the primary email.
- **`isClerkIdShape`** (`packages/api-schema/src/request-auth.ts`) still holds: new accounts get
  `user_` ids too. It's worth renaming once Clerk is gone.
- **Teams invites** match on the verified `email` claim, which every access token now carries.
