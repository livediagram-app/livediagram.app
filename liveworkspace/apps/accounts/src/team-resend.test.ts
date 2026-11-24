import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { handleAccountApi } from './account-api.ts';
import type { Auth } from './auth.ts';
import { __setBearerVerifier } from './bearer.ts';
import type { Env } from './env.ts';
import {
  answerInvitation,
  createTeam,
  declineByToken,
  INVITATION_TTL_MS,
  inviteMember,
  leaveAllTeams,
  listMembers,
  removeMember,
  RESEND_GAP_MS,
  resendInvitation,
  sweepInvitations,
  type Actor,
} from './teams.ts';
import { addUser, testD1 } from './test-d1.ts';
import { startLifecycle } from './lifecycle.ts';
import { flushServerEvents } from './telemetry.ts';

// Who invited each row and when its 28 days started, and an admin resending an open invitation
// (liveworkspace/docs/specs/003-accounts/accounts.md "Invitations").

const SECRET = 'test-secret-test-secret-test-secret';
const BASE = 'https://liveworkspace.app';
const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 9, 1);
const LATER = T0 + RESEND_GAP_MS;

const ADA: Actor = { id: 'user_ada', email: 'ada@example.com', name: 'Ada' };
const BEA: Actor = { id: 'user_bea', email: 'bea@example.com', name: 'Bea' };
const CY: Actor = { id: 'user_cy', email: 'cy@example.com', name: 'Cy' };

let db: D1Database;
let sql: DatabaseSync;

beforeEach(() => {
  const d1 = testD1();
  db = d1.db;
  sql = d1.sql;
  for (const actor of [ADA, BEA, CY]) {
    addUser(sql, { id: actor.id, email: actor.email!, name: actor.name! });
  }
});

async function team(name = 'Design'): Promise<string> {
  const made = await createTeam(db, ADA, name, T0);
  if (!made.ok) throw new Error(made.error);
  return made.value.id;
}

async function invite(teamId: string, email: string, now = T0, by: Actor = ADA) {
  const invited = await inviteMember(db, by, teamId, email, 'member', now);
  if (!invited.ok) throw new Error(invited.error);
  return invited.value;
}

type Row = {
  clockStartedAt: number | null;
  reminder1SentAt: number | null;
  reminder2SentAt: number | null;
  reminder3SentAt: number | null;
  reminderAttempts: number;
  declineTokenHashes: string;
  rev: number;
};
const rowOf = (id: string) =>
  sql.prepare('SELECT * FROM team_member WHERE id = ?').get(id) as unknown as Row;

const events = () =>
  (sql.prepare('SELECT id, body FROM index_events_outbox ORDER BY id').all() as { body: string }[])
    .map((r) => JSON.parse(r.body) as { id: string; type: string; detail: Record<string, string> })
    .filter((e) => e.type === 'team_invite_sent');

describe('the members read', () => {
  it('names who invited each row now, and when an open invitation’s 28 days started', async () => {
    const id = await team();
    const bea = await invite(id, BEA.email!, T0 + 5);
    expect(bea.member).toMatchObject({ invitedByName: 'Ada', sentAt: T0 + 5 });
    await invite(id, CY.email!, T0 + 7);
    // The display name now: the profile's over the account's.
    sql
      .prepare('INSERT INTO profile (owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(ADA.id, 'Ada L', T0, T0);
    const cy = (await listMembers(db, id)).find((m) => m.email === CY.email)!;
    await answerInvitation(db, CY, cy.id, true, T0 + 9);
    const members = await listMembers(db, id);
    const by = (email: string) => members.find((m) => m.email === email)!;
    // The maker invited nobody; a joined row keeps its inviter but no clock.
    expect(by(ADA.email!)).toMatchObject({ invitedByName: null, sentAt: null });
    expect(by(CY.email!)).toMatchObject({ status: 'joined', invitedByName: 'Ada L', sentAt: null });
    expect(by(BEA.email!)).toMatchObject({
      status: 'invited',
      invitedByName: 'Ada L',
      sentAt: T0 + 5,
    });
  });

  it('names no inviter once the inviter’s account is closed', async () => {
    const id = await team();
    await invite(id, BEA.email!);
    await invite(id, CY.email!);
    const cy = (await listMembers(db, id)).find((m) => m.email === CY.email)!;
    await answerInvitation(db, CY, cy.id, true, T0 + 1);
    // Ada leaves every team, as her account closes: Cy runs the team and Bea's invitation stays.
    await leaveAllTeams(db, ADA.id, T0 + 2);
    const bea = (await listMembers(db, id)).find((m) => m.email === BEA.email)!;
    expect(bea).toMatchObject({ status: 'invited', invitedByName: null, sentAt: T0 });
  });
});

describe('resending an invitation', () => {
  it('restarts its clock and reminders, keeps the old decline links and writes the audit event', async () => {
    const id = await team();
    const first = await invite(id, BEA.email!);
    const memberId = first.member.id;
    // Two reminders have gone, one send failed.
    await sweepInvitations(db, async () => {}, T0 + DAY, null);
    await sweepInvitations(db, async () => {}, T0 + 7 * DAY, null);
    sql.prepare('UPDATE team_member SET reminderAttempts = 2 WHERE id = ?').run(memberId);
    const before = rowOf(memberId);
    expect(before.declineTokenHashes.split(' ')).toHaveLength(3);
    expect(before.reminder2SentAt).toBe(T0 + 7 * DAY);

    const at = T0 + 8 * DAY;
    const resent = await resendInvitation(db, ADA, id, memberId, at);
    if (!resent.ok) throw new Error(resent.error);
    expect(resent.value).toMatchObject({
      email: BEA.email,
      teamName: 'Design',
      member: { id: memberId, status: 'invited', invitedByName: 'Ada', sentAt: at, createdAt: T0 },
    });
    const after = rowOf(memberId);
    expect(after).toMatchObject({
      clockStartedAt: at,
      reminder1SentAt: null,
      reminder2SentAt: null,
      reminder3SentAt: null,
      reminderAttempts: 0,
    });
    expect(after.rev).toBeGreaterThan(before.rev);
    expect(after.declineTokenHashes.split(' ')).toEqual([
      ...before.declineTokenHashes.split(' '),
      expect.any(String),
    ]);
    // The first email's Decline link and the new one both still work.
    expect(await declineByToken(db, first.declineToken, at + 1)).toMatchObject({
      ok: true,
      value: { status: 'declined', declined: true },
    });
    expect(await declineByToken(db, resent.value.declineToken, at + 2)).toMatchObject({
      ok: true,
      value: { declined: false },
    });
    expect(events().map((e) => [e.id, e.detail.resent ?? null])).toEqual([
      [`team_invite_sent:${memberId}`, null],
      [`team_invite_sent:${memberId}:${at}`, '1'],
    ]);
    expect(events()[1]!.detail).toMatchObject({ memberName: BEA.email, role: 'member' });
  });

  it('runs the reminders again from the new start, and keeps the newest four decline hashes', async () => {
    const id = await team();
    const { member } = await invite(id, BEA.email!);
    const tokens: string[] = [];
    let now = T0;
    for (let i = 0; i < 5; i++) {
      now += RESEND_GAP_MS;
      const resent = await resendInvitation(db, ADA, id, member.id, now);
      if (!resent.ok) throw new Error(resent.error);
      tokens.push(resent.value.declineToken);
    }
    expect(rowOf(member.id).declineTokenHashes.split(' ')).toHaveLength(4);
    // The oldest links fell out; the newest still declines.
    expect(await declineByToken(db, tokens[0]!, now)).toMatchObject({ ok: false });
    let reminded = 0;
    await sweepInvitations(db, async () => void reminded++, now + DAY, null);
    expect(reminded).toBe(1);
    // Its 28 days count from the last resend: still open 28 days after the first sending.
    expect(rowOf(member.id).clockStartedAt).toBe(now);
    await sweepInvitations(db, null, T0 + INVITATION_TTL_MS + 1, null);
    expect((await listMembers(db, id)).find((m) => m.id === member.id)?.status).toBe('invited');
    expect(await declineByToken(db, tokens.at(-1)!, now + 2 * DAY)).toMatchObject({ ok: true });
  });

  it('is an admin’s, and only for a team they are in', async () => {
    const id = await team();
    const { member } = await invite(id, BEA.email!);
    const cy = await invite(id, CY.email!);
    await answerInvitation(db, CY, cy.member.id, true, T0);
    expect(await resendInvitation(db, CY, id, member.id, LATER)).toEqual({
      ok: false,
      status: 403,
      error: 'admin_only',
    });
    expect(await resendInvitation(db, BEA, id, member.id, LATER)).toEqual({
      ok: false,
      status: 404,
      error: 'not_found',
    });
  });

  it('answers invite_not_found for anything but an open, unexpired invitation of that team', async () => {
    const id = await team();
    const other = await team('Other');
    const bea = await invite(id, BEA.email!);
    const cy = await invite(id, CY.email!);
    const elsewhere = await invite(other, 'dee@example.com');
    const notFound = { ok: false, status: 404, error: 'invite_not_found' };
    // Another team's invitation, and a joined row.
    expect(await resendInvitation(db, ADA, id, elsewhere.member.id, LATER)).toEqual(notFound);
    const ada = (await listMembers(db, id)).find((m) => m.email === ADA.email)!;
    expect(await resendInvitation(db, ADA, id, ada.id, LATER)).toEqual(notFound);
    // Declined, then withdrawn.
    await declineByToken(db, cy.declineToken, T0 + 1);
    expect(await resendInvitation(db, ADA, id, cy.member.id, LATER)).toEqual(notFound);
    await removeMember(db, ADA, id, cy.member.id, T0 + 2);
    expect(await resendInvitation(db, ADA, id, cy.member.id, LATER)).toEqual(notFound);
    // Past its 28 days, before and after the sweep marks it: closed, so it is invited again instead.
    const expiredAt = T0 + INVITATION_TTL_MS;
    expect(await resendInvitation(db, ADA, id, bea.member.id, expiredAt)).toEqual(notFound);
    await sweepInvitations(db, null, expiredAt, null);
    expect(await resendInvitation(db, ADA, id, bea.member.id, expiredAt + 1)).toEqual(notFound);
    expect(await resendInvitation(db, ADA, id, 'nope', LATER)).toEqual(notFound);
  });

  it('refuses a resend within 10 minutes of the last sending, and lets one of two at once through', async () => {
    const id = await team();
    const { member } = await invite(id, BEA.email!);
    const tooSoon = { ok: false, status: 429, error: 'resend_too_soon' };
    expect(await resendInvitation(db, ADA, id, member.id, LATER - 1)).toEqual(tooSoon);
    const both = await Promise.all([
      resendInvitation(db, ADA, id, member.id, LATER),
      resendInvitation(db, ADA, id, member.id, LATER),
    ]);
    expect(both.map((r) => r.ok).sort()).toEqual([false, true]);
    expect(both.find((r) => !r.ok)).toEqual(tooSoon);
    expect(rowOf(member.id).declineTokenHashes.split(' ')).toHaveLength(2);
    expect(await resendInvitation(db, ADA, id, member.id, LATER + 1)).toEqual(tooSoon);
    // An invitation with no clock (from before clocks were kept) can be resent at once.
    sql.prepare('UPDATE team_member SET clockStartedAt = NULL WHERE id = ?').run(member.id);
    expect(await resendInvitation(db, ADA, id, member.id, LATER + 2)).toMatchObject({ ok: true });
  });
});

describe('the resend route, on both doors', () => {
  let env: Env;
  let mail: { to: string; subject: string; text: string }[];
  let posted: { app: string; events: { category: string; action: string; type?: string }[] }[];
  let emailDown = false;
  let signedIn: { id: string; name: string; email: string; emailVerified: boolean } | null;
  const auth = {
    api: { getSession: async () => (signedIn ? { user: signedIn, session: {} } : null) },
  } as unknown as Auth;

  beforeEach(() => {
    mail = [];
    posted = [];
    emailDown = false;
    env = {
      BASE_URL: BASE,
      EMAIL_FROM: 'sign-in@liveworkspace.app',
      AUTH_DB: db,
      ENVIRONMENT: 'production',
      EMAIL: {
        send: async (m: { to: string; subject: string; text: string }) => {
          if (emailDown) throw new Error('down');
          mail.push(m);
          return { messageId: 'm' };
        },
      } as unknown as SendEmail,
      BETTER_AUTH_SECRET: SECRET,
      TELEMETRY_URL: 'https://liveworkspace.app/api/telemetry',
      TELEMETRY_KEY_LIVEDESIGN: 'lds',
      TELEMETRY: {
        fetch: async (request: Request) => {
          posted.push((await request.json()) as (typeof posted)[number]);
          return new Response(null, { status: 204 });
        },
      },
    } as unknown as Env;
    signedIn = { id: ADA.id, name: 'Ada', email: ADA.email!, emailVerified: true };
    __setBearerVerifier(
      () => async (token) =>
        token === 'tok-ada'
          ? {
              kind: 'account',
              userId: ADA.id,
              email: ADA.email!,
              emailVerified: true,
              scopes: [],
              teams: null,
            }
          : null,
    );
  });
  afterEach(async () => {
    __setBearerVerifier(null);
    vi.useRealTimers();
    await flushServerEvents({});
  });

  const call = (path: string, method = 'POST', headers: Record<string, string> = {}) =>
    handleAccountApi(
      new Request(`${BASE}/api/account${path}`, {
        method,
        headers: { 'content-type': 'application/json', origin: BASE, ...headers },
      }),
      env,
      auth,
    );
  const byBearer = { authorization: 'Bearer tok-ada', origin: 'https://liveplanner.app' };

  it('emails the invitation again by the session and by the bearer, counted as one sent', async () => {
    vi.useFakeTimers({ now: T0, toFake: ['Date'] });
    await startLifecycle(db, { id: ADA.id, email: ADA.email! }, T0, 'livedesign.app');
    const id = await team();
    const { member } = await invite(id, BEA.email!);
    const path = `/teams/${id}/members/${member.id}/resend`;
    // Just sent: too soon.
    const tooSoon = await call(path);
    expect(tooSoon.status).toBe(429);
    expect(await tooSoon.json()).toEqual({ error: 'resend_too_soon' });

    vi.setSystemTime(LATER);
    const resent = await call(path);
    expect(resent.status).toBe(200);
    expect(await resent.json()).toMatchObject({ id: member.id, sentAt: LATER, status: 'invited' });
    expect(mail.map((m) => [m.to, m.subject])).toEqual([
      [BEA.email, 'Ada invited you to Design on liveworkspace'],
    ]);
    expect(mail[0]!.text).toMatch(/join\/decline\?token=/);

    // The bearer's door, from an app's address; an email that fails leaves the invitation resent.
    signedIn = null;
    vi.setSystemTime(LATER + RESEND_GAP_MS);
    emailDown = true;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const byApp = await call(path, 'POST', byBearer);
    expect(byApp.status).toBe(200);
    expect(error).toHaveBeenCalledWith('[teams] resent invite email failed', expect.any(Error));
    error.mockRestore();
    expect(rowOf(member.id).clockStartedAt).toBe(LATER + RESEND_GAP_MS);
    const read = (await (await call(`/teams/${id}/members`, 'GET', byBearer)).json()) as {
      members: { id: string; invitedByName: string | null; sentAt: number | null }[];
    };
    expect(read.members.find((m) => m.id === member.id)).toMatchObject({
      invitedByName: 'Ada',
      sentAt: LATER + RESEND_GAP_MS,
    });

    await flushServerEvents(env);
    const counted = posted
      .flatMap((b) => b.events.map((e) => [e.category, e.action, e.type].join('·')))
      .sort();
    expect(counted).toEqual([
      'Email·Sent·TeamInvite',
      'Team·Changed·Invite',
      'Team·Changed·Invite',
    ]);
  });

  it('answers a member’s, a stranger’s and a closed invitation’s refusal, and only to POST', async () => {
    const id = await team();
    const { member } = await invite(id, BEA.email!);
    const path = `/teams/${id}/members/${member.id}/resend`;
    signedIn = { id: CY.id, name: 'Cy', email: CY.email!, emailVerified: true };
    expect((await call(path)).status).toBe(404);
    signedIn = { id: ADA.id, name: 'Ada', email: ADA.email!, emailVerified: true };
    expect((await call(path, 'GET', {})).status).toBe(404);
    const gone = await call(`/teams/${id}/members/nope/resend`);
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ error: 'invite_not_found' });
    expect(mail).toEqual([]);
  });
});
