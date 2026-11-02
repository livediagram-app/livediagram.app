import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamPerson } from '@liveworkspace/auth-client';
import { MENTIONS_MAX } from '@livediagram/document';
import type { GrantOutcome, ItemGrant } from '../index-service';
import type { Env } from '../types';

// /api/teams/<id>/access-check, /notify-action and /notify-mention (docs/specs/012-collaboration/assigned-actions.md,
// comment-mentions.md). The team's people are accounts' (liveworkspace/team-people.ts); whether someone can open a
// canvas is the index's (the caller's grant, and one asked for the teammate); the email is the canvas's Durable
// Object's (notifyAction / notifyMention). Anyone or anything the caller cannot name answers 404, never 403.
// teams.ts checks the caller is in the team before these run (teams.test.ts).

const { people, grants, asked, room, participants } = vi.hoisted(() => ({
  // Each team's people, as accounts holds them.
  people: new Map<string, TeamPerson[]>(),
  // The caller's grant on each canvas, as the index gives it.
  grants: new Map<string, ItemGrant>(),
  // What the index answers a teammate's grant asked for them, by `${personId} ${documentId}`.
  asked: new Map<string, GrantOutcome>(),
  room: {
    documentRoom: vi.fn(),
    notifyAction: vi.fn(async (_input: unknown) => true),
    notifyMention: vi.fn(async (_input: unknown) => true),
  },
  participants: new Map<string, { name: string }>(),
}));
vi.mock('../liveworkspace/team-people', () => ({
  teamPeople: vi.fn(async (_env: Env, teamId: string) => people.get(teamId) ?? null),
}));
vi.mock('./document-grant', () => ({
  resolveDocumentGrant: vi.fn(
    async (_ctx: unknown, documentId: string) => grants.get(documentId) ?? null,
  ),
}));
vi.mock('../index-service', () => ({
  requestGrant: vi.fn(
    async (_env: Env, caller: { personId: string }, documentId: string): Promise<GrantOutcome> =>
      asked.get(`${caller.personId} ${documentId}`) ?? {
        ok: false,
        status: 404,
        error: 'not_found',
      },
  ),
}));
vi.mock('../document-client', () => ({ documentRoom: room.documentRoom }));
vi.mock('../liveworkspace/profiles', () => ({
  getParticipant: vi.fn(async (_env: Env, id: string) => participants.get(id) ?? null),
}));

import { requestGrant } from '../index-service';
import {
  ACTION_DESCRIPTION_MAX,
  ACTION_NAME_MAX,
  handleTeamNotifyRoutes,
} from './team-notify-routes';
import { makeTestRouteContext } from './test-route-context';

const TEAM = 'team_1';
const ME = 'user_me';

const person = (
  id: string,
  userId: string | null,
  status: TeamPerson['status'] = 'joined',
): TeamPerson => ({
  id,
  userId,
  email: `${id}@x.test`,
  name: userId,
  role: 'member',
  status,
});

const grant = (item: string, over: Partial<ItemGrant> = {}): ItemGrant => ({
  item,
  level: 'edit',
  tab: null,
  sub: ME,
  team: TEAM,
  owner: 'user_owner',
  exp: 0,
  shareCode: null,
  token: `grant:${item}`,
  ...over,
});

beforeEach(() => {
  people.clear();
  grants.clear();
  asked.clear();
  participants.clear();
  vi.mocked(requestGrant).mockClear();
  room.notifyAction.mockReset().mockResolvedValue(true);
  room.notifyMention.mockReset().mockResolvedValue(true);
  room.documentRoom.mockReset().mockImplementation(() => ({
    notifyAction: room.notifyAction,
    notifyMention: room.notifyMention,
  }));
  people.set(TEAM, [
    person('m-me', ME),
    person('m-ada', 'user_ada'),
    person('m-bob', 'user_bob'),
    person('m-inv', null, 'invited'),
    person('m-cy', 'user_cy', 'invited'),
  ]);
  participants.set(ME, { name: 'Me Myself' });
  // `team-doc` is in the team's library; `own-doc` is someone's own.
  grants.set('team-doc', grant('team-doc'));
  grants.set('own-doc', grant('own-doc', { team: null, owner: ME }));
});

const call = (
  method: string,
  path: string,
  opts: { body?: unknown; user?: string; token?: boolean; email?: string | null } = {},
) => {
  const user = opts.user ?? ME;
  return handleTeamNotifyRoutes(
    makeTestRouteContext(method, `/api/teams/${TEAM}/${path}`, {
      owner: user,
      accountUserId: opts.token ? null : user,
      verifiedUserId: user,
      accountEmail: opts.email === undefined ? 'me@x.test' : opts.email,
      body: opts.body,
      ...(opts.token ? { token: { id: 'tok_1' } } : {}),
    }),
    TEAM,
    user,
  ) as Promise<Response>;
};

describe('every route', () => {
  it('answers a team accounts does not have as missing', async () => {
    people.delete(TEAM);
    expect(
      (await call('GET', 'access-check?assigneeUserId=user_ada&documentId=team-doc')).status,
    ).toBe(404);
  });

  it('refuses a caller the team has not joined (removed since their token, or still invited)', async () => {
    expect(
      (
        await call('GET', 'access-check?assigneeUserId=user_ada&documentId=team-doc', {
          user: 'user_cy',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call('GET', 'access-check?assigneeUserId=user_ada&documentId=team-doc', {
          user: 'user_gone',
        })
      ).status,
    ).toBe(403);
    expect(room.documentRoom).not.toHaveBeenCalled();
  });

  it('is not one of these routes for any other path', async () => {
    expect(
      await handleTeamNotifyRoutes(
        makeTestRouteContext('GET', `/api/teams/${TEAM}/members`),
        TEAM,
        ME,
      ),
    ).toBeNull();
  });
});

describe('GET access-check', () => {
  const check = async (assignee: string, documentId: string, opts: { token?: boolean } = {}) => {
    const res = await call(
      'GET',
      `access-check?assigneeUserId=${assignee}&documentId=${documentId}`,
      opts,
    );
    return { status: res.status, body: await res.json() };
  };

  it("is true for any joined teammate on a canvas in this team's library", async () => {
    expect(await check('user_ada', 'team-doc')).toEqual({ status: 200, body: { canAccess: true } });
    expect(requestGrant).not.toHaveBeenCalled();
  });

  it('is true for the canvas owner', async () => {
    grants.set('own-doc', grant('own-doc', { team: null, owner: 'user_ada' }));
    expect(await check('user_ada', 'own-doc')).toEqual({ status: 200, body: { canAccess: true } });
  });

  it("is true for a joined member of the canvas's own team", async () => {
    grants.set('other-doc', grant('other-doc', { team: 'team_2' }));
    people.set('team_2', [person('m2-ada', 'user_ada'), person('m2-bob', 'user_bob', 'invited')]);
    expect(await check('user_ada', 'other-doc')).toEqual({
      status: 200,
      body: { canAccess: true },
    });
    expect(await check('user_bob', 'other-doc')).toEqual({
      status: 200,
      body: { canAccess: false },
    });
  });

  it('asks the index for the teammate, with no team: a link they opened, or one behind a password', async () => {
    expect(await check('user_ada', 'own-doc')).toEqual({ status: 200, body: { canAccess: false } });
    expect(requestGrant).toHaveBeenCalledWith(
      expect.anything(),
      { kind: 'delegate', personId: 'user_ada', teams: [] },
      'own-doc',
      null,
    );
    asked.set('user_ada own-doc', { ok: true, grant: {} as never });
    asked.set('user_bob own-doc', { ok: false, status: 403, error: 'password_required' });
    expect(await check('user_ada', 'own-doc')).toEqual({ status: 200, body: { canAccess: true } });
    expect(await check('user_bob', 'own-doc')).toEqual({ status: 200, body: { canAccess: true } });
  });

  it('answers an API token too (a read)', async () => {
    expect(await check('user_ada', 'team-doc', { token: true })).toEqual({
      status: 200,
      body: { canAccess: true },
    });
  });

  it('answers 400 without both params, and 404 for an assignee not joined here or a canvas the caller cannot open', async () => {
    expect((await call('GET', 'access-check?assigneeUserId=user_ada')).status).toBe(400);
    expect((await call('GET', 'access-check?documentId=team-doc')).status).toBe(400);
    expect((await check('user_cy', 'team-doc')).status).toBe(404);
    expect((await check('user_stranger', 'team-doc')).status).toBe(404);
    expect((await check('user_ada', 'nowhere')).status).toBe(404);
    expect(
      (await call('POST', 'access-check?assigneeUserId=user_ada&documentId=team-doc')).status,
    ).toBe(404);
  });
});

describe('POST notify-action', () => {
  const assign = (body: Record<string, unknown>, opts: Parameters<typeof call>[2] = {}) =>
    call('POST', 'notify-action', {
      ...opts,
      body: {
        assigneeUserId: 'user_ada',
        documentId: 'team-doc',
        actionName: '  Ship it  ',
        ...body,
      },
    });

  it("answers 202 and has the canvas send the email, with the assigner's verified name", async () => {
    const res = await assign({ description: 'By Friday', assignerName: 'Spoofed' });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });
    expect(room.documentRoom).toHaveBeenCalledWith(expect.anything(), 'team-doc');
    expect(room.notifyAction).toHaveBeenCalledWith({
      assignee: expect.objectContaining({ id: 'm-ada', userId: 'user_ada' }),
      assignerUserId: ME,
      assignerName: 'Me Myself',
      assigneeCanOpen: true,
      actionName: 'Ship it',
      description: 'By Friday',
      email: true,
      push: { url: expect.stringMatching(/\/document\/team-doc$/), tag: 'team-doc:action' },
    });
  });

  it('passes the Email box and the action’s place on for the phone notification', async () => {
    await assign({ email: false, tabId: 't1', elementId: 'e1' });
    expect(room.notifyAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        email: false,
        push: {
          url: expect.stringMatching(/\/document\/team-doc#t=t1&el=e1&open=action$/),
          tag: 'team-doc:e1',
        },
      }),
    );
    // A place id past the cap is no place: the canvas's own link.
    await assign({ tabId: 't1', elementId: 'e'.repeat(201) });
    expect(room.notifyAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        email: true,
        push: { url: expect.stringMatching(/\/document\/team-doc$/), tag: 'team-doc:action' },
      }),
    );
  });

  it("falls back to the caller's email without a profile name, and takes the legacy diagramId", async () => {
    participants.clear();
    const res = await assign({ documentId: undefined, diagramId: 'team-doc', description: '   ' });
    expect(res.status).toBe(202);
    expect(room.notifyAction).toHaveBeenCalledWith(
      expect.objectContaining({ assignerName: 'me@x.test', description: null }),
    );
  });

  it('reaches an invited teammate, by account when they have one and by membership otherwise', async () => {
    expect((await assign({ assigneeUserId: 'user_cy' })).status).toBe(202);
    expect((await assign({ assigneeUserId: undefined, assigneeMemberId: 'm-inv' })).status).toBe(
      202,
    );
    expect(
      room.notifyAction.mock.calls.map(([a]) => (a as { assignee: TeamPerson }).assignee.id),
    ).toEqual(['m-cy', 'm-inv']);
  });

  it('marks a canvas the assignee cannot open, so the email leaves its name out', async () => {
    expect((await assign({ documentId: 'own-doc' })).status).toBe(202);
    expect(room.notifyAction).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeCanOpen: false }),
    );
  });

  it('answers 404 for someone not in the team, the caller themselves, or a canvas the caller cannot open', async () => {
    expect((await assign({ assigneeUserId: 'user_stranger' })).status).toBe(404);
    expect((await assign({ assigneeUserId: ME })).status).toBe(404);
    expect((await assign({ documentId: 'nowhere' })).status).toBe(404);
    expect(room.notifyAction).not.toHaveBeenCalled();
  });

  it('answers 404 when the canvas sends nothing (no such canvas any more)', async () => {
    room.notifyAction.mockResolvedValue(false);
    expect((await assign({})).status).toBe(404);
  });

  it('refuses an API token, or a caller who is not the signed-in account', async () => {
    expect((await assign({}, { token: true })).status).toBe(403);
    const res = await handleTeamNotifyRoutes(
      makeTestRouteContext('POST', `/api/teams/${TEAM}/notify-action`, {
        owner: ME,
        accountUserId: 'user_ada',
        body: { assigneeUserId: 'user_bob', documentId: 'team-doc', actionName: 'A' },
      }),
      TEAM,
      ME,
    );
    expect(res!.status).toBe(403);
    expect(room.notifyAction).not.toHaveBeenCalled();
  });

  it('answers 400 for a missing field, or an action name or description over its cap', async () => {
    expect((await assign({ assigneeUserId: undefined })).status).toBe(400);
    expect((await assign({ documentId: undefined })).status).toBe(400);
    expect((await assign({ actionName: '   ' })).status).toBe(400);
    expect((await assign({ actionName: 'a'.repeat(ACTION_NAME_MAX) })).status).toBe(202);
    expect((await assign({ actionName: 'a'.repeat(ACTION_NAME_MAX + 1) })).status).toBe(400);
    expect((await assign({ description: 'd'.repeat(ACTION_DESCRIPTION_MAX) })).status).toBe(202);
    expect((await assign({ description: 'd'.repeat(ACTION_DESCRIPTION_MAX + 1) })).status).toBe(
      400,
    );
    expect(room.notifyAction).toHaveBeenCalledTimes(2);
  });
});

describe('POST notify-mention', () => {
  const mention = (body: Record<string, unknown>, opts: Parameters<typeof call>[2] = {}) =>
    call('POST', 'notify-mention', {
      ...opts,
      body: {
        documentId: 'team-doc',
        commentText: '  @ada have a look  ',
        mentions: [{ userId: 'user_ada' }],
        ...body,
      },
    });

  it("answers 202 and has the canvas email each teammate named, with the author's verified name", async () => {
    const res = await mention({ authorName: 'Spoofed' });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });
    expect(room.notifyMention).toHaveBeenCalledWith({
      recipients: [expect.objectContaining({ id: 'm-ada' })],
      authorUserId: ME,
      authorName: 'Me Myself',
      commentText: '@ada have a look',
    });
  });

  it('reaches an invited teammate by membership, and skips the author, strangers and repeats', async () => {
    const res = await mention({
      mentions: [
        { userId: 'user_ada' },
        { memberId: 'm-inv' },
        { userId: ME },
        { userId: 'user_stranger' },
        { memberId: 'm-ada' },
        null,
      ],
    });
    expect(res.status).toBe(202);
    const [input] = room.notifyMention.mock.calls[0]! as [{ recipients: TeamPerson[] }];
    expect(input.recipients.map((p) => p.id)).toEqual(['m-ada', 'm-inv']);
  });

  it('answers 202 without a call when nobody named is a teammate', async () => {
    expect(
      (await mention({ mentions: [{ userId: ME }, { userId: 'user_stranger' }] })).status,
    ).toBe(202);
    expect(room.notifyMention).not.toHaveBeenCalled();
  });

  it("answers 404 for a canvas not in this team's library, or one the caller cannot open", async () => {
    expect((await mention({ documentId: 'own-doc' })).status).toBe(404);
    grants.set('other-doc', grant('other-doc', { team: 'team_2' }));
    expect((await mention({ documentId: 'other-doc' })).status).toBe(404);
    expect((await mention({ documentId: 'nowhere' })).status).toBe(404);
    expect(room.notifyMention).not.toHaveBeenCalled();
  });

  it('refuses an API token', async () => {
    expect((await mention({}, { token: true })).status).toBe(403);
  });

  it('answers 400 for a missing field, a comment over its cap, or too many mentions', async () => {
    expect((await mention({ documentId: undefined })).status).toBe(400);
    expect((await mention({ commentText: '  ' })).status).toBe(400);
    expect((await mention({ mentions: 'user_ada' })).status).toBe(400);
    expect((await mention({ commentText: 'c'.repeat(5000) })).status).toBe(202);
    expect((await mention({ commentText: 'c'.repeat(5001) })).status).toBe(400);
    const many = Array.from({ length: MENTIONS_MAX + 1 }, () => ({ userId: 'user_ada' }));
    expect((await mention({ mentions: many.slice(1) })).status).toBe(202);
    expect((await mention({ mentions: many })).status).toBe(400);
    expect(room.notifyMention).toHaveBeenCalledTimes(2);
  });
});
