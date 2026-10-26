import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  accountsApi,
  afterSignIn,
  displayName,
  handoffBind,
  onAppAddress,
  EMAIL_PATTERN,
  isRegistering,
  nextUrl,
  returnPath,
  signedOAuthQuery,
  signInHref,
} from './accounts';

describe('signedOAuthQuery', () => {
  it('keeps the signature, the parameter list and only the parameters it names', () => {
    const search =
      '?client_id=app&scope=openid&ba_param=client_id&ba_param=scope&sig=s1&exp=9&extra=x';
    expect(signedOAuthQuery(search)).toBe(
      'client_id=app&scope=openid&ba_param=client_id&ba_param=scope&sig=s1',
    );
  });

  it('is nothing without a signature or a parameter list', () => {
    expect(signedOAuthQuery('?client_id=app')).toBeUndefined();
    expect(signedOAuthQuery('?sig=s1')).toBeUndefined();
  });
});

describe('the rest', () => {
  it('reads prompt=create among other prompts', () => {
    expect(isRegistering('?prompt=create')).toBe(true);
    expect(isRegistering('?prompt=login%20create')).toBe(true);
    expect(isRegistering('?prompt=login')).toBe(false);
    expect(isRegistering('')).toBe(false);
  });

  it('follows a url only from a successful answer', () => {
    expect(nextUrl({ ok: true, status: 200, data: { url: '/x' } })).toBe('/x');
    expect(nextUrl({ ok: false, status: 400, data: { url: '/x' } })).toBeNull();
    expect(nextUrl({ ok: true, status: 200, data: {} })).toBeNull();
  });

  it('takes an ordinary address and refuses a broken one', () => {
    expect(EMAIL_PATTERN.test('jane@example.com')).toBe(true);
    expect(EMAIL_PATTERN.test('jane@example')).toBe(false);
    expect(EMAIL_PATTERN.test('jane example@x.com')).toBe(false);
  });
});

describe('going back after signing in', () => {
  it('returns only to a path on this site', () => {
    expect(returnPath('?return=%2Ftelemetry%3Fapp%3Dliveplanner.app')).toBe(
      '/telemetry?app=liveplanner.app',
    );
    expect(returnPath('?return=https%3A%2F%2Fevil.example')).toBeNull();
    expect(returnPath('?return=%2F%2Fevil.example')).toBeNull();
    expect(returnPath('?return=%2F%5Cevil.example')).toBeNull();
    expect(returnPath('')).toBeNull();
  });

  it('links to sign-in with the page to come back to', () => {
    expect(signInHref('/')).toBe('/sign-in?return=%2F');
    expect(signInHref('/telemetry?app=liveplanner.app')).toBe(
      '/sign-in?return=%2Ftelemetry%3Fapp%3Dliveplanner.app',
    );
    expect(returnPath(new URL(signInHref('/telemetry'), 'https://x').search)).toBe('/telemetry');
  });

  it('names the account by first name, then full name, then email', () => {
    expect(displayName({ givenName: 'Ada', name: 'Ada Lovelace' })).toBe('Ada');
    expect(displayName({ givenName: '', name: 'Ada Lovelace' })).toBe('Ada Lovelace');
    expect(displayName({ email: 'ada@example.com' })).toBe('ada@example.com');
    expect(displayName({})).toBe('Your account');
  });
});

describe("on an app's own address", () => {
  const BIND = 'a'.repeat(43);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function at(origin: string, answer?: Response) {
    const store = new Map<string, string>();
    vi.stubGlobal('window', { location: new URL(`${origin}/sign-in`) });
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const fetched = vi.fn(async () => answer ?? Response.json({}, { status: 500 }));
    vi.stubGlobal('fetch', fetched);
    return fetched;
  }

  it('knows an app’s address from liveworkspace.app’s, staging’s and the local one', () => {
    expect(onAppAddress('https://livediagram-router.liveworkspace-easing509.workers.dev')).toBe(
      true,
    );
    expect(onAppAddress('https://staging.liveplanner.app')).toBe(true);
    expect(onAppAddress('http://localhost:3300')).toBe(true);
    expect(onAppAddress('https://liveworkspace.app')).toBe(
      false,
    );
    expect(
      onAppAddress('https://staging.liveworkspace.app'),
    ).toBe(false);
    expect(onAppAddress('http://localhost:3000')).toBe(false);
  });

  it('reaches the accounts API through the app’s router there, and directly here', () => {
    expect(accountsApi('https://livediagram-router.liveworkspace-easing509.workers.dev')).toBe(
      '/api/workspace/auth',
    );
    expect(accountsApi('https://liveworkspace.app')).toBe(
      '/api/auth',
    );
  });

  it('links to the app’s own sign-in there, which keeps the address on the app', () => {
    expect(signInHref('/explorer/recent', 'https://liveplanner.app')).toBe(
      '/api/auth/sign-in?return_to=%2Fexplorer%2Frecent',
    );
    expect(
      signInHref(
        '/explorer/recent',
        'https://liveworkspace.app',
      ),
    ).toBe('/sign-in?return=%2Fexplorer%2Frecent');
  });

  it('keeps the hand-off’s binding for the tab, and only one that looks like a hash', () => {
    at('https://livediagram-router.liveworkspace-easing509.workers.dev');
    expect(handoffBind(`?handoff=${BIND}`)).toBe(BIND);
    expect(handoffBind('?sig=s')).toBe(BIND);
    expect(handoffBind('?handoff=short')).toBe(BIND);
  });

  it('goes back by way of liveworkspace.app’s hand-off, or straight back when it can’t be made', async () => {
    const hop =
      'https://liveworkspace.app/api/auth/handoff?token=t';
    const fetched = at(
      'https://livediagram-router.liveworkspace-easing509.workers.dev',
      Response.json({ url: hop }),
    );
    const next =
      'https://livediagram-router.liveworkspace-easing509.workers.dev/api/auth/callback?code=c&state=s';
    expect(await afterSignIn(next, `?handoff=${BIND}`)).toBe(hop);
    expect(fetched).toHaveBeenCalledWith('/api/workspace/auth/handoff/start', expect.anything());
    expect(
      JSON.parse((fetched.mock.calls[0] as unknown as [string, RequestInit])[1].body as string),
    ).toEqual({
      return: next,
      bind: BIND,
    });
    at('https://livediagram-router.liveworkspace-easing509.workers.dev');
    expect(await afterSignIn(next, `?handoff=${BIND}`)).toBe(next);
    // No binding: straight back.
    const none = at('https://livediagram-router.liveworkspace-easing509.workers.dev');
    expect(await afterSignIn(next, '')).toBe(next);
    expect(none).not.toHaveBeenCalled();
    // A consent step still to come keeps the session where it is.
    expect(await afterSignIn('/consent?sig=s', `?handoff=${BIND}`)).toBe('/consent?sig=s');
    // liveworkspace.app itself has its session already.
    const home = at('https://liveworkspace.app');
    expect(await afterSignIn(next, `?handoff=${BIND}`)).toBe(next);
    expect(home).not.toHaveBeenCalled();
  });
});
