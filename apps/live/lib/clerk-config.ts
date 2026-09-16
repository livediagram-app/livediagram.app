// Single source of truth for "is Clerk enabled on this deployment".
//
// Self-hosters (per spec/03 + spec/04) can ship livediagram without
// provisioning a Clerk app at all — the canvas runs in pure guest
// mode using the X-Owner-Id header (which is also how a deployed-
// with-Clerk install handles signed-out visitors). This flag flips
// every Clerk-aware module into either real-Clerk-context or
// pure-guest pass-through at module load time.
//
// `NEXT_PUBLIC_*` env vars are baked into the static export at build
// time, so the flag is effectively a compile-time constant — no
// per-render cost, no React state, and the bundle can drop the Clerk
// pages' content entirely on a no-key build via dead-code elimination
// once tree-shaking gets aggressive.

const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

export const clerkEnabled =
  key.length > 0 && (key.startsWith('pk_test_') || key.startsWith('pk_live_'));

export const clerkPublishableKey = clerkEnabled ? key : null;

// Whether the sign-in / sign-up pages should show the "Continue with
// Google" OAuth button. Gated by `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`
// so dev tenants (which can use Clerk's shared Google credentials)
// can turn it on before prod's own Google Cloud OAuth client exists.
// The connection must be enabled in the Clerk dashboard and, for prod,
// a Google Cloud OAuth client registered against Clerk's redirect URI
// (`https://clerk.<domain>/v1/oauth_callback`) — without that the
// button would surface a `redirect_uri_mismatch` error to the user.
// Requires Clerk itself to be on (no point showing it in guest mode).
// The handlers stay in the code so flipping this flag re-enables the
// button without re-implementing anything.
export const googleOAuthEnabled =
  clerkEnabled && process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true';
