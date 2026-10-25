import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { handleAccountApi } from './account-api.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import {
  answerInvitation,
  clearInviteLink,
  createTeam,
  currentInviteLink,
  declineByToken,
  INVITATION_TTL_MS,
  INVITE_LINK_TTL_MS,
  inviteMember,
  inviteResponseRecipients,
  joinByInviteLink,
  listMembers,
  listMyInvitations,
  listMyTeams,
  makeInviteLink,
  previewInviteLink,
  readDeclineToken,
  removeMember,
  sweepInvitations,
  updateTeam,
  type Actor,
  type ReminderEmail,
} from './teams.ts';
import { addUser, testD1 } from './test-d1.ts';
import { sendTeamInviteEmail } from './email.ts';
import { startLifecycle } from './lifecycle.ts';
import { flushServerEvents } from './telemetry.ts';

// The parts of teams that came back from livediagram (liveworkspace/docs/accounts.md "Teams"): the
// join link, the organisation line, declining from the email, reminders and expiry, invitations
// turned down staying on the list, and the admins hearing the answer.

const SECRET = 'test-secret-test-secret-test-secret';
const BASE = 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev';
const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 9, 1);

const ADA: Actor = { id: 'user_ada', email: 'ada@example.com' };
const BEA: Actor = { id: 'user_bea', email: 'bea@example.com' };
const CY: Actor = { id: 'user_cy', email: 'cy@example.com' };

let db: D1Database;
let sql: DatabaseSync;

beforeEach(() => {
  const d1 = testD1();
  db = d1.db;
  sql = d1.sql;
  for (const actor of [ADA, BEA, CY]) addUser(sql, { id: actor.id, email: actor.email! });
});

async function team(name = 'Design'): Promise<string> {
  const made = await createTeam(db, ADA, name, T0);
  if (!made.ok) throw new Error(made.error);
  return made.value.id;
}

async function invite(teamId: string, email: string, now = T0) {
  const invited = await inviteMember(db, ADA, teamId, email, 'member', now);
  if (!invited.ok) throw new Error(invited.error);
  return invited.value;
}

const tokenOf = (url: string) => new URL(url).searchParams.get('token')!;

describe('the join link', () => {
  it('is off until an admin turns it on, and works for a week', async () => {
    const id = await team();
    expect(await currentInviteLink(db, id, SECRET, BASE, T0)).toBeNull();
    const made = await makeInviteLink(db, ADA, id, SECRET, BASE, T0);
    if (!made.ok) throw new Error(made.error);
    expect(made.value.url).toMatch(/^https:\/\/liveworkspace-gateway\.liveworkspace-easing509\.workers\.dev\/join\?token=[\w-]{43}$/);
    expect(made.value.expiresAt).toBe(T0 + INVITE_LINK_TTL_MS);
    // The admin sees the same link again later.
    expect(await currentInviteLink(db, id, SECRET, BASE, T0 + DAY)).toEqual(made.value);
    expect(await currentInviteLink(db, id, SECRET, BASE, T0 + INVITE_LINK_TTL_MS)).toBeNull();
    const token = tokenOf(made.value.url);
    expect(await previewInviteLink(db, token, null, T0 + INVITE_LINK_TTL_MS)).toBeNull();
  });

  it('keeps only a hash of the token', async () => {
    const id = await team();
    const made = await makeInviteLink(db, ADA, id, SECRET, BASE, T0);
    if (!made.ok) throw new Error(made.error);
    const row = sql.prepare('SELECT * FROM team WHERE id = ?').get(id)!;
    expect(JSON.stringify(row)).not.toContain(tokenOf(made.value.url));
  });

  it('is an admin’s to turn on, make anew and turn off', async () => {
    const id = await team();
    const bea = await invite(id, BEA.email!);
    await answerInvitation(db, BEA, bea.member.id, true);
    expect(await makeInviteLink(db, BEA, id, SECRET, BASE, T0)).toMatchObject({
      ok: false,
      error: 'admin_only',
    });
    const first = await makeInviteLink(db, ADA, id, SECRET, BASE, T0);
    const second = await makeInviteLink(db, ADA, id, SECRET, BASE, T0 + 1);
    if (!first.ok || !second.ok) throw new Error('no link');
    expect(second.value.url).not.toBe(first.value.url);
    // Making a new one ends the old one.
    expect(await previewInviteLink(db, tokenOf(first.value.url), null, T0 + 2)).toBeNull();
    expect(await previewInviteLink(db, tokenOf(second.value.url), null, T0 + 2)).toMatchObject({
      teamName: 'Design',
      memberCount: 2,
    });
    expect(await clearInviteLink(db, ADA, id)).toMatchObject({ ok: true });
    expect(await previewInviteLink(db, tokenOf(second.value.url), null, T0 + 2)).toBeNull();
  });

  it('lets anyone signed in join as a member, once', async () => {
    const id = await team();
    const made = await makeInviteLink(db, ADA, id, SECRET, BASE, T0);
    if (!made.ok) throw new Error(made.error);
    const token = tokenOf(made.value.url);
    expect(await previewInviteLink(db, token, CY.id, T0)).toMatchObject({ alreadyMember: false });
    expect(await joinByInviteLink(db, CY, token, T0)).toMatchObject({
      ok: true,
      value: { teamId: id, alreadyMember: false },
    });
    expect(await listMyTeams(db, CY.id)).toEqual([
      expect.objectContaining({ id, role: 'member', memberCount: 2 }),
    ]);
    expect(await previewInviteLink(db, token, CY.id, T0)).toMatchObject({ alreadyMember: true });
    expect(await joinByInviteLink(db, CY, token, T0)).toMatchObject({
      ok: true,
      value: { alreadyMember: true },
    });
    expect((await listMembers(db, id)).filter((m) => m.status === 'joined')).toHaveLength(2);
  });

  it('accepts an invitation waiting for the same address rather than doubling it', async () => {
    const id = await team();
    await invite(id, BEA.email!);
    const made = await makeInviteLink(db, ADA, id, SECRET, BASE, T0);
    if (!made.ok) throw new Error(made.error);
    expect(await joinByInviteLink(db, BEA, tokenOf(made.value.url), T0)).toMatchObject({
      ok: true,
      value: { acceptedInvite: true },
    });
    const members = await listMembers(db, id);
    expect(members.filter((m) => m.email === BEA.email)).toEqual([
      expect.objectContaining({ status: 'joined', userId: BEA.id }),
    ]);
  });

  it('refuses an unknown or malformed token', async () => {
    await team();
    expect(await joinByInviteLink(db, CY, 'x'.repeat(43), T0)).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(await previewInviteLink(db, 42, null, T0)).toBeNull();
  });
});

describe('the organisation line', () => {
  it('is kept with the team and changed by an admin, apart from the name', async () => {
    const made = await createTeam(db, ADA, 'Design', T0, '  Northwind  ');
    if (!made.ok) throw new Error(made.error);
    expect(made.value.organisation).toBe('Northwind');
    const changed = await updateTeam(db, ADA, made.value.id, { organisation: '' }, T0);
    expect(changed).toMatchObject({ ok: true, value: { name: 'Design', organisation: null } });
    expect(await updateTeam(db, ADA, made.value.id, { name: 'Brand' }, T0)).toMatchObject({
      value: { name: 'Brand', organisation: null },
    });
  });
});

describe('declining from the email', () => {
  it('declines that one invitation, and says so again after', async () => {
    const id = await team();
    const { declineToken } = await invite(id, BEA.email!);
    expect(await readDeclineToken(db, declineToken)).toEqual({
      teamName: 'Design',
      status: 'invited',
    });
    expect(await declineByToken(db, declineToken, T0)).toMatchObject({
      ok: true,
      value: { status: 'declined', declined: true },
    });
    expect(await declineByToken(db, declineToken, T0)).toMatchObject({
      ok: true,
      value: { status: 'declined', declined: false },
    });
    expect(await listMyInvitations(db, BEA.email)).toEqual([]);
  });

  it('can’t undo a membership, and refuses a token that isn’t one', async () => {
    const id = await team();
    const { member, declineToken } = await invite(id, BEA.email!);
    await answerInvitation(db, BEA, member.id, true);
    expect(await readDeclineToken(db, declineToken)).toMatchObject({ status: 'joined' });
    expect(await declineByToken(db, declineToken)).toMatchObject({ ok: false, status: 409 });
    expect(await readDeclineToken(db, `${member.id}.wrong`)).toBeNull();
    expect(await readDeclineToken(db, 'nonsense')).toBeNull();
  });

  it('stops working once an admin clears the answer or invites the address again', async () => {
    const id = await team();
    const first = await invite(id, BEA.email!);
    await declineByToken(db, first.declineToken);
    const second = await invite(id, BEA.email!);
    expect(await readDeclineToken(db, first.declineToken)).toBeNull();
    expect((await listMembers(db, id)).filter((m) => m.email === BEA.email)).toEqual([
      expect.objectContaining({ id: second.member.id, status: 'invited' }),
    ]);
  });
});

describe('invitations turned down', () => {
  it('stay on the list for the admins until one removes them', async () => {
    const id = await team();
    const { member } = await invite(id, BEA.email!);
    await answerInvitation(db, BEA, member.id, false);
    expect(await listMembers(db, id)).toContainEqual(
      expect.objectContaining({ id: member.id, status: 'declined', expired: false }),
    );
    expect(await removeMember(db, ADA, id, member.id)).toMatchObject({ ok: true });
    expect((await listMembers(db, id)).map((m) => m.id)).not.toContain(member.id);
  });
});

describe('reminders and expiry', () => {
  it('reminds at 1, 7 and 21 days, then expires the invitation at 28', async () => {
    const id = await team();
    const { member, declineToken } = await invite(id, BEA.email!);
    const sent: ReminderEmail[] = [];
    const send = async (email: ReminderEmail) => void sent.push(email);

    expect(await sweepInvitations(db, send, T0 + DAY / 2)).toEqual({
      expired: 0,
      reminded: 0,
      failed: 0,
    });
    await sweepInvitations(db, send, T0 + DAY);
    await sweepInvitations(db, send, T0 + 2 * DAY);
    await sweepInvitations(db, send, T0 + 7 * DAY);
    await sweepInvitations(db, send, T0 + 21 * DAY);
    expect(sent.map((e) => e.stage)).toEqual([1, 2, 3]);
    expect(sent[0]).toMatchObject({ to: BEA.email, teamName: 'Design' });

    // Each reminder's own Decline link works, and so does the first email's.
    expect(await readDeclineToken(db, sent[2]!.declineToken)).toMatchObject({ status: 'invited' });
    expect(await readDeclineToken(db, declineToken)).toMatchObject({ status: 'invited' });

    expect(await sweepInvitations(db, send, T0 + INVITATION_TTL_MS)).toMatchObject({ expired: 1 });
    expect(await readDeclineToken(db, declineToken)).toMatchObject({ status: 'expired' });
    expect(await listMembers(db, id)).toContainEqual(
      expect.objectContaining({ id: member.id, status: 'declined', expired: true }),
    );
    expect(sent).toHaveLength(3);
  });

  it('sends only the latest reminder due to an invitation that fell behind', async () => {
    const id = await team();
    await invite(id, BEA.email!);
    const sent: ReminderEmail[] = [];
    await sweepInvitations(db, async (e) => void sent.push(e), T0 + 8 * DAY);
    expect(sent.map((e) => e.stage)).toEqual([2]);
    await sweepInvitations(db, async (e) => void sent.push(e), T0 + 9 * DAY);
    expect(sent).toHaveLength(1);
  });

  it('gives up on a reminder after three failed sends', async () => {
    const id = await team();
    await invite(id, BEA.email!);
    let tries = 0;
    const failing = async () => {
      tries++;
      throw new Error('down');
    };
    for (let day = 1; day <= 5; day++) await sweepInvitations(db, failing, T0 + day * DAY);
    expect(tries).toBe(3);
  });

  it('expires invitations even when email is off', async () => {
    const id = await team();
    await invite(id, BEA.email!);
    expect(await sweepInvitations(db, null, T0 + INVITATION_TTL_MS)).toMatchObject({ expired: 1 });
  });
});

describe('telling the admins', () => {
  it('names the joined admins, except any who turned it off', async () => {
    const id = await team();
    const bea = await invite(id, BEA.email!);
    await answerInvitation(db, BEA, bea.member.id, true);
    expect((await inviteResponseRecipients(db, id)).map((r) => r.email)).toEqual([ADA.email]);
    sql
      .prepare(`INSERT INTO settings (owner_id, scope, prefs, updated_at) VALUES (?, 'all', ?, 0)`)
      .run(ADA.id, JSON.stringify({ notifyInviteResponse: false }));
    expect(await inviteResponseRecipients(db, id)).toEqual([]);
  });
});

describe('the account API routes', () => {
  let env: Env;
  let mail: { to: string[]; subject: string; text: string }[];
  let signedIn: { id: string; name: string; email: string; emailVerified: boolean } | null;
  const auth = {
    api: { getSession: async () => (signedIn ? { user: signedIn, session: {} } : null) },
  } as unknown as Auth;

  beforeEach(() => {
    mail = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      mail.push(JSON.parse(String(init.body)) as { to: string[]; subject: string; text: string });
      return new Response('{}');
    });
    env = {
      BASE_URL: BASE,
      EMAIL_FROM: 'sign-in@liveworkspace.app',
      AUTH_DB: db,
      ENVIRONMENT: 'production',
      RESEND_API_KEY: 're_test',
      BETTER_AUTH_SECRET: SECRET,
    } as unknown as Env;
    signedIn = { id: ADA.id, name: 'Ada', email: ADA.email!, emailVerified: true };
  });
  afterEach(() => vi.unstubAllGlobals());

  const call = (path: string, method = 'GET', body?: unknown) =>
    handleAccountApi(
      new Request(`${BASE}/api/account${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(method === 'GET' ? {} : { origin: BASE }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
      auth,
    );

  it('turns the link on for an admin, shows it to admins only, and joins through it', async () => {
    const id = await team();
    const on = await call(`/teams/${id}/invite-link`, 'POST');
    expect(on.status).toBe(200);
    const link = (await on.json()) as { url: string; expiresAt: number };
    const detail = (await (await call(`/teams/${id}/members`)).json()) as {
      inviteLink: unknown;
    };
    expect(detail.inviteLink).toEqual(link);
    const token = tokenOf(link.url);

    // Signed out, the preview still names the team.
    signedIn = null;
    const preview = await call(`/join/${token}`);
    expect(await preview.json()).toMatchObject({
      teamName: 'Design',
      signedIn: false,
      alreadyMember: false,
    });
    expect((await call(`/join/${token}`, 'POST', {})).status).toBe(401);

    signedIn = { id: CY.id, name: 'Cy', email: CY.email!, emailVerified: true };
    expect(await (await call(`/join/${token}`, 'POST', {})).json()).toMatchObject({
      teamId: id,
      alreadyMember: false,
    });
    const asMember = (await (await call(`/teams/${id}/members`)).json()) as {
      inviteLink: unknown;
    };
    expect(asMember.inviteLink).toBeNull();
    expect((await call(`/teams/${id}/invite-link`, 'DELETE')).status).toBe(403);

    signedIn = { id: ADA.id, name: 'Ada', email: ADA.email!, emailVerified: true };
    expect((await call(`/teams/${id}/invite-link`, 'DELETE')).status).toBe(200);
    expect((await call(`/join/${token}`)).status).toBe(404);
  });

  it('puts a Decline link in the invitation, which works signed out and tells the admins', async () => {
    const id = await team();
    await call(`/teams/${id}/members`, 'POST', { email: BEA.email });
    const link = /https:\/\/liveworkspace-gateway\.liveworkspace-easing509\.workers\.dev\/join\/decline\?token=(\S+)/.exec(mail[0]!.text);
    expect(link).not.toBeNull();
    const token = decodeURIComponent(link![1]!);

    signedIn = null;
    expect(await (await call(`/invitations/decline/${token}`)).json()).toEqual({
      teamName: 'Design',
      status: 'invited',
    });
    const declined = await call(`/invitations/decline/${token}`, 'POST', {});
    expect(await declined.json()).toEqual({ teamName: 'Design', status: 'declined' });
    expect(mail.at(-1)).toMatchObject({
      to: [ADA.email],
      subject: `${BEA.email} declined your invitation to Design`,
    });
    expect((await call('/invitations/decline/nope.nope')).status).toBe(404);
  });

  it('keeps the organisation through create and PATCH', async () => {
    const made = await call('/teams', 'POST', { name: 'Design', organisation: 'Northwind' });
    const { id } = (await made.json()) as { id: string };
    await call(`/teams/${id}`, 'PATCH', { organisation: 'Northwind Ltd' });
    const detail = (await (await call(`/teams/${id}/members`)).json()) as {
      team: { name: string; organisation: string };
    };
    expect(detail.team).toMatchObject({ name: 'Design', organisation: 'Northwind Ltd' });
  });
});

describe('counting team emails, teams and tokens', () => {
  let env: Env;
  let posted: { app: string; events: { category: string; action: string; type?: string }[] }[];
  let mail: string[];
  let signedIn: { id: string; name: string; email: string; emailVerified: boolean } | null;
  const auth = {
    api: { getSession: async () => (signedIn ? { user: signedIn, session: {} } : null) },
  } as unknown as Auth;

  beforeEach(() => {
    posted = [];
    mail = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      mail.push(String(init.body));
      return new Response('{}');
    });
    env = {
      BASE_URL: BASE,
      EMAIL_FROM: 'sign-in@liveworkspace.app',
      AUTH_DB: db,
      ENVIRONMENT: 'production',
      RESEND_API_KEY: 're_test',
      BETTER_AUTH_SECRET: SECRET,
      TELEMETRY_URL: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/api/telemetry',
      TELEMETRY_KEY_LIVEDESIGN: 'lds',
      TELEMETRY_KEY_LIVEDIAGRAM: 'ld',
      TELEMETRY: {
        fetch: async (request: Request) => {
          posted.push((await request.json()) as (typeof posted)[number]);
          return new Response(null, { status: 204 });
        },
      },
    } as unknown as Env;
    signedIn = { id: ADA.id, name: 'Ada', email: ADA.email!, emailVerified: true };
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await flushServerEvents({});
  });

  const call = (path: string, method = 'GET', body?: unknown) =>
    handleAccountApi(
      new Request(`${BASE}/api/account${path}`, {
        method,
        headers: { 'content-type': 'application/json', origin: BASE },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
      auth,
    );

  // What was counted in one category, as `<app> <Category>·<Action>[·<Type>]`.
  const counted = (category = 'Email') =>
    posted
      .flatMap((b) =>
        b.events
          .filter((e) => e.category === category)
          .map((e) => [`${b.app} ${e.category}`, e.action, e.type].filter(Boolean).join('·')),
      )
      .sort();

  it('counts invitations and answers under the app the inviter signed up through', async () => {
    await startLifecycle(db, { id: ADA.id, email: ADA.email! }, T0, 'livedesign.app');
    const id = await team();
    await call(`/teams/${id}/members`, 'POST', { email: BEA.email });
    await call(`/teams/${id}/members`, 'POST', { email: CY.email });
    // Bea accepts on the site; Cy declines from the email, signed out.
    signedIn = { id: BEA.id, name: 'Bea', email: BEA.email!, emailVerified: true };
    const { invitations } = (await (await call('/teams')).json()) as {
      invitations: { id: string }[];
    };
    expect((await call(`/invitations/${invitations[0]!.id}/accept`, 'POST', {})).status).toBe(200);
    signedIn = null;
    const token = /join\/decline\?token=([^\s"\\]+)/.exec(mail[1]!)![1]!;
    const declined = await call(`/invitations/decline/${decodeURIComponent(token)}`, 'POST', {});
    expect(await declined.json()).toMatchObject({ status: 'declined' });
    // Nothing goes until the flush the Worker runs after the response, then one batch.
    expect(posted).toEqual([]);
    await flushServerEvents(env);
    expect(posted).toHaveLength(1);
    expect(counted()).toEqual([
      'livedesign.app Email·Sent·InviteResponse',
      'livedesign.app Email·Sent·InviteResponse',
      'livedesign.app Email·Sent·TeamInvite',
      'livedesign.app Email·Sent·TeamInvite',
    ]);
  });

  it('counts what is done to teams and tokens under the app each actor signed up through', async () => {
    await startLifecycle(db, { id: ADA.id, email: ADA.email! }, T0, 'livedesign.app');
    await startLifecycle(db, { id: BEA.id, email: BEA.email! }, T0, 'livediagram.app');
    const made = await call('/teams', 'POST', { name: 'Design' });
    const { id } = (await made.json()) as { id: string };
    await call(`/teams/${id}`, 'PATCH', { name: 'Design Team' });
    await call(`/teams/${id}/invite-link`, 'POST', {});
    await call(`/teams/${id}/invite-link`, 'DELETE');
    await call(`/teams/${id}/members`, 'POST', { email: BEA.email });
    const cy = (await (await call(`/teams/${id}/members`, 'POST', { email: CY.email })).json()) as {
      id: string;
    };
    await call(`/teams/${id}/members/${cy.id}`, 'DELETE');
    signedIn = { id: BEA.id, name: 'Bea', email: BEA.email!, emailVerified: true };
    const { invitations } = (await (await call('/teams')).json()) as {
      invitations: { id: string }[];
    };
    await call(`/invitations/${invitations[0]!.id}/accept`, 'POST', {});
    const tokenMade = (await (await call('/tokens', 'POST', { name: 'Script' })).json()) as {
      id: string;
    };
    await call(`/tokens/${tokenMade.id}`, 'DELETE');
    signedIn = { id: ADA.id, name: 'Ada', email: ADA.email!, emailVerified: true };
    const detail = (await (await call(`/teams/${id}/members`)).json()) as {
      members: { id: string; email: string }[];
    };
    const bea = detail.members.find((m) => m.email === BEA.email)!;
    await call(`/teams/${id}/members/${bea.id}`, 'PATCH', { role: 'admin' });
    await call(`/teams/${id}/members/${bea.id}`, 'DELETE');
    await call(`/teams/${id}`, 'DELETE');
    // A refused change counts nothing.
    signedIn = { id: CY.id, name: 'Cy', email: CY.email!, emailVerified: true };
    expect((await call(`/teams/${id}`, 'PATCH', { name: 'Mine' })).status).toBe(404);
    expect(posted).toEqual([]);
    await flushServerEvents(env);
    expect([...counted('Team'), ...counted('Token')]).toEqual([
      'livedesign.app Team·Added·Member',
      'livedesign.app Team·Added·Member',
      'livedesign.app Team·Changed',
      'livedesign.app Team·Changed·Role',
      'livedesign.app Team·Created',
      'livedesign.app Team·Deleted',
      'livedesign.app Team·Removed·Invite',
      'livedesign.app Team·Removed·Link',
      'livedesign.app Team·Removed·Member',
      'livedesign.app Team·Shared·Link',
      'livediagram.app Team·Joined',
      'livediagram.app Token·Created·Manual',
      'livediagram.app Token·Removed',
    ]);
  });

  it('counts a decline under who answered, and an email’s under the inviter’s app', async () => {
    await startLifecycle(db, { id: ADA.id, email: ADA.email! }, T0, 'livedesign.app');
    await startLifecycle(db, { id: BEA.id, email: BEA.email! }, T0, 'livediagram.app');
    const id = await team();
    await call(`/teams/${id}/members`, 'POST', { email: BEA.email });
    await call(`/teams/${id}/members`, 'POST', { email: CY.email });
    signedIn = { id: BEA.id, name: 'Bea', email: BEA.email!, emailVerified: true };
    const { invitations } = (await (await call('/teams')).json()) as {
      invitations: { id: string }[];
    };
    await call(`/invitations/${invitations[0]!.id}/decline`, 'POST', {});
    signedIn = null;
    const token = /join\/decline\?token=([^\s"\\]+)/.exec(mail[1]!)![1]!;
    await call(`/invitations/decline/${decodeURIComponent(token)}`, 'POST', {});
    // A second Decline of the same invitation counts nothing more.
    await call(`/invitations/decline/${decodeURIComponent(token)}`, 'POST', {});
    await flushServerEvents(env);
    expect(counted('Team').filter((e) => e.includes('Declined'))).toEqual([
      'livedesign.app Team·Declined·Email',
      'livediagram.app Team·Declined·Invite',
    ]);
  });

  it('counts nothing for an inviter who signed up on liveworkspace.app', async () => {
    await startLifecycle(db, { id: ADA.id, email: ADA.email! }, T0, 'liveworkspace.app');
    const id = await team();
    await call(`/teams/${id}/members`, 'POST', { email: BEA.email });
    await flushServerEvents(env);
    expect(posted).toEqual([]);
  });

  it('counts each reminder by its stage, and not one that failed', async () => {
    await startLifecycle(db, { id: ADA.id, email: ADA.email! }, T0, 'livediagram.app');
    const id = await team();
    await invite(id, BEA.email!);
    // As index.ts sends them.
    const send = (reminder: ReminderEmail) =>
      sendTeamInviteEmail(env, {
        to: reminder.to,
        teamName: reminder.teamName,
        inviterName: reminder.inviterName ?? '',
        declineToken: reminder.declineToken,
        stage: reminder.stage,
        app: reminder.inviterApp,
      });
    await sweepInvitations(db, send, T0 + DAY);
    vi.stubGlobal('fetch', async () => new Response('down', { status: 500 }));
    expect(await sweepInvitations(db, send, T0 + 7 * DAY)).toMatchObject({ failed: 1 });
    vi.stubGlobal('fetch', async () => new Response('{}'));
    await sweepInvitations(db, send, T0 + 21 * DAY);
    await flushServerEvents(env);
    expect(counted()).toEqual([
      'livediagram.app Email·Sent·TeamInviteReminder1',
      'livediagram.app Email·Sent·TeamInviteReminder3',
    ]);
  });
});

describe('the teams list', () => {
  // Counts every statement a call prepares.
  function counting(target: D1Database) {
    const seen = { queries: 0 };
    const db = new Proxy(target, {
      get(object, key) {
        if (key === 'prepare') {
          return (query: string) => {
            seen.queries++;
            return object.prepare(query);
          };
        }
        return Reflect.get(object, key) as unknown;
      },
    });
    return { db, seen };
  }

  it('answers a person in 50 teams, with each team’s first members, in one query', async () => {
    for (let t = 0; t < 50; t++) {
      const made = await createTeam(db, ADA, `Team ${String(t).padStart(2, '0')}`, T0 + t);
      if (!made.ok) throw new Error(made.error);
      for (let m = 0; m < 6; m++) {
        const email = `p${t}-${m}@example.com`;
        const invited = await inviteMember(db, ADA, made.value.id, email, 'member', T0 + m);
        if (!invited.ok) throw new Error(invited.error);
        if (m < 5) {
          addUser(sql, { id: `user_${t}_${m}`, email, name: `Person ${t} ${m}` });
          await answerInvitation(
            db,
            { id: `user_${t}_${m}`, email },
            invited.value.member.id,
            true,
          );
        }
      }
    }
    const { db: watched, seen } = counting(db);
    const started = performance.now();
    const teams = await listMyTeams(watched, ADA.id);
    const took = performance.now() - started;
    expect(seen.queries).toBe(1);
    expect(teams).toHaveLength(50);
    expect(teams[0]).toMatchObject({
      name: 'Team 00',
      memberCount: 6,
      invitedCount: 1,
      role: 'admin',
    });
    // Up to four, the admin first.
    expect(teams[0]!.members).toHaveLength(4);
    expect(teams[0]!.members[0]).toMatchObject({ email: ADA.email, role: 'admin' });
    expect(teams.every((team) => team.members.length === 4)).toBe(true);
    // A generous budget for an in-memory database: the point is one statement, not N.
    expect(took).toBeLessThan(250);
  });

  it('lists a team of one with its one member', async () => {
    await team();
    const [only] = await listMyTeams(db, ADA.id);
    expect(only).toMatchObject({ memberCount: 1, invitedCount: 0 });
    expect(only!.members).toEqual([expect.objectContaining({ email: ADA.email })]);
  });
});
