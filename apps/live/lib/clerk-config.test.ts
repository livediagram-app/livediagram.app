import { afterEach, describe, expect, it, vi } from 'vitest';

// clerk-config reads NEXT_PUBLIC_* at module-load time (baked into the
// static export), so each case sets the env then imports a fresh copy.
// Gating the whole Clerk-vs-guest mode (spec/03 + spec/04), so the
// publishable-key prefix check and the Google-OAuth dependency on Clerk
// are worth pinning.
const KEYS = ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED'];

async function load(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
  return import('./clerk-config');
}

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
  vi.resetModules();
});

describe('clerkEnabled', () => {
  it('is off (pure-guest mode) when no key is set', async () => {
    const c = await load();
    expect(c.clerkEnabled).toBe(false);
    expect(c.clerkPublishableKey).toBeNull();
  });

  it('is on for a pk_test_ or pk_live_ publishable key', async () => {
    expect((await load({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc' })).clerkEnabled).toBe(
      true,
    );
    const live = await load({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_xyz' });
    expect(live.clerkEnabled).toBe(true);
    expect(live.clerkPublishableKey).toBe('pk_live_xyz');
  });

  it('stays off for a non-empty key with the wrong prefix', async () => {
    const c = await load({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'sk_test_secret' });
    expect(c.clerkEnabled).toBe(false);
    expect(c.clerkPublishableKey).toBeNull();
  });
});

describe('googleOAuthEnabled', () => {
  it('requires both Clerk on AND the flag set to "true"', async () => {
    expect(
      (
        await load({
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
          NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: 'true',
        })
      ).googleOAuthEnabled,
    ).toBe(true);
  });

  it('is off when the flag is set but Clerk is off (no button in guest mode)', async () => {
    expect((await load({ NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: 'true' })).googleOAuthEnabled).toBe(
      false,
    );
  });

  it('is off when Clerk is on but the flag is not exactly "true"', async () => {
    expect(
      (
        await load({
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
          NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: '1',
        })
      ).googleOAuthEnabled,
    ).toBe(false);
  });
});
