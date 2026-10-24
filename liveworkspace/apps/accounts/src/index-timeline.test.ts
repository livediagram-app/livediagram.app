import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IndexPurgeConfig } from './index-purge.ts';
import {
  flushTimeline,
  flushTimelineAfter,
  TIMELINE_BATCH,
  TIMELINE_MAX_ATTEMPTS,
  TIMELINE_OUTBOX_MAX,
  trimTimelineOutbox,
} from './index-timeline.ts';
import {
  answerInvitation,
  createTeam,
  declineByToken,
  deleteTeam,
  inviteMember,
  joinByInviteLink,
  listMembers,
  makeInviteLink,
  removeMember,
  setMemberRole,
  updateTeam,
  type Actor,
} from './teams.ts';
import { addUser, testD1 } from './test-d1.ts';
import { noteExpiringTokens, TOKEN_EXPIRY_WARNING_MS } from './token-expiry.ts';
import {
  MAX_API_TOKENS_PER_ACCOUNT,
  mintApiToken,
  revokeApiToken,
  revokeApiTokenBySecret,
} from './tokens.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 23, 9, 17);
const INDEX_URL = 'https://liveworkspace.app/api/index';
const ADA: Actor = { id: 'user_ada', email: 'ada@example.com', name: 'Ada' };
const BEA: Actor = { id: 'user_bea', email: 'bea@example.com', name: 'Bea' };
const CY: Actor = { id: 'user_cy', email: 'cy@example.com', name: 'Cy' };

type Event = {
  id: string;
  type: string;
  actorId: string | null;
  actorName: string | null;
  title: string;
  detail: Record<string, string | null>;
  at: number;
  scopes: string[];
};

let db: D1Database;
let sql: DatabaseSync;
let sent: { url: string; auth: string | null; events: Event[] }[];
let answer: () => Response;

const indexService = {
  fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
    sent.push({
      url: String(input),
      auth: new Headers(init.headers).get('authorization'),
      events: (JSON.parse(String(init.body)) as { events: Event[] }).events,
    });
    return answer();
  },
} as unknown as Fetcher;
const config: IndexPurgeConfig = { indexUrl: INDEX_URL, indexService, indexKey: 'merge-key' };

// What waits in the outbox, oldest first.
const queued = () =>
  (
    sql.prepare('SELECT body FROM index_timeline_outbox ORDER BY createdAt, id').all() as {
      body: string;
    }[]
  ).map((row) => JSON.parse(row.body) as Event);
const ofType = (type: string) => queued().filter((e) => e.type === type);

beforeEach(() => {
  ({ db, sql } = testD1());
  sent = [];
  answer = () => new Response(null, { status: 204 });
  for (const actor of [ADA, BEA, CY]) {
    addUser(sql, { id: actor.id, email: actor.email!, name: actor.name! });
  }
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function team(...members: Actor[]) {
  const made = await createTeam(db, ADA, 'Design', NOW);
  if (!made.ok) throw new Error(made.error);
  for (const member of members) {
    const invited = await inviteMember(db, ADA, made.value.id, member.email, 'member', NOW);
    if (!invited.ok) throw new Error(invited.error);
    await answerInvitation(db, member, invited.value.member.id, true, NOW);
  }
  return made.value.id;
}
const memberOf = async (teamId: string, actor: Actor) =>
  (await listMembers(db, teamId)).find((m) => m.userId === actor.id)!.id;

describe('API token events', () => {
  it('puts a token made and revoked on its owner’s Timeline, once each', async () => {
    const token = await mintApiToken(db, ADA.id, { name: 'CI deploy', readOnly: false }, NOW);
    expect(await revokeApiToken(db, ADA.id, token!.id, NOW + 1)).toBe(true);
    expect(await revokeApiToken(db, ADA.id, token!.id, NOW + 2)).toBe(false);
    expect(queued()).toEqual([
      {
        id: `token_created:${token!.id}`,
        type: 'token_created',
        actorId: ADA.id,
        title: 'CI deploy',
        detail: { tokenId: token!.id },
        at: NOW,
        scopes: ['p:user_ada'],
      },
      expect.objectContaining({ id: `token_revoked:${token!.id}`, at: NOW + 1 }),
    ]);
  });

  it('notes nothing for a token refused over the limit', async () => {
    for (let i = 0; i < MAX_API_TOKENS_PER_ACCOUNT; i++) {
      await mintApiToken(db, ADA.id, { name: `t${i}`, readOnly: true }, NOW);
    }
    expect(await mintApiToken(db, ADA.id, { name: 'one more', readOnly: true }, NOW)).toBeNull();
    expect(ofType('token_created')).toHaveLength(MAX_API_TOKENS_PER_ACCOUNT);
  });

  it('notes a revoke by secret', async () => {
    const token = await mintApiToken(db, BEA.id, { name: 'Claude', readOnly: true }, NOW);
    expect(await revokeApiTokenBySecret(db, token!.secret, NOW + 5)).toBe(true);
    expect(ofType('token_revoked')).toEqual([
      expect.objectContaining({ actorId: BEA.id, title: 'Claude', scopes: ['p:user_bea'] }),
    ]);
  });

  it('notes each token a week from expiring once, dated at its expiry, verified or not', async () => {
    addUser(sql, { id: 'user_dee', email: 'dee@example.com', verified: false });
    const add = (id: string, userId: string, expiresAt: number) =>
      sql
        .prepare(
          `INSERT INTO api_token (id, userId, tokenHash, name, readOnly, createdAt, expiresAt)
           VALUES (?, ?, ?, ?, 0, ?, ?)`,
        )
        .run(id, userId, `hash-${id}`, `name-${id}`, NOW - 100 * DAY, expiresAt);
    add('soon', ADA.id, NOW + 3 * DAY);
    add('unverified', 'user_dee', NOW + 2 * DAY);
    add('later', ADA.id, NOW + TOKEN_EXPIRY_WARNING_MS + DAY);
    add('gone', ADA.id, NOW - DAY);
    expect(await noteExpiringTokens(db, NOW)).toBe(2);
    expect(await noteExpiringTokens(db, NOW + 1)).toBe(0);
    expect(ofType('token_expiring')).toEqual([
      expect.objectContaining({
        id: 'token_expiring:unverified',
        actorId: null,
        at: NOW + 2 * DAY,
        scopes: ['p:user_dee'],
      }),
      expect.objectContaining({ id: 'token_expiring:soon', at: NOW + 3 * DAY }),
    ]);
  });
});

describe('team events', () => {
  it('notes an invitation to the team and to the person invited', async () => {
    const id = await team();
    await inviteMember(db, ADA, id, 'BEA@example.com', 'admin', NOW);
    await inviteMember(db, ADA, id, 'new@example.com', 'member', NOW);
    const invites = ofType('team_invite_sent').sort((a, b) =>
      String(a.detail.memberName).localeCompare(String(b.detail.memberName)),
    );
    expect(invites).toEqual([
      expect.objectContaining({
        actorId: ADA.id,
        actorName: 'Ada',
        title: 'Design',
        detail: { teamId: id, memberName: 'bea@example.com', personId: BEA.id, role: 'admin' },
        scopes: [`t:${id}`, 'p:user_bea'],
      }),
      expect.objectContaining({
        detail: expect.objectContaining({ memberName: 'new@example.com', personId: null }),
        scopes: [`t:${id}`],
      }),
    ]);
  });

  it('notes a join, a decline from the site and one from the email', async () => {
    const id = await team(BEA);
    const cy = await inviteMember(db, ADA, id, CY.email, 'member', NOW);
    await answerInvitation(db, CY, cy.ok ? cy.value.member.id : '', false, NOW);
    addUser(sql, { id: 'user_dee', email: 'dee@example.com', name: 'Dee' });
    const dee = await inviteMember(db, ADA, id, 'dee@example.com', 'member', NOW);
    if (!dee.ok) throw new Error(dee.error);
    await declineByToken(db, dee.value.declineToken, NOW + 1);
    await declineByToken(db, dee.value.declineToken, NOW + 2);
    expect(ofType('team_joined')).toEqual([
      expect.objectContaining({
        actorId: BEA.id,
        detail: { teamId: id, personId: BEA.id, memberName: 'Bea' },
        scopes: [`t:${id}`, 'p:user_bea'],
      }),
    ]);
    expect(ofType('team_declined')).toEqual([
      expect.objectContaining({
        actorId: CY.id,
        actorName: 'Cy',
        scopes: [`t:${id}`, 'p:user_cy'],
      }),
      expect.objectContaining({
        actorId: null,
        actorName: 'dee@example.com',
        at: NOW + 1,
        scopes: [`t:${id}`],
      }),
    ]);
  });

  it('notes a join by link', async () => {
    const id = await team();
    const link = await makeInviteLink(db, ADA, id, 'secret', 'https://liveworkspace.app', NOW);
    if (!link.ok) throw new Error(link.error);
    const token = new URL(link.value.url).searchParams.get('token');
    await joinByInviteLink(db, CY, token, NOW);
    await joinByInviteLink(db, CY, token, NOW);
    expect(ofType('team_joined')).toEqual([
      expect.objectContaining({
        actorId: CY.id,
        detail: expect.objectContaining({ via: 'link', personId: CY.id }),
      }),
    ]);
  });

  it('notes a role change, a removal and a member leaving', async () => {
    const id = await team(BEA, CY);
    await setMemberRole(db, ADA, id, await memberOf(id, BEA), 'admin', NOW + 1);
    await setMemberRole(db, ADA, id, await memberOf(id, BEA), 'admin', NOW + 2);
    const cy = await memberOf(id, CY);
    await removeMember(db, ADA, id, cy, NOW + 3);
    await removeMember(db, BEA, id, await memberOf(id, BEA), NOW + 4);
    expect(ofType('team_role_changed')).toEqual([
      expect.objectContaining({
        detail: { teamId: id, personId: BEA.id, memberName: 'Bea', role: 'admin' },
        scopes: [`t:${id}`, 'p:user_bea'],
      }),
    ]);
    expect(ofType('team_member_removed')).toEqual([
      expect.objectContaining({
        id: `team_member_removed:${cy}`,
        actorId: ADA.id,
        detail: { teamId: id, personId: CY.id, memberName: 'Cy', left: null },
        scopes: [`t:${id}`, 'p:user_cy'],
      }),
      expect.objectContaining({ actorId: BEA.id, detail: expect.objectContaining({ left: '1' }) }),
    ]);
  });

  it('notes a withdrawn invitation as nothing', async () => {
    const id = await team();
    const cy = await inviteMember(db, ADA, id, CY.email, 'member', NOW);
    await removeMember(db, ADA, id, cy.ok ? cy.value.member.id : '', NOW);
    expect(ofType('team_member_removed')).toEqual([]);
  });

  it('notes a rename only when the name changes, and a deletion to every member', async () => {
    const id = await team(BEA);
    await updateTeam(db, ADA, id, { name: 'Design' }, NOW + 1);
    await updateTeam(db, ADA, id, { name: 'Studio' }, NOW + 2);
    await deleteTeam(db, ADA, id, NOW + 3);
    expect(ofType('team_renamed')).toEqual([
      expect.objectContaining({ title: 'Studio', detail: { teamId: id, from: 'Design' } }),
    ]);
    expect(ofType('team_deleted')).toEqual([
      expect.objectContaining({
        id: `team_deleted:${id}`,
        title: 'Studio',
        scopes: expect.arrayContaining(['p:user_ada', 'p:user_bea']),
      }),
    ]);
    expect(ofType('team_deleted')[0]!.scopes).toHaveLength(2);
  });

  it('notes the last member leaving as the team deleted', async () => {
    const id = await team();
    await removeMember(db, ADA, id, await memberOf(id, ADA), NOW);
    expect(ofType('team_deleted')).toEqual([expect.objectContaining({ scopes: ['p:user_ada'] })]);
  });
});

describe('sending to the index', () => {
  it('sends what waits in batches, with the merge key, and clears what the index took', async () => {
    for (let i = 0; i < TIMELINE_BATCH + 5; i++) {
      await mintApiToken(db, ADA.id, { name: `t${i}`, readOnly: true }, NOW + i);
      if (i % 10 === 9) sql.prepare('UPDATE api_token SET revokedAt = 1').run();
    }
    expect(await flushTimeline(db, config, 1)).toEqual({ sent: TIMELINE_BATCH, waiting: true });
    expect(await flushTimeline(db, config, 3)).toEqual({ sent: 5, waiting: false });
    expect(sent.map((s) => s.events.length)).toEqual([TIMELINE_BATCH, 5]);
    expect(sent[0]).toMatchObject({
      url: `${INDEX_URL}/internal/timeline`,
      auth: 'Bearer merge-key',
    });
    expect(sent[0]!.events[0]).toMatchObject({ title: 't0', at: NOW });
    expect(queued()).toEqual([]);
  });

  it('keeps what the index refused, and drops it after its last try', async () => {
    await mintApiToken(db, ADA.id, { name: 'CI', readOnly: true }, NOW);
    answer = () => new Response(null, { status: 503 });
    expect(await flushTimeline(db, config)).toEqual({ sent: 0, waiting: true });
    expect(queued()).toHaveLength(1);
    sql.prepare('UPDATE index_timeline_outbox SET attempts = ?').run(TIMELINE_MAX_ATTEMPTS - 1);
    await flushTimeline(db, config);
    expect(queued()).toEqual([]);
  });

  it('sends nothing without an index, and after a request only when it wrote an event', async () => {
    await mintApiToken(db, ADA.id, { name: 'CI', readOnly: true }, NOW);
    expect(await flushTimeline(db, {})).toEqual({ sent: 0, waiting: false });
    const waits: Promise<unknown>[] = [];
    const env = {
      AUTH_DB: db,
      INDEX_URL,
      INDEX: indexService,
      INDEX_MERGE_KEY: 'merge-key',
    } as unknown as Parameters<typeof flushTimelineAfter>[0];
    flushTimelineAfter(env, { waitUntil: (p) => void waits.push(p) });
    flushTimelineAfter(env, { waitUntil: (p) => void waits.push(p) });
    await Promise.all(waits);
    expect(waits).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });
});

describe('the outbox’s bound', () => {
  const fill = (n: number) => {
    const insert = sql.prepare(
      'INSERT INTO index_timeline_outbox (id, body, createdAt) VALUES (?, ?, ?)',
    );
    sql.exec('BEGIN');
    for (let i = 0; i < n; i++) insert.run(`e${String(i).padStart(6, '0')}`, '{}', NOW + i);
    sql.exec('COMMIT');
  };
  const count = () =>
    (sql.prepare('SELECT count(*) AS n FROM index_timeline_outbox').get() as { n: number }).n;

  it('keeps the newest events up to the limit, with no index to send them to', async () => {
    fill(TIMELINE_OUTBOX_MAX + 25);
    expect(await flushTimeline(db, {})).toEqual({ sent: 0, waiting: false });
    expect(await trimTimelineOutbox(db)).toBe(25);
    expect(count()).toBe(TIMELINE_OUTBOX_MAX);
    const oldest = sql.prepare('SELECT min(createdAt) AS at FROM index_timeline_outbox').get() as {
      at: number;
    };
    expect(oldest.at).toBe(NOW + 25);
    expect(await trimTimelineOutbox(db)).toBe(0);
  });

  it('trims a worst-case backlog, ten times the limit, within budget', async () => {
    fill(TIMELINE_OUTBOX_MAX * 10);
    const started = performance.now();
    expect(await trimTimelineOutbox(db)).toBe(TIMELINE_OUTBOX_MAX * 9);
    const ms = performance.now() - started;
    expect(count()).toBe(TIMELINE_OUTBOX_MAX);
    expect(ms).toBeLessThan(2_000);
  });
});
