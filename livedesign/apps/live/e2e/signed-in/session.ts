import type { Page } from '@playwright/test';

// A signed-in session for the signed-in e2e specs (docs/specs/003-system-architecture/e2e-smoke.md
// "Signed-in specs").
//
// The specs run against the signed-in export (`pnpm build:signed-in`), which carries the test-only
// E2EAuthBridge in place of the accounts bridge (components/providers/AuthProvider.tsx). The e2e stack
// stands in for the liveworkspace accounts Worker (E2E_ACCOUNTS_STUB): `/e2e/token` mints an access
// token the api worker verifies like a real one, so the person is a real verified account to the api
// and the realtime room. This puts that token where the bridge reads it, before any page script runs.

// Kept in step with E2E_SESSION_KEY in components/providers/E2EAuthBridge.tsx.
const E2E_SESSION_KEY = 'livedesign:e2e:session';

export type StubUser = {
  // The account id; defaults to `user_stub`.
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
};

// `null` signs nobody in: an anonymous visitor on a deployment with sign-in.
export async function installSession(page: Page, user: StubUser | null): Promise<void> {
  let session: string | null = null;
  if (user) {
    const id = user.id ?? 'user_stub';
    const res = await page.request.get(
      `/e2e/token?sub=${id}&email=${encodeURIComponent(user.email)}`,
    );
    if (!res.ok()) throw new Error(`minting an access token failed: ${res.status()}`);
    session = JSON.stringify({
      token: await res.text(),
      userId: id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  }
  await page.addInitScript(
    ([key, value]) => {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    },
    [E2E_SESSION_KEY, session] as const,
  );
}

/**
 * A fresh account id. The stack's D1 outlives a test, and an account's synced preferences with it,
 * so a test that flips a setting takes an account nobody else uses.
 */
export function freshUserId(name: string): string {
  return `user_${name}${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}
