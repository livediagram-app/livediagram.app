import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
vi.mock('../index-service', async (original) => {
  const { testIndexFor, testRequestGrant } = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    indexFor: testIndexFor,
    requestGrant: testRequestGrant,
  };
});
vi.mock('./client', async (original) => ({
  ...(await original<typeof import('./client')>()),
  sendEmail: vi.fn(async () => ({ sent: true })),
}));

import type { TeamClaim, TeamPerson } from '@liveworkspace/auth-client';
import type { Comment, Element } from '@liveplanner/project';
import type { ItemResponse } from '@liveplanner/api-schema';
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import { ACCOUNTS_ON, INDEX_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from '../routes/test-route-context';
import { handleProjects } from '../routes/projects';
import { handleInternalItems } from '../routes/internal-items';
import { sendEmail } from './client';
import { notifyMentions, notifyMilestone } from './notifications';

// The five notification emails that ride on liveworkspace (docs/specs/014-identity/profile-and-email-notifications.md):
// the tenth plan and the first share link (milestones, claimed once at accounts), someone joining a shared plan
// (the index's notice, throttled in the plan), an action assigned and a mention (the plan's team at accounts,
// claimed once in the plan, capped per sender). Addresses and switches are accounts'; nothing is kept in D1.

const OWNER = 'user_owner';
const BOB = 'user_bob';
const TEAM = 'team1';
const TEAM_CLAIM: TeamClaim[] = [{ id: TEAM, name: 'Team', role: 'admin' }];

const person = (
  id: string,
  userId: string | null,
  email: string,
  status: TeamPerson['status'] = 'joined',
): TeamPerson => ({ id, userId, email, name: null, role: 'member', status });

let db: SqliteD1;
let fake: FakeAccounts;

const sent = () =>
  vi
    .mocked(sendEmail)
    .mock.calls.map(([, e]) => ({ to: e.to, kind: e.kind, subject: e.subject, html: e.html }));

beforeEach(() => {
  fake = stubAccounts();
  db = sqliteD1({
    ...ACCOUNTS_ON,
    ...INDEX_ON,
    RESEND_API_KEY: 're',
    APP_BASE_URL: 'https://app.test',
  });
  for (const [id, address] of [
    [OWNER, 'owner@x.test'],
    [BOB, 'bob@x.test'],
    ['user_carol', 'carol@x.test'],
  ] as const) {
    fake.emails.set(id, address);
    fake.sightings.add(id);
  }
  fake.teams.set(TEAM, [
    person('m-owner', OWNER, 'owner@x.test'),
    person('m-bob', BOB, 'bob@x.test'),
    person('m-inv', null, 'inv@x.test', 'invited'),
  ]);
  clearTestProfiles();
  setTestProfile(OWNER, 'Owen');
  setTestProfile(BOB, 'Bob');
  db.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, team_id, saved_at, created_at) VALUES ('d1', '${OWNER}', 'Roadmap', '${TEAM}', 1, 1);
    INSERT INTO test_plans (id, owner_id, name, team_id, saved_at, created_at) VALUES ('solo', '${OWNER}', 'Solo', NULL, 1, 1);
  `);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function route(
  method: string,
  path: string,
  opts: {
    body?: unknown;
    as?: string;
    teams?: TeamClaim[];
    token?: boolean;
    code?: string;
  } = {},
) {
  const pending: Promise<unknown>[] = [];
  const as = opts.as ?? OWNER;
  const res = await handleProjects(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner: as,
      accountUserId: opts.token ? null : as,
      verifiedUserId: as,
      body: opts.body,
      teams: opts.teams ?? TEAM_CLAIM,
      token: opts.token ? { id: 'tok_1' } : null,
      ...(opts.code ? { headers: { 'X-Share-Code': opts.code } } : {}),
      waitUntil: (p) => void pending.push(p),
    }),
  );
  await Promise.all(pending);
  return res;
}

async function notice(planId: string, body: unknown) {
  const pending: Promise<unknown>[] = [];
  const res = await handleInternalItems(
    new Request(`https://api.test/api/internal/items/${planId}/notices`, {
      method: 'POST',
      headers: { Authorization: 'Bearer lp-key', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    db.env,
    (p) => void pending.push(p),
  );
  await Promise.all(pending);
  return res;
}

describe('the tenth plan (milestone)', () => {
  it('celebrates the tenth plan once, on its create', async () => {
    fake.planCounts.set(OWNER, 10);
    const res = await route('POST', '/api/projects', { body: { id: 'p10', name: 'Tenth' } });
    expect(res.status).toBe(201);
    await notifyMilestone(db.env, OWNER);
    expect(sent()).toEqual([
      expect.objectContaining({
        to: 'owner@x.test',
        kind: 'Milestone',
        subject: 'You’ve made 10 plans on liveplanner',
      }),
    ]);
    // Asked only up to the milestone, however many plans they have.
    expect(fake.calls.filter((c) => c.path === '/index/count')).toHaveLength(2);
  });

  it('says nothing before the tenth, or to someone who turned milestones off', async () => {
    fake.planCounts.set(OWNER, 9);
    await notifyMilestone(db.env, OWNER);
    fake.planCounts.set(OWNER, 10);
    fake.settings.set(OWNER, { all: { notifyMilestones: false }, app: {} });
    await notifyMilestone(db.env, OWNER);
    expect(sent()).toEqual([]);
    // Turned off is not claimed: turning it back on still celebrates.
    expect(fake.calls.some((c) => c.path === '/milestones/claim')).toBe(false);
  });

  it('never for a guest', async () => {
    fake.planCounts.set('guest_x', 10);
    await notifyMilestone(db.env, 'guest_x');
    expect(fake.calls).toEqual([]);
  });
});

describe('the first share link (milestone)', () => {
  it('celebrates the first link someone makes, once', async () => {
    expect((await notice('d1', { type: 'shared', actorId: OWNER })).status).toBe(202);
    expect((await notice('solo', { type: 'shared', actorId: OWNER })).status).toBe(202);
    expect(sent()).toEqual([expect.objectContaining({ to: 'owner@x.test', kind: 'FirstShare' })]);
  });

  it('refuses a notice it cannot read, and a caller without the key', async () => {
    expect((await notice('d1', { type: 'shared' })).status).toBe(400);
    const res = await handleInternalItems(
      new Request('https://api.test/api/internal/items/d1/notices', {
        method: 'POST',
        headers: { Authorization: 'Bearer nope' },
        body: '{}',
      }),
      db.env,
    );
    expect(res.status).toBe(401);
    expect(sent()).toEqual([]);
  });
});

describe('someone joined my plan', () => {
  it('tells the owner who opened their plan, once a window, never about a guest or themselves', async () => {
    await notice('d1', { type: 'joined', personId: 'guest_x', level: 'view' });
    await notice('d1', { type: 'joined', personId: OWNER, level: 'edit' });
    await notice('d1', { type: 'joined', personId: BOB, level: 'edit' });
    await notice('d1', { type: 'joined', personId: 'user_carol', level: 'view' });
    expect(sent()).toEqual([
      expect.objectContaining({
        to: 'owner@x.test',
        kind: 'ProjectJoined',
        subject: 'Bob opened one of your plans',
      }),
    ]);
    expect(sent()[0]!.html).toContain('Roadmap');
  });

  it("respects the owner's switch, kept for liveplanner", async () => {
    fake.settings.set(OWNER, { all: {}, app: { notifyProjectJoin: false } });
    await notice('d1', { type: 'joined', personId: BOB, level: 'edit' });
    expect(sent()).toEqual([]);
    expect(fake.calls.find((c) => c.path === '/settings/notify')?.body).toMatchObject({
      app: 'liveplanner.app',
      keys: ['notifyProjectJoin'],
    });
  });
});

describe('an action assigned', () => {
  const assign = (body: Record<string, unknown>, opts: Parameters<typeof route>[2] = {}) =>
    route('POST', '/api/projects/d1/notify-action', {
      body: { teamId: TEAM, actionName: 'Ship it', description: 'By Friday', ...body },
      ...opts,
    });

  it('emails the teammate once, naming the plan they can open', async () => {
    expect((await assign({ assigneeUserId: BOB })).status).toBe(202);
    expect((await assign({ assigneeUserId: BOB })).status).toBe(202);
    expect(sent()).toEqual([
      expect.objectContaining({
        to: 'bob@x.test',
        kind: 'ActionAssigned',
        subject: 'Owen assigned you an action',
      }),
    ]);
    expect(sent()[0]!.html).toContain('https://app.test/project/d1');
    expect(sent()[0]!.html).toContain('Roadmap');
  });

  it('reaches an invited teammate at their invite address', async () => {
    expect((await assign({ assigneeMemberId: 'm-inv' })).status).toBe(202);
    expect(sent()).toEqual([expect.objectContaining({ to: 'inv@x.test', kind: 'ActionAssigned' })]);
  });

  it('names no plan the assignee cannot open', async () => {
    const res = await route('POST', '/api/projects/solo/notify-action', {
      body: { teamId: TEAM, assigneeUserId: BOB, actionName: 'Ship it' },
    });
    expect(res.status).toBe(202);
    expect(sent()[0]!.html).not.toContain('Solo');
    expect(sent()[0]!.html).toContain('You can’t open its plan yet');
  });

  it('respects the assignee’s switch', async () => {
    fake.settings.set(BOB, { all: { notifyActionAssigned: false }, app: {} });
    expect((await assign({ assigneeUserId: BOB })).status).toBe(202);
    expect(sent()).toEqual([]);
  });

  it('refuses a stranger, a team the caller is not in, an API token and a bad body', async () => {
    expect((await assign({ assigneeUserId: 'user_stranger' })).status).toBe(404);
    expect((await assign({ assigneeUserId: OWNER })).status).toBe(404);
    expect((await assign({ assigneeUserId: BOB }, { teams: [] })).status).toBe(404);
    expect((await assign({ assigneeUserId: BOB }, { token: true })).status).toBe(403);
    expect((await assign({ assigneeUserId: BOB, actionName: 'x'.repeat(201) })).status).toBe(400);
    expect(
      (await assign({ assigneeUserId: BOB }, { as: 'user_carol', teams: TEAM_CLAIM })).status,
    ).toBe(404);
    expect(sent()).toEqual([]);
  });
});

describe('a mention', () => {
  const mention = (userId: string | null, memberId?: string) => ({
    userId,
    ...(memberId ? { memberId } : {}),
    name: 'X',
    handle: 'x',
  });

  it('a card comment emails each teammate it mentions, once, and opens the card', async () => {
    const item = (
      (await (
        await route('POST', '/api/projects/d1/items', {
          body: { type: 'task', fields: { title: 'A' } },
        })
      ).json()) as ItemResponse
    ).item;
    const res = await route('POST', `/api/projects/d1/items/${item.id}/comments`, {
      body: {
        text: '@bob @inv look',
        mentions: [mention(BOB), mention(null, 'm-inv'), mention('user_stranger'), mention(OWNER)],
      },
    });
    expect(res.status).toBe(200);
    expect(
      sent()
        .map((e) => [e.to, e.kind])
        .sort(),
    ).toEqual([
      ['bob@x.test', 'Mentioned'],
      ['inv@x.test', 'Mentioned'],
    ]);
    expect(sent()[0]!.html).toContain(`#item=${encodeURIComponent(item.id)}`);
    expect(sent()[0]!.subject).toBe('Owen mentioned you in Roadmap');
  });

  it("a tab save's new comment emails who it mentions; the next save sends nothing more", async () => {
    const comment = {
      id: 'c1',
      text: 'over to you @bob',
      createdAt: Date.now(),
      authorName: 'Owen',
      authorColor: '#000',
      authorId: OWNER,
      mentions: [mention(BOB)],
    };
    const el = {
      id: 'e1',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      commentThread: { comments: [comment], resolved: false },
    } as unknown as Element;
    const put = () =>
      route('PUT', '/api/projects/d1/tabs/t1', {
        body: { id: 't1', name: 'Board', elements: [el] },
      });
    expect((await put()).status).toBe(200);
    expect((await put()).status).toBe(200);
    expect(sent()).toEqual([expect.objectContaining({ to: 'bob@x.test', kind: 'Mentioned' })]);
  });

  it('only from a joined member of the plan’s own team, and only to its people', async () => {
    const c = {
      id: 'c',
      text: 'hi',
      createdAt: 1,
      authorName: 'C',
      authorColor: '#000',
      mentions: [mention(BOB)],
    } as Comment;
    await notifyMentions(db.env, {
      plan: { id: 'd1', name: 'Roadmap', teamId: TEAM },
      authorId: 'user_carol',
      comments: [c],
    });
    await notifyMentions(db.env, {
      plan: { id: 'solo', name: 'Solo', teamId: null },
      authorId: OWNER,
      comments: [c],
    });
    expect(sent()).toEqual([]);
  });

  it('holds a sender to the hourly cap', async () => {
    const people = Array.from({ length: 70 }, (_, i) =>
      person(`m-${i}`, null, `p${i}@x.test`, 'invited'),
    );
    fake.teams.set(TEAM, [person('m-owner', OWNER, 'owner@x.test'), ...people]);
    const comments = Array.from({ length: 4 }, (_, i) => ({
      id: `c${i}`,
      text: 'all of you',
      createdAt: 1,
      authorName: 'Owen',
      authorColor: '#000',
      mentions: people.slice(i * 20, i * 20 + 20).map((p) => mention(null, p.id)),
    })) as Comment[];
    await notifyMentions(db.env, {
      plan: { id: 'd1', name: 'Roadmap', teamId: TEAM },
      authorId: OWNER,
      comments,
    });
    expect(sent()).toHaveLength(60);
  });

  // Mentions ride on every comment and save: however many comments and people, one team read, one address read
  // and one switch read, and the claims are the plan's own SQLite.
  it('stays cheap: a constant number of calls, within budget, for the most a save can mention', async () => {
    const people = Array.from({ length: 20 }, (_, i) =>
      person(`m-${i}`, `user_p${i}`, `p${i}@x.test`),
    );
    for (const p of people) fake.emails.set(p.userId!, p.email);
    fake.teams.set(TEAM, [person('m-owner', OWNER, 'owner@x.test'), ...people]);
    const comments = Array.from({ length: 3 }, (_, i) => ({
      id: `c${i}`,
      text: 'all of you',
      createdAt: 1,
      authorName: 'Owen',
      authorColor: '#000',
      mentions: people.map((p) => mention(p.userId)),
    })) as Comment[];
    const started = performance.now();
    await notifyMentions(db.env, {
      plan: { id: 'd1', name: 'Roadmap', teamId: TEAM },
      authorId: OWNER,
      comments,
    });
    const took = performance.now() - started;
    expect(sent()).toHaveLength(60);
    expect(fake.calls.map((c) => c.path).sort()).toEqual([
      '/emails',
      '/settings/notify',
      '/teams/members',
    ]);
    expect(took).toBeLessThan(250);
  });
});
