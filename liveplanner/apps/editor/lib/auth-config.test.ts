import { afterEach, describe, expect, it, vi } from 'vitest';

// auth-config reads NEXT_PUBLIC_* at module-load time (baked into the static
// export), so each case sets the env then imports a fresh copy.
const KEYS = ['NEXT_PUBLIC_E2E_AUTH', 'NEXT_PUBLIC_ACCOUNTS_SITE_URL'];

async function load(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
  return import('./auth-config');
}

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
  vi.resetModules();
});

describe('e2eAuthEnabled', () => {
  it('is off unless a test build sets the literal "1"', async () => {
    expect((await load()).e2eAuthEnabled).toBe(false);
    expect((await load({ NEXT_PUBLIC_E2E_AUTH: 'true' })).e2eAuthEnabled).toBe(false);
    expect((await load({ NEXT_PUBLIC_E2E_AUTH: '1' })).e2eAuthEnabled).toBe(true);
  });
});

describe('accountsSiteUrl', () => {
  it('defaults to liveworkspace.app and drops a trailing slash', async () => {
    expect((await load()).manageTokensUrl).toBe(
      'https://liveworkspace.app/explorer?settings=tokens',
    );
    const staging = await load({
      NEXT_PUBLIC_ACCOUNTS_SITE_URL: 'https://staging.liveworkspace.app/',
    });
    expect(staging.manageTokensUrl).toBe(
      'https://staging.liveworkspace.app/explorer?settings=tokens',
    );
  });
});
