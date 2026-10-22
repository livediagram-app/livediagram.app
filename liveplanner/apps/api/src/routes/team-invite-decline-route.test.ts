import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';

// The admins' email has its own suite; here, only whether it is asked.
const { notify } = vi.hoisted(() => ({
  notify: { notifyInviteResponse: vi.fn(async () => undefined) },
}));
vi.mock('../email/notifications', async (original) => ({
  ...(await original<typeof import('../email/notifications')>()),
  ...notify,
}));

import { addTeamMember } from '../db/team-invites';
import { mintDeclineToken } from '../db/team-invite-decline';
import { handleTeams } from './teams';
import { makeTestRouteContext } from './test-route-context';

// docs/specs/013-workspace/teams.md "Declining from the email": the two open doors behind the email's link.
// No identity at all: a signed-out visitor with only the token.

function setup() {
  const db = sqliteD1();
  db.sql
    .prepare(`INSERT INTO teams (id, name, created_at, updated_at) VALUES ('t', 'Design', 0, 0)`)
    .run();
  db.sql
    .prepare(
      `INSERT INTO team_members (id, team_id, user_id, email, role, status, created_at, updated_at)
       VALUES ('admin', 't', 'user-admin', 'admin@x.test', 'admin', 'joined', 0, 0)`,
    )
    .run();
  const background: Promise<unknown>[] = [];
  const call = (method: string, token: string) =>
    handleTeams(
      makeTestRouteContext(method, `/api/teams/invite-decline/${encodeURIComponent(token)}`, {
        owner: null,
        accountUserId: null,
        env: db.env,
        waitUntil: (p) => void background.push(p),
      }),
    );
  return { db, call, background };
}

const statusOf = (db: ReturnType<typeof sqliteD1>, id: string) =>
  (db.sql.prepare('SELECT status FROM team_members WHERE id = ?').get(id) as { status: string })
    .status;

describe('/api/teams/invite-decline/:token', () => {
  beforeEach(() => notify.notifyInviteResponse.mockClear());

  it('GET reads the team name and status, and never writes', async () => {
    const { db, call } = setup();
    const { member, declineToken } = await addTeamMember(db.env, {
      teamId: 't',
      email: 'a@x.test',
    });
    for (let i = 0; i < 3; i++) {
      const res = await call('GET', declineToken);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ teamName: 'Design', status: 'invited' });
    }
    expect(statusOf(db, member.id)).toBe('invited');
  });

  it('POST declines without an account, tells the admins once, and is idempotent', async () => {
    const { db, call, background } = setup();
    const { member, declineToken } = await addTeamMember(db.env, {
      teamId: 't',
      email: 'a@x.test',
    });
    const first = await call('POST', declineToken);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ teamName: 'Design', status: 'declined' });
    expect(statusOf(db, member.id)).toBe('declined');
    await Promise.all(background);
    expect(notify.notifyInviteResponse).toHaveBeenCalledOnce();
    expect(notify.notifyInviteResponse).toHaveBeenCalledWith(
      db.env,
      { id: 't', name: 'Design' },
      'a@x.test',
      false,
      null,
    );
    // The admins' Timeline card.
    const events = db.sql
      .prepare(`SELECT event_type FROM timeline_events WHERE event_type = 'team_invite_declined'`)
      .all();
    expect(events).toHaveLength(1);

    const again = await call('POST', declineToken);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ teamName: 'Design', status: 'declined' });
    expect(notify.notifyInviteResponse).toHaveBeenCalledOnce();
    // The link still says what became of it.
    expect(await (await call('GET', declineToken)).json()).toEqual({
      teamName: 'Design',
      status: 'declined',
    });
  });

  it('answers an expired invite as expired, changing nothing', async () => {
    const { db, call } = setup();
    const { member, declineToken } = await addTeamMember(db.env, {
      teamId: 't',
      email: 'a@x.test',
    });
    db.sql.prepare(`UPDATE team_members SET status = 'expired' WHERE id = ?`).run(member.id);
    const res = await call('POST', declineToken);
    expect(await res.json()).toEqual({ teamName: 'Design', status: 'expired' });
    expect(statusOf(db, member.id)).toBe('expired');
    expect(notify.notifyInviteResponse).not.toHaveBeenCalled();
  });

  it('409 already_joined: the token cannot undo a membership', async () => {
    const { db, call } = setup();
    const { member, declineToken } = await addTeamMember(db.env, {
      teamId: 't',
      email: 'a@x.test',
    });
    db.sql
      .prepare(`UPDATE team_members SET status = 'joined', user_id = 'user-a' WHERE id = ?`)
      .run(member.id);
    expect(await (await call('GET', declineToken)).json()).toEqual({
      teamName: 'Design',
      status: 'joined',
    });
    const res = await call('POST', declineToken);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'already_joined' });
    expect(statusOf(db, member.id)).toBe('joined');
  });

  it('404 invite_not_found for a wrong, malformed or stale token, without saying which', async () => {
    const { db, call } = setup();
    const { member } = await addTeamMember(db.env, { teamId: 't', email: 'a@x.test' });
    const wrong = (await mintDeclineToken(member.id)).token;
    for (const token of [wrong, 'garbage', (await mintDeclineToken('admin')).token]) {
      for (const method of ['GET', 'POST']) {
        const res = await call(method, token);
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'invite_not_found' });
      }
    }
    expect(statusOf(db, member.id)).toBe('invited');
  });

  it('serves only GET and POST', async () => {
    const { db, call } = setup();
    const { declineToken } = await addTeamMember(db.env, { teamId: 't', email: 'a@x.test' });
    expect((await call('DELETE', declineToken)).status).toBe(404);
  });
});
