import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { people } = vi.hoisted(() => ({
  // Each team's people, as accounts holds them.
  people: new Map<string, import('@liveworkspace/auth-client').TeamPerson[]>(),
}));
vi.mock('./team-people', async (original) => ({
  ...(await original<typeof import('./team-people')>()),
  teamPeople: vi.fn(async (_env: unknown, teamId: string) => people.get(teamId) ?? null),
}));
// The caller's grant on a canvas for the notify-action route, as the index gives it: `d1` is the team's, `solo` the
// owner's own.
vi.mock('../routes/document-grant', () => ({
  resolveDocumentGrant: vi.fn(async (_ctx: unknown, item: string) =>
    item === 'd1' || item === 'solo'
      ? {
          item,
          level: 'edit',
          tab: null,
          sub: 'user_owner',
          team: item === 'd1' ? 'team1' : null,
          owner: 'user_owner',
          exp: 0,
          shareCode: null,
          token: `grant:${item}`,
        }
      : null,
  ),
}));
vi.mock('../index-service', async (original) => ({
  ...(await original<typeof import('../index-service')>()),
  requestGrant: vi.fn(async () => ({ ok: false, status: 404, error: 'not_found' })),
}));

import type { TeamClaim, TeamPerson } from '@liveworkspace/auth-client';
import type { Comment, Element } from '@livediagram/document';
import { afterChangeset } from '../changesets/after';
import { requestGrant } from '../index-service';
import { personTagFor } from '../person-tag';
import { accountsServiceFor, type TestAccountsService } from '../test-accounts-service';
import { sqliteD1, testDocument, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from '../routes/test-route-context';
import { handleDocuments } from '../routes/documents';
import { handleTeamNotifyRoutes } from '../routes/team-notify-routes';
import type { Env } from '../types';
import { pushNewComments, pushTag, pusher } from './push';

// Phone notifications from livediagram (docs/specs/014-identity/phone-notifications.md): who hears of a comment, a
// reply or an assignment, and where a tap goes. The send itself is accounts' (the stand-in records it).

const OWNER = 'user_owner';
const BOB = 'user_bob';
const CY = 'user_cy';
const TEAM = 'team1';
const TEAM_CLAIM: TeamClaim[] = [{ id: TEAM, name: 'Team', role: 'member' }];
const BASE = 'https://app.test';

const person = (
  id: string,
  userId: string | null,
  status: TeamPerson['status'] = 'joined',
): TeamPerson => ({
  id,
  userId,
  email: `${id}@x.test`,
  name: null,
  role: 'member',
  status,
});

let db: SqliteD1;
let fake: TestAccountsService;
let present: Set<string>;

beforeEach(() => {
  present = new Set();
  const env = { APP_BASE_URL: BASE, ROOM_PEOPLE: () => present } as Partial<Env>;
  fake = accountsServiceFor(env);
  db = sqliteD1(env);
  people.clear();
  people.set(TEAM, [
    person('m-owner', OWNER),
    person('m-bob', BOB),
    person('m-inv', null, 'invited'),
  ]);
  fake.accounts.set(OWNER, { name: 'Owen', email: 'owen@x.test' });
  fake.accounts.set(BOB, { name: 'Bob', email: 'bob@x.test' });
  testDocument(db, 'd1', OWNER, { name: 'Roadmap', teamId: TEAM });
  testDocument(db, 'solo', OWNER, { name: 'Solo' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function route(
  method: string,
  path: string,
  opts: { body?: unknown; as?: string; token?: boolean } = {},
) {
  const pending: Promise<unknown>[] = [];
  const as = opts.as ?? OWNER;
  const res = await handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner: as,
      accountUserId: opts.token ? null : as,
      verifiedUserId: as,
      body: opts.body,
      teams: TEAM_CLAIM,
      token: opts.token ? { id: 'tok_1' } : null,
      waitUntil: (p) => void pending.push(p),
    }),
  );
  await Promise.all(pending);
  return res;
}

const comment = (id: string, authorId: string, extra: Partial<Comment> = {}): Comment => ({
  id,
  text: 'a comment',
  createdAt: 1,
  authorName: authorId === OWNER ? 'Owen' : 'Bob',
  authorColor: '#000',
  authorId,
  ...extra,
});

const box = (comments: Comment[]) =>
  ({
    id: 'e1',
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...(comments.length ? { commentThread: { comments, resolved: false } } : {}),
  }) as unknown as Element;

const save = (elements: Element[], as = OWNER) =>
  route('PUT', '/api/documents/d1/tabs/t1', {
    body: { id: 't1', name: 'Board', elements },
    as,
  });

describe('a comment in a tab save', () => {
  it('tells the canvas’s owner of a teammate’s comment, opening its thread', async () => {
    expect((await save([box([comment('c1', BOB)])], BOB)).status).toBe(200);
    expect(fake.pushes).toEqual([
      {
        userId: OWNER,
        kind: 'comment',
        title: 'Bob commented on Roadmap',
        url: `${BASE}/document/d1#t=t1&el=e1&open=comments`,
        tag: 'd1:e1',
      },
    ]);
    // The next save carries the same comment: nothing new.
    await save([box([comment('c1', BOB)])], BOB);
    expect(fake.pushes).toHaveLength(1);
  });

  it('tells who wrote earlier in the thread of a reply, and a mentioned teammate of the mention, once each', async () => {
    await save([box([comment('c1', BOB)])], BOB);
    fake.pushes.length = 0;
    await save([
      box([
        comment('c1', BOB),
        comment('c2', OWNER, { mentions: [{ userId: BOB, name: 'Bob', handle: 'bob' }] }),
      ]),
    ]);
    expect(fake.pushes.map((p) => [p.userId, p.kind, p.title])).toEqual([
      [BOB, 'mention', 'Owen mentioned you in Roadmap'],
    ]);
    fake.pushes.length = 0;
    await save([box([comment('c1', BOB), comment('c2', OWNER), comment('c3', OWNER)])]);
    expect(fake.pushes.map((p) => [p.userId, p.kind])).toEqual([[BOB, 'threadReply']]);
  });

  it('sends nothing to someone looking at the canvas', async () => {
    present.add(await personTagFor('d1', OWNER));
    await save([box([comment('c1', BOB)])], BOB);
    expect(fake.pushes).toEqual([]);
  });

  it('refuses an API token’s whole-tab save before anything is sent', async () => {
    const res = await route('PUT', '/api/documents/d1/tabs/t1', {
      body: { id: 't1', name: 'Board', elements: [box([comment('c1', BOB)])] },
      as: BOB,
      token: true,
    });
    expect(res.status).toBe(405);
    expect(fake.pushes).toEqual([]);
  });

  it('goes whether or not email is on (no EMAIL binding here)', async () => {
    expect(db.env.EMAIL).toBeUndefined();
    await save([box([comment('c1', BOB)])], BOB);
    expect(fake.pushes).toHaveLength(1);
  });
});

describe('a comment in a changeset', () => {
  const run = (agent: boolean) =>
    afterChangeset.run(db.env, {
      document: {
        id: 'd1',
        name: 'Roadmap',
        ownerId: OWNER,
        teamId: TEAM,
      } as Parameters<typeof afterChangeset.run>[1]['document'],
      author: { id: BOB, name: 'Bob', color: '#000' },
      next: { id: 't1', name: 'Board', elements: [box([comment('c1', BOB)])] },
      stored: null,
      agent,
      frontDoor: 'Api',
      action: 'Applied',
    });

  it('a person’s tells the owner; an API token’s tells no one', async () => {
    await run(true);
    expect(fake.pushes).toEqual([]);
    await run(false);
    expect(fake.pushes.map((p) => [p.userId, p.kind, p.url])).toEqual([
      [OWNER, 'comment', `${BASE}/document/d1#t=t1&el=e1&open=comments`],
    ]);
  });
});

describe('a comment posted over REST', () => {
  it('a tab comment tells the owner; an API token’s tells no one', async () => {
    await save([box([])]);
    const post = (as: string, token = false) =>
      route('POST', '/api/documents/d1/tabs/t1/comments', {
        body: { elementId: 'e1', text: 'hello' },
        as,
        token,
      });
    expect((await post(BOB)).status).toBe(201);
    expect(fake.pushes.map((p) => [p.userId, p.kind, p.url])).toEqual([
      [OWNER, 'comment', `${BASE}/document/d1#t=t1&el=e1&open=comments`],
    ]);
    fake.pushes.length = 0;
    expect((await post(BOB, true)).status).toBe(201);
    expect(fake.pushes).toEqual([]);
  });

  it('a reply in a thread tells who wrote in it; resolving sends nothing', async () => {
    await save([box([comment('c1', BOB)])], BOB);
    fake.pushes.length = 0;
    const res = await route('POST', '/api/documents/d1/tabs/t1/comments/c1/reply', {
      body: { text: 'thanks' },
    });
    expect(res.status).toBe(201);
    expect(fake.pushes.map((p) => [p.userId, p.kind])).toEqual([[BOB, 'threadReply']]);
    fake.pushes.length = 0;
    expect((await route('POST', '/api/documents/d1/tabs/t1/comments/c1/resolve')).status).toBe(204);
    expect(fake.pushes).toEqual([]);
  });
});

describe('who may hear (share roles)', () => {
  const solo = { id: 'solo', name: 'Solo', ownerId: OWNER, teamId: null };
  const reply = (threadAuthors: string[]) =>
    pushNewComments(db.env, {
      document: solo,
      tabId: 't1',
      authorId: OWNER,
      authorName: 'Owen',
      previous: [box(threadAuthors.map((id, i) => comment(`old${i}`, id)))],
      next: [box([...threadAuthors.map((id, i) => comment(`old${i}`, id)), comment('new', OWNER)])],
    });

  it('an Editor, a Participant and a Viewer by link hear; someone without access, or a guest, never', async () => {
    vi.mocked(requestGrant).mockImplementation(async (_env, caller) => {
      const id = caller.kind === 'delegate' ? caller.personId : '';
      if (id === 'user_editor' || id === 'user_participant' || id === 'user_viewer')
        return { ok: true, grant: {} as never };
      if (id === 'user_password') return { ok: false, status: 403, error: 'password_required' };
      return { ok: false, status: 404, error: 'not_found' };
    });
    await reply([
      'user_editor',
      'user_participant',
      'user_viewer',
      'user_password',
      'user_removed',
      'guest_123',
    ]);
    expect(fake.pushes.map((p) => p.userId).sort()).toEqual([
      'user_editor',
      'user_participant',
      'user_password',
      'user_viewer',
    ]);
  });

  it('a team canvas’s joined people hear without an index ask', async () => {
    await pushNewComments(db.env, {
      document: { id: 'd1', name: 'Roadmap', ownerId: OWNER, teamId: TEAM },
      tabId: 't1',
      authorId: OWNER,
      authorName: 'Owen',
      previous: [box([comment('c1', BOB)])],
      next: [box([comment('c1', BOB), comment('c2', OWNER)])],
    });
    expect(fake.pushes.map((p) => p.userId)).toEqual([BOB]);
    expect(requestGrant).not.toHaveBeenCalled();
  });

  it('a guest’s comment notifies no one', async () => {
    await pushNewComments(db.env, {
      document: { id: 'd1', name: 'Roadmap', ownerId: OWNER, teamId: TEAM },
      tabId: 't1',
      authorId: 'guest_1',
      authorName: 'G',
      previous: [],
      next: [box([comment('c1', 'guest_1')])],
    });
    expect(fake.pushes).toEqual([]);
  });
});

describe('an action assigned', () => {
  const assign = async (body: Record<string, unknown>, documentId = 'd1') => {
    const pending: Promise<unknown>[] = [];
    const res = await handleTeamNotifyRoutes(
      makeTestRouteContext('POST', `/api/teams/${TEAM}/notify-action`, {
        env: db.env,
        owner: OWNER,
        accountUserId: OWNER,
        body: { documentId, assigneeUserId: BOB, actionName: 'Ship it', ...body },
        teams: TEAM_CLAIM,
        waitUntil: (p) => void pending.push(p),
      }),
      TEAM,
      OWNER,
    );
    await Promise.all(pending);
    return res!;
  };

  it('tells the assignee, at the action, even with the Email box unticked', async () => {
    expect((await assign({ email: false, tabId: 't1', elementId: 'e1' })).status).toBe(202);
    expect(fake.pushes).toEqual([
      {
        userId: BOB,
        kind: 'action',
        title: 'Owen assigned you an action in Roadmap',
        url: `${BASE}/document/d1#t=t1&el=e1&open=action`,
        tag: 'd1:e1',
      },
    ]);
  });

  it('opens the canvas when the place is not given, and skips an invited teammate with no account', async () => {
    await assign({});
    expect(fake.pushes.map((p) => [p.url, p.tag])).toEqual([[`${BASE}/document/d1`, 'd1:action']]);
    fake.pushes.length = 0;
    await assign({ assigneeUserId: undefined, assigneeMemberId: 'm-inv' });
    expect(fake.pushes).toEqual([]);
  });

  it('sends nothing to an assignee who can’t open the canvas, or who is looking at it', async () => {
    await assign({}, 'solo');
    expect(fake.pushes).toEqual([]);
    present.add(await personTagFor('d1', BOB));
    await assign({});
    expect(fake.pushes).toEqual([]);
  });
});

describe('the sending', () => {
  it('without accounts configured, sends nothing and throws nothing', async () => {
    const bare = sqliteD1({ APP_BASE_URL: BASE });
    // The assignee can open it, so the send is reached, with nothing to send through.
    vi.mocked(requestGrant).mockResolvedValue({ ok: true, grant: {} as never });
    await expect(
      pusher.pushActionAssigned(bare.env, {
        item: { id: 'd1', name: 'R', ownerId: OWNER, teamId: null },
        assignerId: OWNER,
        assignerName: 'Owen',
        assigneeUserId: CY,
        url: `${BASE}/document/d1`,
        tag: 'd1:a',
      }),
    ).resolves.toBeUndefined();
    expect(requestGrant).toHaveBeenCalled();
    expect(fake.pushes).toEqual([]);
  });

  it('logs an accounts outage and carries on', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await save([box([])]);
    fake.failWith = 500;
    expect((await save([box([comment('c1', BOB)])], BOB)).status).toBe(200);
    expect(warn).toHaveBeenCalledWith('[push] send_failed', expect.anything());
    warn.mockRestore();
  });

  it('keeps tags in the characters accounts takes', () => {
    expect(pushTag('d1', 'el/with spaces')).toBe('d1:el_with_spaces');
    expect(pushTag('d'.repeat(80), 'x')).toHaveLength(64);
  });
});
