// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:3200/explorer/recent"}
// The Explorer on an app's own address (page-app.ts): here liveplanner's local router, :3200. The page is the app's:
// it asks as the app's session, reaches liveworkspace's account API through the app's router with its token, and
// sends liveworkspace's own pages to liveworkspace.app.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appHosts, appOfHost, appOrigin, pageApp, workspaceHref } from './page-app';
import { appAccount, appSignInHref, resetAppSession } from './app-session';
import { accountFetch, resetWorkspaceIdentity, workspaceIdentity } from './token';
import { explorerSilentSignInScript } from './silent';

const token = (sub: string) =>
  `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.s`;

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
  it('knows every switched-on app by its live, www, staging and local address', () => {
    expect(appOfHost('liveplanner.app')).toBe('liveplanner');
    expect(appOfHost('www.livedesign.app')).toBe('livedesign');
    expect(appOfHost('staging.livedocuments.app')).toBe('livedocuments');
    expect(appOfHost('localhost:3200')).toBe('liveplanner');
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
