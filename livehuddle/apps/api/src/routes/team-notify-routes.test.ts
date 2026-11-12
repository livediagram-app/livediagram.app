import { describe, expect, it, vi } from 'vitest';
import { handleTeamNotifyRoutes } from './team-notify-routes';
import { makeTestRouteContext } from './test-route-context';

// /api/teams/<id>/access-check, /notify-action and /notify-mention: livehuddle has no assigned actions or mentions
// (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes"), so every one answers 410
// and no email goes. teams.ts checks the caller is in the team before these run (teams.test.ts).

describe('the team notify routes', () => {
  it('answer 410 gone to the access check, an action assigned and a mention', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    for (const [method, route] of [
      ['GET', 'access-check'],
      ['POST', 'notify-action'],
      ['POST', 'notify-mention'],
    ] as const) {
      const res = handleTeamNotifyRoutes(
        makeTestRouteContext(method, `/api/teams/team_1/${route}`, {
          owner: 'user_me',
          ...(method === 'POST' ? { body: { documentId: 'd1', actionName: 'Do it' } } : {}),
        }),
      );
      expect(res?.status).toBe(410);
      expect(await res!.json()).toMatchObject({ error: 'gone' });
    }
  });

  it('leave every other path to the teams router', () => {
    expect(
      handleTeamNotifyRoutes(makeTestRouteContext('GET', '/api/teams/team_1/members', {})),
    ).toBeNull();
    expect(
      handleTeamNotifyRoutes(makeTestRouteContext('GET', '/api/teams/team_1/notify-action/x', {})),
    ).toBeNull();
  });
});
