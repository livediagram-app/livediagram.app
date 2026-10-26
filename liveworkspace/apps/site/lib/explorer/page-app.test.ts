// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:3200/explorer/recent"}
// The Explorer on an app's own address (page-app.ts): here liveplanner's local router, :3200. The page is the app's:
// it asks as the app's session, reaches liveworkspace's account API through the app's router with its token, and
// sends liveworkspace's own pages to liveworkspace.app.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appHosts, appOfHost, appOfPageHost, appOrigin, pageApp, workspaceHref } from './page-app';
import {
  appAccount,
  appSignInHref,
  e2eAccount,
  e2eSessionKey,
  resetAppSession,
} from './app-session';
import { accountFetch, resetWorkspaceIdentity, workspaceIdentity } from './token';
import { explorerSilentSignInScript } from './silent';

const token = (sub: string) => `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.s`;

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      url === '/api/auth/token'
        ? Response.json({
            signedIn: true,
            accessToken: token('user_1'),
            expiresAt: Date.now() + 10 * 60_000,
            user: { id: 'user_1', givenName: 'Ada' },
          })
        : Response.json({ people: [] }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetAppSession();
  resetWorkspaceIdentity();
  document.cookie = 'lp_signed_in=; max-age=0; path=/';
});

describe('where the page is', () => {
  it('reads any local port in an app’s block as that app’s page, an E2E stack’s among them', () => {
    expect(appOfPageHost('localhost:3102')).toBe('livediagram');
    expect(appOfPageHost('localhost:3115')).toBe('livediagram');
    expect(appOfPageHost('localhost:3202')).toBe('liveplanner');
    expect(appOfPageHost('127.0.0.1:3302')).toBe('livedocuments');
    expect(appOfPageHost('localhost:3499')).toBe('livedesign');
    expect(appOfPageHost('livediagram.app')).toBe('livediagram');
    // liveworkspace's own block, and ports in no block, are liveworkspace.app's page.
    expect(appOfPageHost('localhost:3000')).toBeNull();
    expect(appOfPageHost('localhost:3650')).toBeNull();
    expect(appOfPageHost('example.com:3102')).toBeNull();
    // Return addresses are vetted by appOfHost, which knows each router's port alone.
    expect(appOfHost('localhost:3102')).toBeNull();
  });

  it('knows every switched-on app by its live, www, staging and local address', () => {
    expect(appOfHost('liveplanner.app')).toBe('liveplanner');
    expect(appOfHost('www.livedesign.app')).toBe('livedesign');
    expect(appOfHost('staging.livedocuments.app')).toBe('livedocuments');
    expect(appOfHost('localhost:3200')).toBe('liveplanner');
    // livediagram's workers.dev stand-ins until livediagram.app moves: the page there is livediagram's.
    expect(appOfHost('livediagram-router.liveworkspace-easing509.workers.dev')).toBe('livediagram');
    expect(appOfHost('livediagram-router-staging.liveworkspace-easing509.workers.dev')).toBe(
      'livediagram',
    );
    expect(appOfHost('livediagram.app')).toBe('livediagram');
    expect(appOfHost('localhost:3100')).toBe('livediagram');
    expect(appOfHost('liveworkspace.app')).toBeNull();
    expect(appOfHost('localhost:3000')).toBeNull();
    expect(new Set(Object.values(appHosts()))).toEqual(
      new Set(['livediagram', 'liveplanner', 'livedocuments', 'livedesign']),
    );
  });

  it("is liveplanner's here, with its own origin and liveworkspace.app's pages in full", () => {
    expect(pageApp()).toBe('liveplanner');
    expect(appOrigin('liveplanner')).toBe('http://localhost:3200');
    expect(appOrigin('livediagram')).toMatch(/livediagram/);
    expect(workspaceHref('/account/tokens')).toMatch(/\/account\/tokens$/);
    expect(workspaceHref('/account/tokens')).not.toBe('/account/tokens');
    expect(appSignInHref('/explorer/recent')).toBe(
      '/api/auth/sign-in?return_to=%2Fexplorer%2Frecent',
    );
  });
});

describe("the app's session", () => {
  it('asks nothing without the hint cookie, and asks once for many callers with it', async () => {
    expect(await appAccount()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    document.cookie = 'lp_signed_in=1; path=/';
    const [a, b] = await Promise.all([appAccount(), appAccount()]);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ sub: 'user_1', name: 'Ada' });
    await appAccount();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is who the Explorer asks the index as', async () => {
    document.cookie = 'lp_signed_in=1; path=/';
    expect(await workspaceIdentity()).toMatchObject({ kind: 'account', sub: 'user_1' });
  });
});

describe("liveworkspace's account API from here", () => {
  it('goes through the router with the bearer and no cookies', async () => {
    document.cookie = 'lp_signed_in=1; path=/';
    await accountFetch('/api/account/people?ids=u1', { credentials: 'same-origin' });
    const [url, init] = fetchMock.mock.lastCall as [string, RequestInit];
    expect(url).toBe('/api/workspace/account/people?ids=u1');
    expect(new Headers(init.headers).get('Authorization')).toMatch(/^Bearer h\./);
    expect(init.credentials).toBe('omit');
  });

  it('leaves any other address alone', async () => {
    await accountFetch('/api/index/items', {});
    expect(fetchMock.mock.lastCall![0]).toBe('/api/index/items');
  });
});

describe('the silent sign-in script', () => {
  it("runs only the bounce of the app whose address it is on, never on liveworkspace.app's", () => {
    const script = explorerSilentSignInScript();
    expect(script).toContain('"localhost:3200":"liveplanner"');
    expect(script).toContain('lp_signed_in');
    expect(script).toContain('"localhost:3100":"livediagram"');
    expect(script).toContain('ld_signed_in');
    expect(script).toContain('/auth/silent?return=');
    expect(script).not.toContain('liveworkspace.app"');
    expect(script.startsWith('(function(){var h=location.host')).toBe(true);
  });
});

describe('the e2e stack’s session (test builds only)', () => {
  const session = JSON.stringify({
    token: token('user_e2e'),
    userId: 'user_e2e',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it('is read only in a build made for the e2e stack', async () => {
    localStorage.setItem(e2eSessionKey('liveplanner'), session);
    // A production build: the session in storage is never read, and with no hint cookie nobody is signed in.
    expect(e2eAccount('liveplanner')).toBeNull();
    expect(await appAccount()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs the Explorer in as the specs’ person, with the stand-in’s token, without asking the app', async () => {
    vi.stubEnv('NEXT_PUBLIC_E2E_AUTH', '1');
    localStorage.setItem('liveplanner:e2e:session', session);
    const account = await appAccount();
    expect(account).toMatchObject({
      token: token('user_e2e'),
      sub: 'user_e2e',
      name: 'Ada',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    const identity = await workspaceIdentity();
    expect(identity).toMatchObject({ kind: 'account', sub: 'user_e2e', token: token('user_e2e') });
  });

  it('is a guest as before when the specs put no session, or a broken one', () => {
    expect(e2eAccount('liveplanner', true)).toBeNull();
    localStorage.setItem(e2eSessionKey('liveplanner'), '{not json');
    expect(e2eAccount('liveplanner', true)).toBeNull();
    localStorage.setItem(e2eSessionKey('liveplanner'), JSON.stringify({ token: 't' }));
    expect(e2eAccount('liveplanner', true)).toBeNull();
  });
});
