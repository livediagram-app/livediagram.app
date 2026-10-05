// Whether a build's NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY turns sign-in on (docs/specs/014-identity/auth-and-guest-access.md):
// only a real `pk_test_` or `pk_live_` key does; unset or anything else is a self-hosted, guest-only build. Shared
// by every app that reads the key, so they agree on it. Each app still reads `process.env.NEXT_PUBLIC_...` itself,
// since Next only inlines that literal expression.
export function clerkPublishableKeyOrNull(raw: string | undefined): string | null {
  const key = raw ?? '';
  return key.startsWith('pk_test_') || key.startsWith('pk_live_') ? key : null;
}
