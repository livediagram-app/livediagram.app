// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appAccount, appSignOut, resetAppSession, SIGNED_IN_HINTS } from './app-session';

// The Sign Out row in the Explorer on an app's own address (liveworkspace/docs/specs/010-site/site.md "Your Account",
// Work Tracker 1283) says "Sign out of every liveworkspace app in this browser." This pins what it does to that: it is
// the editors' sign-out, posted to the app's own API on this address, which ends the liveworkspace session (every app's
// tokens from it, liveworkspace/docs/specs/003-accounts/accounts.md "Signing out"), and the page then takes the accounts
// site's hop, which clears liveworkspace.app's cookie. A lighter sign-out of the app's token alone would never leave
// the page. The row's copy itself is pinned in components/settings/site-settings-app-account.test.tsx.

vi.mock('./page-app', async (original) => ({
  ...(await original<typeof import('./page-app')>()),
  pageApp: () => 'livediagram',
}));

const HINT = SIGNED_IN_HINTS.livediagram!;
const HOP =
  'https://www.liveworkspace.app/api/auth/end-session?client_id=livediagram&post_logout_redirect_uri=https%3A%2F%2Fwww.livediagram.app%2Fexplorer%3Ffolder%3Df1&ticket=t1';

type Call = { url: string; init: RequestInit | undefined };
let calls: Call[];
let signOutAnswer: () => Response;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  resetAppSession();
  calls = [];
  signOutAnswer = () => json(200, { signedIn: false, next: HOP });
  document.cookie = `${HINT}=1; path=/`;
  window.history.replaceState(null, '', '/explorer?folder=f1');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === '/api/auth/token')
        return json(200, {
          signedIn: true,
          accessToken: 'app-token',
          expiresAt: Date.now() + 600_000,
          user: { id: 'user_ada', givenName: 'Ada', email: 'ada@example.com' },
        });
      if (url.startsWith('/api/auth/sign-out')) return signOutAnswer();
      return json(404, {});
    }),
  );
});

afterEach(() => {
  document.cookie = `${HINT}=; path=/; max-age=0`;
  vi.unstubAllGlobals();
});

const signOutCalls = () => calls.filter((c) => c.url.startsWith('/api/auth/sign-out'));

describe('Sign Out in the Explorer on an app’s address', () => {
  it('asks the app’s own API to sign out everywhere, then takes the accounts site’s hop', async () => {
    expect((await appAccount())?.name).toBe('Ada');
    const go = vi.fn();

    expect(await appSignOut(go)).toBe(true);

    // The app's API on this address, with its cookies, coming back to this very page: the editors' sign-out, which
    // ends the liveworkspace session and every app's tokens from it.
    expect(signOutCalls()).toHaveLength(1);
    const [call] = signOutCalls();
    expect(call!.url).toBe(
      `/api/auth/sign-out?return=${encodeURIComponent('/explorer?folder=f1')}`,
    );
    expect(call!.init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    // Then the full-page hop through liveworkspace.app, which clears its session cookie there.
    expect(go).toHaveBeenCalledExactlyOnceWith(HOP);
    // And the page forgets the account: the next ask goes back to the app.
    const before = calls.length;
    await appAccount();
    expect(calls.length).toBe(before + 1);
    expect(calls.at(-1)!.url).toBe('/api/auth/token');
  });

  it('comes straight back when the accounts site didn’t answer: this app alone, as in the editors', async () => {
    signOutAnswer = () => json(200, { signedIn: false, next: null });
    const go = vi.fn();
    expect(await appSignOut(go)).toBe(true);
    expect(go).toHaveBeenCalledExactlyOnceWith('/explorer?folder=f1');
  });

  it('leaves everything as it was when the app refuses', async () => {
    expect((await appAccount())?.name).toBe('Ada');
    signOutAnswer = () => json(500, {});
    const go = vi.fn();
    expect(await appSignOut(go)).toBe(false);
    expect(go).not.toHaveBeenCalled();
    // Still signed in: no new token ask.
    const before = calls.length;
    expect((await appAccount())?.name).toBe('Ada');
    expect(calls.length).toBe(before);
  });
});
