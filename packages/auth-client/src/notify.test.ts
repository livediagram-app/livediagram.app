import { describe, expect, it } from 'vitest';
import { readTeamPeople, type TeamPerson } from './account';
import { notificationRecipients, notifyClaimKey, reachedMilestone, teamTargets } from './notify';

const CREDENTIALS = {
  accountsUrl: 'https://liveworkspace.app/',
  clientId: 'liveplanner',
  clientSecret: 's3cret',
};

function fakeFetch(respond: (path: string, body: Record<string, unknown>) => Response) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname.replace('/api/account/internal', '');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    calls.push({ path, body });
    return respond(path, body);
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe('notificationRecipients', () => {
  const request = {
    app: 'liveplanner.app' as const,
    setting: 'notifyMentions',
    scope: 'all' as const,
  };

  it('keeps verified addresses whose switch is not off, in two requests whatever the count', async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `user_${i}`);
    const { fetcher, calls } = fakeFetch((path) =>
      path === '/emails'
        ? Response.json({ emails: { user_0: 'a@x.test', user_1: 'b@x.test', user_2: 'c@x.test' } })
        : Response.json({
            settings: {
              user_1: { all: { notifyMentions: false }, app: {} },
              // Off in the wrong scope: still on.
              user_2: { all: {}, app: { notifyMentions: false } },
            },
          }),
    );
    const out = await notificationRecipients(
      CREDENTIALS,
      { ...request, ids: [...ids, 'guest_x', 'user_0'] },
      fetcher,
    );
    expect([...out]).toEqual([
      ['user_0', 'a@x.test'],
      ['user_2', 'c@x.test'],
    ]);
    expect(calls.map((c) => c.path).sort()).toEqual(['/emails', '/settings/notify']);
    expect(calls.find((c) => c.path === '/settings/notify')?.body).toMatchObject({
      app: 'liveplanner.app',
      keys: ['notifyMentions'],
    });
  });

  it('reads a failed switch read as on, and a failed address read as nobody', async () => {
    const settingsDown = fakeFetch((path) =>
      path === '/emails'
        ? Response.json({ emails: { user_0: 'a@x.test' } })
        : new Response(null, { status: 503 }),
    );
    expect([
      ...(await notificationRecipients(
        CREDENTIALS,
        { ...request, ids: ['user_0'] },
        settingsDown.fetcher,
      )),
    ]).toEqual([['user_0', 'a@x.test']]);
    const emailsDown = fakeFetch(() => new Response(null, { status: 503 }));
    expect(
      (
        await notificationRecipients(
          CREDENTIALS,
          { ...request, ids: ['user_0'] },
          emailsDown.fetcher,
        )
      ).size,
    ).toBe(0);
  });

  it('asks nothing for guests alone', async () => {
    const { fetcher, calls } = fakeFetch(() => Response.json({}));
    expect(
      (await notificationRecipients(CREDENTIALS, { ...request, ids: ['guest_x'] }, fetcher)).size,
    ).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe('teamTargets', () => {
  const people: TeamPerson[] = [
    {
      id: 'm1',
      userId: 'user_ada',
      email: 'ada@x.test',
      name: 'Ada',
      role: 'admin',
      status: 'joined',
    },
    {
      id: 'm2',
      userId: 'user_bea',
      email: 'bea@x.test',
      name: 'Bea',
      role: 'member',
      status: 'joined',
    },
    { id: 'm3', userId: null, email: 'cy@x.test', name: null, role: 'member', status: 'invited' },
  ];

  it("keeps the team's people, once each, never the sender or a stranger", () => {
    const out = teamTargets(
      people,
      [
        { userId: 'user_bea' },
        { memberId: 'm2', userId: 'user_bea' },
        { memberId: 'm3', userId: null },
        { userId: 'user_ada' },
        { userId: 'user_stranger' },
        { memberId: 'm-other' },
      ],
      'user_ada',
    );
    expect(out.map((p) => p.id)).toEqual(['m2', 'm3']);
  });
});

describe('reachedMilestone', () => {
  it('names the highest milestone a count has reached, or none', () => {
    expect(reachedMilestone(null)).toBeNull();
    expect(reachedMilestone(9)).toBeNull();
    expect(reachedMilestone(10)).toBe(10);
    expect(reachedMilestone(500)).toBe(10);
  });
});

describe('notifyClaimKey', () => {
  it('is a stable hash that holds none of its parts', async () => {
    const key = await notifyClaimKey(['mention', 'plan', 'user_bea', 'secret words']);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).toBe(await notifyClaimKey(['mention', 'plan', 'user_bea', 'secret words']));
    expect(key).not.toBe(await notifyClaimKey(['mention', 'plan', 'user_bea', 'other words']));
  });
});

describe('readTeamPeople', () => {
  it('answers the team, or null for none', async () => {
    const found = fakeFetch(() =>
      Response.json({ team: { id: 't1', name: 'Design' }, members: [] }),
    );
    expect(await readTeamPeople(CREDENTIALS, 't1', found.fetcher)).toEqual({
      team: { id: 't1', name: 'Design' },
      members: [],
    });
    expect(found.calls[0]).toEqual({ path: '/teams/members', body: { teamId: 't1' } });
    const missing = fakeFetch(() => new Response(null, { status: 404 }));
    expect(await readTeamPeople(CREDENTIALS, 't1', missing.fetcher)).toBeNull();
  });
});
