// Build-time auth settings. Sign-in is always on: it goes through the liveworkspace accounts Worker, by way of
// this app's own api (/api/auth/*, apps/api/src/routes/auth.ts), and a signed-out visitor is a guest with
// liveworkspace's guest token (docs/specs/014-identity/auth-and-guest-access.md).

// Test builds only: the opt-in e2e specs
// (docs/specs/013-workspace/blueprints/workbench-embeds.md "Testing") sign in
// without the accounts Worker, through E2EAuthBridge and a JWT the test mints
// against its own JWKS. A compile-time constant like the rest of this file, so
// a real build (which never sets it) drops the branch and the bridge entirely.
export const e2eAuthEnabled = process.env.NEXT_PUBLIC_E2E_AUTH === '1';

// liveworkspace.app, where the account's API tokens are run (teams are run in the Explorer) (liveworkspace/docs/accounts.md):
// the app links there rather than managing either itself. NEXT_PUBLIC_ACCOUNTS_SITE_URL points a
// staging build at staging.liveworkspace.app.
export const accountsSiteUrl = (
  process.env.NEXT_PUBLIC_ACCOUNTS_SITE_URL || 'https://liveworkspace.app'
).replace(/\/+$/, '');
export const manageTokensUrl = `${accountsSiteUrl}/explorer?settings=tokens`;
