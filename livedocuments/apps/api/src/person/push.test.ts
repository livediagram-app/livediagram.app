import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./profiles', () => import('../test-profiles'));
vi.mock('../index-service', async (original) => {
  const { testIndexFor, testRequestGrant } = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    indexFor: testIndexFor,
    requestGrant: vi.fn(testRequestGrant),
  };
});

import type { TeamClaim, TeamPerson } from '@liveworkspace/auth-client';
import type { Comment, Element, Tab } from '@livedocuments/document';
import { afterChangeset } from '../changesets/after';
import { requestGrant } from '../index-service';
import { personTagFor } from '../person-tag';
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import { ACCOUNTS_ON, INDEX_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from '../routes/test-route-context';
import { handleDocuments } from '../routes/documents';
import type { DocumentDTO, Env } from '../types';
import { pushNewComments, pushTag, pusher } from './push';

// Phone notifications from livedocuments (docs/specs/014-identity/phone-notifications.md): who hears of a comment,
// a reply or an assignment, and where a tap goes. The send itself is accounts' (the stand-in records it).

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
  fake = stubAccounts();
  present = new Set();
  db = sqliteD1({
    ...ACCOUNTS_ON,
    ...INDEX_ON,
    APP_BASE_URL: BASE,
    ROOM_PEOPLE: () => present,
  } as Partial<Env>);
  fake.teams.set(TEAM, [
    person('m-owner', OWNER),
    person('m-bob', BOB),
    person('m-inv', null, 'invited'),
  ]);
  clearTestProfiles();
  setTestProfile(OWNER, 'Owen');
  setTestProfile(BOB, 'Bob');
  db.sql.exec(`
    INSERT INTO test_documents (id, owner_id, name, team_id, saved_at, created_at) VALUES ('d1', '${OWNER}', 'Roadmap', '${TEAM}', 1, 1);
  `);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

async function route(
  method: string,
  path: string,
  opts: { body?: unknown; as?: string; teams?: TeamClaim[]; token?: boolean } = {},
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
  route('PUT', '/api/documents/d1/tabs/t1', {
    body: { id: 't1', name: 'Page', elements },
    as,
  });

describe('a comment in a tab save', () => {
  it('tells the document’s owner of a teammate’s comment, opening its thread', async () => {
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

  it('refuses an API token’s save, and sends nothing to someone looking at the document', async () => {
    const token = await route('PUT', '/api/documents/d1/tabs/t1', {
      body: { id: 't1', name: 'Page', elements: [box([comment('c1', BOB)])] },
      as: BOB,
      token: true,
    });
    expect(token.status).toBeGreaterThanOrEqual(400);
    expect(fake.pushes).toEqual([]);
    present.add(await personTagFor('d1', OWNER));
    await save([box([comment('c2', BOB)])], BOB);
    expect(fake.pushes).toEqual([]);
  });

  it('goes whether or not email is on (no EMAIL binding here)', async () => {
    expect(db.env.EMAIL).toBeUndefined();
    await save([box([comment('c1', BOB)])], BOB);
    expect(fake.pushes).toHaveLength(1);
  });
});

describe('a comment in a changeset', () => {
  const document = {
    id: 'd1',
    name: 'Roadmap',
    ownerId: OWNER,
    teamId: TEAM,
  } as DocumentDTO;
  const run = (agent: boolean) =>
    afterChangeset.run(db.env, {
      document,
      author: { id: BOB, name: 'Bob', color: '#000' },
      next: { id: 't1', elements: [box([comment('c1', BOB)])] } as unknown as Tab,
      stored: null,
      agent,
      frontDoor: 'api' as never,
      action: 'Applied',
    });

  it('a person’s own changeset tells the owner; an API token’s tells no one', async () => {
    await run(false);
    expect(fake.pushes.map((p) => [p.userId, p.kind, p.url])).toEqual([
      [OWNER, 'comment', `${BASE}/document/d1#t=t1&el=e1&open=comments`],
    ]);
    fake.pushes.length = 0;
    await run(true);
    expect(fake.pushes).toEqual([]);
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

  it('a reply in a thread tells who wrote in it', async () => {
    await save([box([comment('c1', BOB)])], BOB);
    fake.pushes.length = 0;
    const res = await route('POST', '/api/documents/d1/tabs/t1/comments/c1/reply', {
      body: { text: 'thanks' },
    });
    expect(res.status).toBe(201);
    expect(fake.pushes.map((p) => [p.userId, p.kind])).toEqual([[BOB, 'threadReply']]);
  });

  it('resolving a thread tells no one', async () => {
    await save([box([comment('c1', BOB)])], BOB);
    fake.pushes.length = 0;
    const res = await route('POST', '/api/documents/d1/tabs/t1/comments/c1/resolve');
    expect(res.status).toBeLessThan(300);
    expect(fake.pushes).toEqual([]);
  });
});

describe('who may hear (share roles)', () => {
  const solo = { id: 'solo', name: 'Solo', ownerId: OWNER, teamId: null };
  // The owner replies in a thread on a document with no team: everyone who wrote earlier is asked of the index.
  const reply = (threadAuthors: string[]) =>
    pushNewComments(db.env, {
      document: solo,
      tabId: 't1',
      authorId: OWNER,
      authorName: 'Owen',
      previous: [box(threadAuthors.map((id, i) => comment(`old${i}`, id)))],
      next: [box([...threadAuthors.map((id, i) => comment(`old${i}`, id)), comment('new', OWNER)])],
    });

  it('an Editor, a Participant and a Viewer by link hear, and one behind a password; someone without access, or a guest, never', async () => {
    vi.mocked(requestGrant).mockImplementation(async (_env, caller) => {
      const id = caller.kind === 'delegate' ? caller.personId : '';
      if (id === 'user_editor' || id === 'user_participant' || id === 'user_viewer')
        return { ok: true, grant: {} as never };
      if (id === 'user_password') return { ok: false, status: 403, error: 'password_required' };
      if (id === 'user_broken') throw new Error('index down');
      return { ok: false, status: 404, error: 'not_found' };
    });
    await reply([
      'user_editor',
      'user_participant',
      'user_viewer',
      'user_password',
      'user_removed',
      'user_broken',
      'guest_123',
    ]);
    expect(fake.pushes.map((p) => p.userId).sort()).toEqual([
      'user_editor',
      'user_participant',
      'user_password',
      'user_viewer',
    ]);
  });

  it('a team document’s joined people hear without an index ask; an invited one with no account never', async () => {
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
  const assign = (body: Record<string, unknown>, id = 'd1') =>
    route('POST', `/api/documents/${id}/notify-action`, {
      body: { teamId: TEAM, assigneeUserId: BOB, actionName: 'Ship it', ...body },
    });

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

  it('opens the document when the place is not given, and skips an invited teammate with no account', async () => {
    expect((await assign({})).status).toBe(202);
    expect(fake.pushes.map((p) => [p.url, p.tag])).toEqual([[`${BASE}/document/d1`, 'd1:action']]);
    fake.pushes.length = 0;
    await assign({ assigneeUserId: undefined, assigneeMemberId: 'm-inv' });
    expect(fake.pushes).toEqual([]);
  });

  it('refuses a place that is not an id', async () => {
    expect((await assign({ tabId: 5 })).status).toBe(400);
    expect((await assign({ elementId: 'x'.repeat(201) })).status).toBe(400);
    expect(fake.pushes).toEqual([]);
  });

  it('sends nothing to an assignee who can’t open the document', async () => {
    db.sql.exec(`
      INSERT INTO test_documents (id, owner_id, name, team_id, saved_at, created_at) VALUES ('solo', '${OWNER}', 'Solo', NULL, 1, 1);
    `);
    vi.mocked(requestGrant).mockImplementation(async (env, caller, documentId, share) =>
      caller.kind === 'delegate'
        ? { ok: false, status: 404, error: 'not_found' }
        : (await import('../test-sqlite-d1')).testRequestGrant(env, caller, documentId, share),
    );
    expect((await assign({}, 'solo')).status).toBe(202);
    expect(fake.pushes).toEqual([]);
  });
});

describe('the sending', () => {
  it('without accounts configured, sends nothing and throws nothing', async () => {
    const bare = sqliteD1({ APP_BASE_URL: BASE });
    await expect(
      pusher.pushActionAssigned(bare.env, {
        // The owner can read it, so only the missing accounts Worker stops the send.
        item: { id: 'd1', name: 'R', ownerId: OWNER, teamId: null },
        assignerId: CY,
        assignerName: 'Cy',
        assigneeUserId: OWNER,
        url: `${BASE}/document/d1`,
        tag: 'd1:a',
      }),
    ).resolves.toBeUndefined();
  });

  it('logs an accounts outage and carries on', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await pusher.pushActionAssigned(db.env, {
      item: { id: 'solo', name: 'Solo', ownerId: OWNER, teamId: null },
      assignerId: CY,
      assignerName: 'Cy',
      assigneeUserId: OWNER,
      url: `${BASE}/document/solo`,
      tag: 'solo:a',
    });
    expect(fake.pushes).toHaveLength(1);
    fake.failWith = 500;
    await pusher.pushActionAssigned(db.env, {
      item: { id: 'solo', name: 'Solo', ownerId: OWNER, teamId: null },
      assignerId: CY,
      assignerName: 'Cy',
      assigneeUserId: OWNER,
      url: `${BASE}/document/solo`,
      tag: 'solo:a',
    });
    expect(warn).toHaveBeenCalledWith('[push] send_failed', expect.anything());
  });

  it('keeps tags in the characters accounts takes', () => {
    expect(pushTag('d1', 'el/with spaces')).toBe('d1:el_with_spaces');
    expect(pushTag('d'.repeat(80), 'x')).toHaveLength(64);
  });
});
