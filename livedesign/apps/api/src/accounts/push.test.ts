import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./profiles', async () => (await import('../test-profiles')).fakeProfilesModule());
vi.mock('../index-service', async (original) => {
  const { testIndexFor, testRequestGrant } = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    indexFor: testIndexFor,
    requestGrant: vi.fn(testRequestGrant),
  };
});

import type { TeamClaim, TeamPerson } from '@liveworkspace/auth-client';
import type { Comment, Element } from '@livedesign/design';
import { afterChangeset } from '../changesets/after';
import { requestGrant } from '../index-service';
import { personTagFor } from '../person-tag';
import { resetProfiles, seedProfile } from '../test-profiles';
import { ACCOUNTS_ENV, fakeAccounts, INDEX_ENV, type FakeAccounts } from '../test-accounts';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from '../routes/test-route-context';
import { handleDesigns } from '../routes/designs';
import type { DesignDTO, Env } from '../types';
import { pushItemOf, pushNewComments, pushTag, pusher } from './push';

// Phone notifications from livedesign (docs/specs/014-identity/phone-notifications.md): who hears of a comment, a
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
let fake: FakeAccounts;
let present: Set<string>;

beforeEach(() => {
  fake = fakeAccounts();
  vi.stubGlobal('fetch', fake.fetch);
  present = new Set();
  db = sqliteD1({
    ...ACCOUNTS_ENV,
    ...INDEX_ENV,
    APP_BASE_URL: BASE,
    ROOM_PEOPLE: () => present,
  } as Partial<Env>);
  fake.teamPeople.set(TEAM, [
    person('m-owner', OWNER),
    person('m-bob', BOB),
    person('m-inv', null, 'invited'),
  ]);
  resetProfiles();
  seedProfile(OWNER, 'Owen');
  seedProfile(BOB, 'Bob');
  db.sql.exec(`
    INSERT INTO test_designs (id, owner_id, name, team_id, saved_at, created_at) VALUES ('d1', '${OWNER}', 'Roadmap', '${TEAM}', 1, 1);
    INSERT INTO test_designs (id, owner_id, name, team_id, saved_at, created_at) VALUES ('solo', '${OWNER}', 'Solo', NULL, 1, 1);
  `);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function route(
  method: string,
  path: string,
  opts: { body?: unknown; as?: string; teams?: TeamClaim[]; token?: boolean } = {},
) {
  const pending: Promise<unknown>[] = [];
  const as = opts.as ?? OWNER;
  const res = await handleDesigns(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner: as,
      accountUserId: opts.token ? null : as,
      verifiedUserId: as,
      body: opts.body,
      teams: opts.teams ?? TEAM_CLAIM,
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
  route('PUT', '/api/designs/d1/tabs/t1', {
    body: { id: 't1', name: 'Page', elements },
    as,
  });

describe('a comment in a tab save', () => {
  it('tells the design’s owner of a teammate’s comment, opening its thread', async () => {
    expect((await save([box([comment('c1', BOB)])], BOB)).status).toBe(200);
    expect(fake.pushes).toEqual([
      {
        userId: OWNER,
        kind: 'comment',
        title: 'Bob commented on Roadmap',
        url: `${BASE}/design/d1#t=t1&el=e1&open=comments`,
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
        comment('c2', OWNER, {
          mentions: [{ userId: BOB, name: 'Bob', handle: 'bob' }],
        }),
      ]),
    ]);
    expect(fake.pushes.map((p) => [p.userId, p.kind, p.title])).toEqual([
      [BOB, 'mention', 'Owen mentioned you in Roadmap'],
    ]);
    fake.pushes.length = 0;
    await save([box([comment('c1', BOB), comment('c2', OWNER), comment('c3', OWNER)])]);
    expect(fake.pushes.map((p) => [p.userId, p.kind])).toEqual([[BOB, 'threadReply']]);
  });

  it('sends nothing to someone looking at the design', async () => {
    present.add(await personTagFor('d1', OWNER));
    await save([box([comment('c1', BOB)])], BOB);
    expect(fake.pushes).toEqual([]);
  });

  it('goes whether or not email is on (no EMAIL binding here)', async () => {
    expect(db.env.EMAIL).toBeUndefined();
    await save([box([comment('c1', BOB)])], BOB);
    expect(fake.pushes).toHaveLength(1);
  });
});

describe('a comment in a changeset', () => {
  const design = { id: 'd1', name: 'Roadmap', ownerId: OWNER, teamId: TEAM } as DesignDTO;
  const run = (agent: boolean) =>
    afterChangeset.run(db.env, {
      design,
      author: { id: BOB, name: 'Bob' } as never,
      next: { id: 't1', name: 'Page', elements: [box([comment('c1', BOB)])] },
      stored: { id: 't1', name: 'Page', elements: [box([])] },
      agent,
      frontDoor: 'api' as never,
      action: 'Applied',
    });

  it('a person’s changeset tells the owner; an API token’s tells no one', async () => {
    await run(true);
    expect(fake.pushes).toEqual([]);
    await run(false);
    expect(fake.pushes.map((p) => [p.userId, p.kind, p.url])).toEqual([
      [OWNER, 'comment', `${BASE}/design/d1#t=t1&el=e1&open=comments`],
    ]);
  });
});

describe('a comment posted over REST', () => {
  it('a tab comment tells the owner; an API token’s tells no one', async () => {
    await save([box([])]);
    const post = (as: string, token = false) =>
      route('POST', '/api/designs/d1/tabs/t1/comments', {
        body: { elementId: 'e1', text: 'hello' },
        as,
        token,
      });
    expect((await post(BOB)).status).toBe(201);
    expect(fake.pushes.map((p) => [p.userId, p.kind, p.url])).toEqual([
      [OWNER, 'comment', `${BASE}/design/d1#t=t1&el=e1&open=comments`],
    ]);
    fake.pushes.length = 0;
    expect((await post(BOB, true)).status).toBe(201);
    expect(fake.pushes).toEqual([]);
  });

  it('a reply in a tab thread tells who wrote in it', async () => {
    await save([box([comment('c1', BOB)])], BOB);
    fake.pushes.length = 0;
    const res = await route('POST', '/api/designs/d1/tabs/t1/comments/c1/reply', {
      body: { text: 'thanks' },
    });
    expect(res.status).toBe(201);
    expect(fake.pushes.map((p) => [p.userId, p.kind])).toEqual([[BOB, 'threadReply']]);
  });
});

describe('who may hear (share roles)', () => {
  const design = { id: 'solo', name: 'Solo', ownerId: OWNER, teamId: null };
  const reply = (threadAuthors: string[]) => {
    const earlier = threadAuthors.map((id, i) => comment(`old${i}`, id));
    return pushNewComments(db.env, {
      design,
      tabId: 't1',
      authorId: OWNER,
      authorName: 'Owen',
      previous: [box(earlier)],
      next: [box([...earlier, comment('new', OWNER)])],
    });
  };

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

  it('a team design’s joined people hear without an index ask; an invited one with no account never', async () => {
    await pushNewComments(db.env, {
      design: { id: 'd1', name: 'Roadmap', ownerId: OWNER, teamId: TEAM },
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
      design: { id: 'd1', name: 'Roadmap', ownerId: OWNER, teamId: TEAM },
      tabId: 't1',
      authorId: 'guest_1',
      authorName: 'G',
      previous: [],
      next: [box([comment('c1', 'guest_1')])],
    });
    expect(fake.pushes).toEqual([]);
  });

  it('reads past a stored thread with no comments list', async () => {
    const bare = { ...box([]), commentThread: { resolved: false } } as unknown as Element;
    await pushNewComments(db.env, {
      design: { id: 'd1', name: 'Roadmap', ownerId: OWNER, teamId: TEAM },
      tabId: 't1',
      authorId: BOB,
      authorName: 'Bob',
      previous: [bare],
      next: [bare],
    });
    expect(fake.pushes).toEqual([]);
  });
});

describe('an action assigned', () => {
  const assign = (body: Record<string, unknown>) =>
    route('POST', '/api/designs/d1/notify-action', {
      body: { teamId: TEAM, assigneeUserId: BOB, actionName: 'Ship it', ...body },
    });

  it('tells the assignee, at the action, even with the Email box unticked', async () => {
    expect((await assign({ email: false, tabId: 't1', elementId: 'e1' })).status).toBe(202);
    expect(fake.pushes).toEqual([
      {
        userId: BOB,
        kind: 'action',
        title: 'Owen assigned you an action in Roadmap',
        url: `${BASE}/design/d1#t=t1&el=e1&open=action`,
        tag: 'd1:e1',
      },
    ]);
  });

  it('opens the design when the place is not given, and skips an invited teammate with no account', async () => {
    await assign({});
    expect(fake.pushes.map((p) => [p.url, p.tag])).toEqual([[`${BASE}/design/d1`, 'd1:action']]);
    fake.pushes.length = 0;
    await assign({ assigneeUserId: undefined, assigneeMemberId: 'm-inv' });
    expect(fake.pushes).toEqual([]);
  });

  it('refuses a place that is not an id', async () => {
    expect((await assign({ tabId: 7, elementId: 'e1' })).status).toBe(400);
    expect((await assign({ tabId: 't1', elementId: 'x'.repeat(201) })).status).toBe(400);
    expect(fake.pushes).toEqual([]);
  });

  it('sends nothing to an assignee who can’t open the design', async () => {
    vi.mocked(requestGrant).mockResolvedValue({ ok: false, status: 404, error: 'not_found' });
    await route('POST', '/api/designs/solo/notify-action', {
      body: { teamId: TEAM, assigneeUserId: BOB, actionName: 'Ship it' },
    });
    expect(fake.pushes).toEqual([]);
  });
});

describe('the sending', () => {
  it('without accounts configured, sends nothing and throws nothing', async () => {
    const bare = sqliteD1({ APP_BASE_URL: BASE });
    await expect(
      pusher.pushActionAssigned(bare.env, {
        item: { id: 'd1', name: 'R', ownerId: CY, teamId: null },
        assignerId: OWNER,
        assignerName: 'Owen',
        assigneeUserId: CY,
        url: `${BASE}/design/d1`,
        tag: 'd1:a',
      }),
    ).resolves.toBeUndefined();
    expect(fake.pushes).toEqual([]);
  });

  it('logs an accounts outage and carries on', async () => {
    fake.failing.set('push', 500);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await save([box([comment('c1', BOB)])], BOB)).status).toBe(200);
    expect(warn).toHaveBeenCalledWith('[push] send_failed', expect.anything());
    warn.mockRestore();
  });

  it('keeps tags in the characters accounts takes', () => {
    expect(pushTag('d1', 'el/with spaces')).toBe('d1:el_with_spaces');
    expect(pushTag('d'.repeat(80), 'x')).toHaveLength(64);
  });

  it('reads a design with no team as a solo one', () => {
    expect(pushItemOf({ id: 'd1', name: 'R', ownerId: OWNER }).teamId).toBeNull();
  });
});
