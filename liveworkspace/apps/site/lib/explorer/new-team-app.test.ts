// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:3300/explorer/all"}
// New Team in the Explorer on an app's own address (here livedocuments' local router, :3300): the page holds the
// app's token, which accounts doesn't take for making a team, so the app's own API makes it (the registry's
// teamsPath), then the app is asked for a fresh token that names the team.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIGNED_IN_HINT_COOKIE } from '@livedocuments/api-schema';
import { canMakeTeam, makeTeam } from './new-team';
import { resetAppSession } from './app-session';
import { resetWorkspaceIdentity } from './token';

const jwt = (claims: object) => `h.${btoa(JSON.stringify(claims))}.s`;

afterEach(() => {
  vi.unstubAllGlobals();
  resetAppSession();
  resetWorkspaceIdentity();
  document.cookie = `${SIGNED_IN_HINT_COOKIE}=; max-age=0; path=/`;
});

describe('New Team on an app address', () => {
  it("makes the team through the app's API with the app's token, then renews it", async () => {
    document.cookie = `${SIGNED_IN_HINT_COOKIE}=1; path=/`;
    const calls: { url: string; init?: RequestInit }[] = [];
    let teams: { id: string; name: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url === '/api/teams') {
          teams = [{ id: 't9', name: 'Design' }];
          return Response.json({ team: { id: 't9', name: 'Design' } }, { status: 201 });
        }
        return Response.json({
          signedIn: true,
          accessToken: jwt({ sub: 'user_1', teams }),
          expiresAt: Date.now() + 600_000,
          user: { id: 'user_1', givenName: 'Ada' },
        });
      }),
    );
    const made = await makeTeam('Design');
    expect(made?.team).toEqual({ id: 't9', name: 'Design' });
    const create = calls.find((c) => c.url === '/api/teams');
    expect(create?.init?.method).toBe('POST');
    expect(new Headers(create?.init?.headers).get('authorization')).toMatch(/^Bearer h\./);
    expect(JSON.parse(create?.init?.body as string)).toEqual({ name: 'Design' });
    // Asked for a token once before, and once after: the new one names the team.
    expect(calls.filter((c) => c.url === '/api/auth/token')).toHaveLength(2);
    expect(made?.identity?.token).toContain(btoa(JSON.stringify({ sub: 'user_1', teams })));
  });

  it('answers null when the app refuses it', async () => {
    document.cookie = `${SIGNED_IN_HINT_COOKIE}=1; path=/`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/teams'
          ? Response.json({ error: 'name_required' }, { status: 400 })
          : Response.json({
              signedIn: true,
              accessToken: jwt({ sub: 'user_1' }),
              expiresAt: Date.now() + 600_000,
              user: { id: 'user_1' },
            }),
      ),
    );
    expect(await makeTeam('')).toBeNull();
  });

  it('is offered where the app makes teams, and always on liveworkspace.app', () => {
    expect(canMakeTeam('livedocuments')).toBe(true);
    expect(canMakeTeam('livedesign')).toBe(true);
    expect(canMakeTeam('liveplanner')).toBe(false);
    expect(canMakeTeam(null)).toBe(true);
  });
});
