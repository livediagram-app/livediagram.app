// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:3300/explorer/all"}
// After a change to the person's teams in the Explorer on an app's own address (here livedocuments' local router,
// :3300): the app is asked for a fresh token, which names the teams as they now are.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIGNED_IN_HINT_COOKIE } from '@livedocuments/api-schema';
import { renewIdentity } from './new-team';
import { resetAppSession } from './app-session';
import { resetWorkspaceIdentity, workspaceIdentity } from './token';

const jwt = (claims: object) => `h.${btoa(JSON.stringify(claims))}.s`;

afterEach(() => {
  vi.unstubAllGlobals();
  resetAppSession();
  resetWorkspaceIdentity();
  document.cookie = `${SIGNED_IN_HINT_COOKIE}=; max-age=0; path=/`;
});

describe('renewing the token after a team changes, on an app address', () => {
  it("asks the app's session again, and the new token names the team", async () => {
    document.cookie = `${SIGNED_IN_HINT_COOKIE}=1; path=/`;
    let teams: { id: string; name: string }[] = [];
    const fetchMock = vi.fn(async (_url: string) =>
      Response.json({
        signedIn: true,
        accessToken: jwt({ sub: 'user_1', teams }),
        expiresAt: Date.now() + 600_000,
        user: { id: 'user_1', givenName: 'Ada' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await workspaceIdentity();
    teams = [{ id: 't9', name: 'Design' }];
    const renewed = await renewIdentity();
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/auth/token')).toHaveLength(2);
    expect(renewed?.token).toContain(btoa(JSON.stringify({ sub: 'user_1', teams })));
  });
});
