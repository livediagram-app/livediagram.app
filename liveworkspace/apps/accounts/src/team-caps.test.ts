// The team caps under racing requests, and an invitation past its 28 days before the sweep marks it
// (liveworkspace/docs/specs/003-accounts/accounts.md "Teams", "Reminders and expiry"). Each cap is read for the answer
// and checked again inside the write; these start several requests together so every one reads below the cap first.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  answerInvitation,
  createTeam,
  INVITATION_TTL_MS,
  inviteMember,
  joinByInviteLink,
  listMyInvitations,
  listMyTeams,
  makeInviteLink,
  MAX_MEMBERS_PER_TEAM,
  MAX_TEAMS_PER_ACCOUNT,
  type Actor,
} from './teams.ts';
import { addUser, testD1 } from './test-d1.ts';

const SECRET = 'test-secret-test-secret-test-secret';
const BASE = 'https://liveworkspace.app';
const T0 = Date.UTC(2026, 9, 1);

const ADA: Actor = { id: 'user_ada', email: 'ada@example.com' };
const BEA: Actor = { id: 'user_bea', email: 'bea@example.com' };
const CY: Actor = { id: 'user_cy', email: 'cy@example.com' };

let db: D1Database;
let sql: ReturnType<typeof testD1>['sql'];

beforeEach(() => {
  const d1 = testD1();
  db = d1.db;
  sql = d1.sql;
  for (const actor of [ADA, BEA, CY]) addUser(sql, { id: actor.id, email: actor.email! });
});

async function team(by: Actor, name: string): Promise<string> {
  const made = await createTeam(db, by, name, T0);
  if (!made.ok) throw new Error(made.error);
  return made.value.id;
}

// `count` teams made by `actor`, one short of nothing in particular.
async function teams(actor: Actor, count: number) {
  for (let i = 0; i < count; i++) await team(actor, `Team ${i}`);
}

async function linkToken(teamId: string): Promise<string> {
  const made = await makeInviteLink(db, ADA, teamId, SECRET, BASE, T0);
  if (!made.ok) throw new Error(made.error);
  return new URL(made.value.url).searchParams.get('token')!;
}

const joinedCount = (userId: string) =>
  (
    sql
      .prepare(
        `SELECT COUNT(*) AS n FROM team_member m JOIN team t ON t.id = m.teamId
         WHERE m.userId = ? AND m.status = 'joined' AND t.deletedAt IS NULL`,
      )
      .get(userId) as { n: number }
  ).n;

const openCount = (teamId: string) =>
  (
    sql
      .prepare(
        `SELECT COUNT(*) AS n FROM team_member WHERE teamId = ? AND status IN ('invited', 'joined')`,
      )
      .get(teamId) as { n: number }
  ).n;

// The database as `n` racing requests see it: the first `n` batches wait until all `n` have arrived, so each request has
// made its reads (the caps among them) before any writes. Later batches go straight through.
function racing(n: number): D1Database {
  const waiting: (() => void)[] = [];
  return new Proxy(db, {
    get(target, key) {
      if (key === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          if (waiting.length < n) {
            await new Promise<void>((resolve) => {
              waiting.push(resolve);
              if (waiting.length === n) for (const go of waiting) go();
            });
          }
          return target.batch(statements);
        };
      }
      const value = Reflect.get(target, key) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

const errors = (results: { ok: boolean; error?: string }[]) =>
  results.map((r) => (r.ok ? 'ok' : r.error)).sort();

describe('the team cap, racing', () => {
  it('lets only one of several creates make the fiftieth team', async () => {
    await teams(ADA, MAX_TEAMS_PER_ACCOUNT - 1);
    const race = racing(3);
    const results = await Promise.all(
      ['A', 'B', 'C'].map((name) => createTeam(race, ADA, name, T0)),
    );
    expect(errors(results)).toEqual(['ok', 'team_limit_reached', 'team_limit_reached']);
    expect(joinedCount(ADA.id)).toBe(MAX_TEAMS_PER_ACCOUNT);
    // No team row was left behind without its admin.
    expect(
      sql
        .prepare(
          'SELECT COUNT(*) AS n FROM team t WHERE NOT EXISTS (SELECT 1 FROM team_member m WHERE m.teamId = t.id)',
        )
        .get(),
    ).toEqual({ n: 0 });
  });

  it('lets only one of several link joins take the fiftieth place', async () => {
    await teams(CY, MAX_TEAMS_PER_ACCOUNT - 1);
    const tokens = [await linkToken(await team(ADA, 'X')), await linkToken(await team(ADA, 'Y'))];
    const race = racing(2);
    const results = await Promise.all(tokens.map((token) => joinByInviteLink(race, CY, token, T0)));
    expect(errors(results)).toEqual(['ok', 'team_limit_reached']);
    expect(joinedCount(CY.id)).toBe(MAX_TEAMS_PER_ACCOUNT);
  });

  it('lets only one of several acceptances take the fiftieth place', async () => {
    await teams(BEA, MAX_TEAMS_PER_ACCOUNT - 1);
    const invites = await Promise.all(
      ['X', 'Y'].map(async (name) => {
        const invited = await inviteMember(db, ADA, await team(ADA, name), BEA.email, 'member', T0);
        if (!invited.ok) throw new Error(invited.error);
        return invited.value.member.id;
      }),
    );
    const race = racing(2);
    await Promise.all(invites.map((id) => answerInvitation(race, BEA, id, true, T0)));
    expect(joinedCount(BEA.id)).toBe(MAX_TEAMS_PER_ACCOUNT);
  });

  it('lets only one of several invitations to a link-joined account take the fiftieth place', async () => {
    // Joining by link with an invitation waiting accepts it, under the same cap.
    await teams(CY, MAX_TEAMS_PER_ACCOUNT - 1);
    const ids = [await team(ADA, 'X'), await team(ADA, 'Y')];
    for (const id of ids) await inviteMember(db, ADA, id, CY.email, 'member', T0);
    const tokens = await Promise.all(ids.map(linkToken));
    const race = racing(2);
    const results = await Promise.all(tokens.map((token) => joinByInviteLink(race, CY, token, T0)));
    expect(errors(results)).toEqual(['ok', 'team_limit_reached']);
    expect(joinedCount(CY.id)).toBe(MAX_TEAMS_PER_ACCOUNT);
  });
});

describe('the member cap, racing', () => {
  async function nearlyFull(): Promise<string> {
    const id = await team(ADA, 'Big');
    // The admin and 198 invitations: one place left.
    for (let i = 0; i < MAX_MEMBERS_PER_TEAM - 2; i++) {
      const invited = await inviteMember(db, ADA, id, `p${i}@example.com`, 'member', T0);
      if (!invited.ok) throw new Error(invited.error);
    }
    expect(openCount(id)).toBe(MAX_MEMBERS_PER_TEAM - 1);
    return id;
  }

  it('lets only one of several invitations take the last place', async () => {
    const id = await nearlyFull();
    const race = racing(3);
    const results = await Promise.all(
      ['a', 'b', 'c'].map((who) => inviteMember(race, ADA, id, `${who}@example.com`, 'member', T0)),
    );
    expect(errors(results)).toEqual(['member_limit_reached', 'member_limit_reached', 'ok']);
    expect(openCount(id)).toBe(MAX_MEMBERS_PER_TEAM);
    // Only the invitation made is queued for the audit log.
    expect(
      sql
        .prepare(`SELECT COUNT(*) AS n FROM index_events_outbox WHERE id LIKE 'team_invite_sent:%'`)
        .get(),
    ).toEqual({ n: MAX_MEMBERS_PER_TEAM - 1 });
  });

  it('lets only one of several link joins take the last place', async () => {
    const id = await nearlyFull();
    const token = await linkToken(id);
    const race = racing(2);
    const results = await Promise.all(
      [BEA, CY].map((who) => joinByInviteLink(race, who, token, T0)),
    );
    expect(errors(results)).toEqual(['member_limit_reached', 'ok']);
    expect(openCount(id)).toBe(MAX_MEMBERS_PER_TEAM);
  });
});

describe('an invitation past its 28 days, before the sweep', () => {
  it('is left off the list and can be neither accepted nor declined', async () => {
    const id = await team(ADA, 'Design');
    const invited = await inviteMember(db, ADA, id, BEA.email, 'member', T0);
    if (!invited.ok) throw new Error(invited.error);
    const late = T0 + INVITATION_TTL_MS;
    expect(await listMyInvitations(db, BEA.email, late - 1)).toHaveLength(1);
    expect(await listMyInvitations(db, BEA.email, late)).toEqual([]);
    for (const accept of [true, false]) {
      expect(await answerInvitation(db, BEA, invited.value.member.id, accept, late)).toMatchObject({
        ok: false,
        status: 404,
      });
    }
    expect(await listMyTeams(db, BEA.id)).toEqual([]);
    // A day before, it still works.
    expect(await answerInvitation(db, BEA, invited.value.member.id, true, late - 1)).toMatchObject({
      ok: true,
      value: { status: 'joined' },
    });
  });
});
