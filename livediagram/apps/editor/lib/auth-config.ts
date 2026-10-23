// Single source of truth for "can people sign in on this deployment".
//
// Signing in goes through the liveworkspace accounts Worker, by way of this
// app's own api (/api/auth/*, apps/api/src/routes/auth.ts). Other deployments
// (per docs/specs/002-project-scope/open-source-and-business-model.md + docs/specs/014-identity/auth-and-guest-access.md)
// can ship livediagram without sign-in: everyone is a guest, with a guest
// token from the same accounts Worker, which is also how a signed-in
// deployment handles signed-out visitors.
//
// `NEXT_PUBLIC_*` env vars are baked into the static export at build time, so
// the flag is effectively a compile-time constant: no per-render cost, no
// React state. It must agree with the api worker's ACCOUNTS_* config; with the
// flag on and the api unconfigured, every visitor simply settles as a guest.
export const signInEnabled = process.env.NEXT_PUBLIC_SIGN_IN_ENABLED === 'true';

// Test builds only: the signed-in and opt-in e2e specs
// (docs/specs/013-workspace/blueprints/workbench-embeds.md "Testing",
// docs/specs/022-drive-mirror/blueprints/drive-mirror.md "Testing") sign in
// without the accounts Worker, through E2EAuthBridge and a JWT the test mints
// against its own JWKS. A compile-time constant like the rest of this file, so
// a real build (which never sets it) drops the branch and the bridge entirely.
export const e2eAuthEnabled = process.env.NEXT_PUBLIC_E2E_AUTH === '1';

// Whether this build can have a signed-in session at all: real sign-in, or the
// test bridge. Only the session plumbing (the deferred provider, the api
// bootstrap, the account menu) reads this; the sign-in surfaces read
// signInEnabled.
export const sessionsEnabled = signInEnabled || e2eAuthEnabled;

// liveworkspace.app, where the account's teams and API tokens are run (liveworkspace/docs/accounts.md):
// the app links there rather than managing either itself. NEXT_PUBLIC_ACCOUNTS_SITE_URL points a
// staging build at staging.liveworkspace.app.
export const accountsSiteUrl = (
  process.env.NEXT_PUBLIC_ACCOUNTS_SITE_URL || 'https://liveworkspace.app'
).replace(/\/+$/, '');
export const manageTeamsUrl = `${accountsSiteUrl}/account/teams`;
export const manageTokensUrl = `${accountsSiteUrl}/account/tokens`;
