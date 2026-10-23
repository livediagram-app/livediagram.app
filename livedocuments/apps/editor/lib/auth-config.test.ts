import { afterEach, describe, expect, it, vi } from 'vitest';

// auth-config reads NEXT_PUBLIC_* at module-load time (baked into the static
// export), so each case sets the env then imports a fresh copy. It gates the
// whole signed-in-vs-guest mode (docs/specs/002-project-scope/open-source-and-business-model.md +
// docs/specs/014-identity/auth-and-guest-access.md).
const KEYS = ['NEXT_PUBLIC_SIGN_IN_ENABLED', 'NEXT_PUBLIC_E2E_AUTH'];

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

describe('signInEnabled', () => {
  it('is off (pure-guest mode) when unset', async () => {
    const c = await load();
    expect(c.signInEnabled).toBe(false);
    expect(c.sessionsEnabled).toBe(false);
  });

  it('is on only for the literal "true"', async () => {
    expect((await load({ NEXT_PUBLIC_SIGN_IN_ENABLED: 'true' })).signInEnabled).toBe(true);
    expect((await load({ NEXT_PUBLIC_SIGN_IN_ENABLED: '1' })).signInEnabled).toBe(false);
    expect((await load({ NEXT_PUBLIC_SIGN_IN_ENABLED: 'TRUE' })).signInEnabled).toBe(false);
  });
});

describe('sessionsEnabled', () => {
  it('is on for real sign-in or the e2e bridge', async () => {
    expect((await load({ NEXT_PUBLIC_SIGN_IN_ENABLED: 'true' })).sessionsEnabled).toBe(true);
    const e2e = await load({ NEXT_PUBLIC_E2E_AUTH: '1' });
    expect(e2e.sessionsEnabled).toBe(true);
    expect(e2e.signInEnabled).toBe(false);
  });
});
