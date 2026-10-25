import { describe, expect, it } from 'vitest';
import type { Env } from './env.ts';
import { signInOptions } from './sign-in-options.ts';

const env = (extra: Partial<Env> = {}) =>
  ({ TURNSTILE_SITE_KEY: 'site-key', BASE_URL: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev', ...extra }) as Env;

describe('sign-in options', () => {
  it('gives the pages the Turnstile key and the name limit, and caches briefly', async () => {
    const response = signInOptions(env());
    expect(await response.json()).toEqual({
      turnstileSiteKey: 'site-key',
      google: false,
      nameMaxLength: 80,
      accountsUrl: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev',
      googleOnApps: false,
    });
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
  });

  it('offers Google only when both its id and secret are set', async () => {
    const half = await signInOptions(env({ GOOGLE_CLIENT_ID: 'id' })).json();
    expect(half).toMatchObject({ google: false });
    const both = await signInOptions(
      env({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's' }),
    ).json();
    expect(both).toMatchObject({ google: true, googleOnApps: false });
  });

  it("says when Google can come back to an app's own address", async () => {
    expect(await signInOptions(env({ GOOGLE_ON_APP_ORIGINS: 'true' })).json()).toMatchObject({
      googleOnApps: true,
    });
  });
});
