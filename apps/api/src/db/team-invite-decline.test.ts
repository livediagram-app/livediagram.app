import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import {
  declineTeamInvite,
  DECLINE_TOKEN_MAX_HASHES,
  mintDeclineToken,
  resolveDeclineToken,
  teamInviteStatus,
} from './team-invite-decline';
import {
  addTeamMember,
  connectInvitesByEmail,
  joinTeamByInviteToken,
  teamHasEmail,
} from './team-invites';
import { getMembership, listTeamMembers } from './teams';

// docs/specs/013-workspace/teams.md "Declining from the email": the single-purpose decline token, the decline
// itself, and what a rejected row does (and does not) count as.

function seedTeam() {
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
  return db;
}

function rowOf(db: ReturnType<typeof sqliteD1>, id: string) {
  return db.sql.prepare('SELECT * FROM team_members WHERE id = ?').get(id) as Record<
    string,
    unknown
  >;
}

describe('decline tokens', () => {
  it('mints a member-scoped token and stores only its hash', async () => {
    const db = seedTeam();
    const { member, declineToken } = await addTeamMember(db.env, {
      teamId: 't',
      email: 'a@x.test',
    });
    expect(declineToken.startsWith(`${member.id}.`)).toBe(true);
    const stored = String(rowOf(db, member.id).decline_token_hashes);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toContain(declineToken.split('.')[1]);
  });

  it('resolves its own invite, with the team name and status', async () => {
    const db = seedTeam();
    const { member, declineToken } = await addTeamMember(db.env, {
      teamId: 't',
      email: 'a@x.test',
    });
    await expect(resolveDeclineToken(db.env, declineToken)).resolves.toMatchObject({
      memberId: member.id,
      teamId: 't',
      teamName: 'Design',
      email: 'a@x.test',
      status: 'invited',
    });
  });

  it('refuses a wrong secret, a malformed token, an unknown id and a row with no hashes alike', async () => {
    const db = seedTeam();
    const { member, declineToken } = await addTeamMember(db.env, {
      teamId: 't',
      email: 'a@x.test',
    });
    const other = await mintDeclineToken(member.id);
    await expect(resolveDeclineToken(db.env, other.token)).resolves.toBeNull();
    await expect(resolveDeclineToken(db.env, 'nonsense')).resolves.toBeNull();
    await expect(resolveDeclineToken(db.env, `${declineToken}x`)).resolves.toBeNull();
    const stranger = await mintDeclineToken('00000000-0000-4000-8000-000000000000');
    await expect(resolveDeclineToken(db.env, stranger.token)).resolves.toBeNull();
    // The admin's own row carries no hashes, so even a well-formed token for it resolves nothing.
    const forAdmin = await mintDeclineToken('admin');
    await expect(resolveDeclineToken(db.env, forAdmin.token)).resolves.toBeNull();
  });

  it('accepts any of the invite’s email tokens, and reads no more than the cap', async () => {
    const db = seedTeam();
    const { member } = await addTeamMember(db.env, { teamId: 't', email: 'a@x.test' });
    const tokens = await Promise.all(
      Array.from({ length: DECLINE_TOKEN_MAX_HASHES + 1 }, () => mintDeclineToken(member.id)),
    );
    db.sql
      .prepare('UPDATE team_members SET decline_token_hashes = ? WHERE id = ?')
      .run(tokens.map((t) => t.hash).join(' '), member.id);
    await expect(resolveDeclineToken(db.env, tokens[1]!.token)).resolves.not.toBeNull();
    await expect(
      resolveDeclineToken(db.env, tokens[DECLINE_TOKEN_MAX_HASHES]!.token),
    ).resolves.toBeNull();
  });
});

describe('declineTeamInvite', () => {
  it('flips an invited row once, so only one request tells anyone', async () => {
    const db = seedTeam();
    const { member } = await addTeamMember(db.env, { teamId: 't', email: 'a@x.test' });
    const [a, b] = await Promise.all([
      declineTeamInvite(db.env, member.id),
      declineTeamInvite(db.env, member.id),
    ]);
    expect([a, b].sort()).toEqual([false, true]);
    await expect(teamInviteStatus(db.env, member.id)).resolves.toBe('declined');
  });

  it('never touches a joined row', async () => {
    const db = seedTeam();
    await expect(declineTeamInvite(db.env, 'admin')).resolves.toBe(false);
    await expect(teamInviteStatus(db.env, 'admin')).resolves.toBe('joined');
    await expect(teamInviteStatus(db.env, 'missing')).resolves.toBeNull();
  });
});

describe('rejected rows are records, not memberships', () => {
  it('stays on the list as declined, but grants no membership', async () => {
    const db = seedTeam();
    const { member } = await addTeamMember(db.env, { teamId: 't', email: 'a@x.test' });
    db.sql.prepare(`UPDATE team_members SET user_id = 'user-a' WHERE id = ?`).run(member.id);
    await declineTeamInvite(db.env, member.id);
    const list = await listTeamMembers(db.env, 't');
    expect(list.find((m) => m.id === member.id)?.status).toBe('declined');
    await expect(getMembership(db.env, 't', 'user-a')).resolves.toBeNull();
    await expect(getMembership(db.env, 't', 'user-admin')).resolves.not.toBeNull();
  });

  it('reads an expired row as expired', async () => {
    const db = seedTeam();
    const { member } = await addTeamMember(db.env, { teamId: 't', email: 'a@x.test' });
    db.sql.prepare(`UPDATE team_members SET status = 'expired' WHERE id = ?`).run(member.id);
    const list = await listTeamMembers(db.env, 't');
    expect(list.find((m) => m.id === member.id)?.status).toBe('expired');
  });

  it('is never claimed by the lazy email claim', async () => {
    const db = seedTeam();
    const { member } = await addTeamMember(db.env, { teamId: 't', email: 'a@x.test' });
    await declineTeamInvite(db.env, member.id);
    await connectInvitesByEmail(db.env, 'user-a', 'a@x.test');
    expect(rowOf(db, member.id).user_id).toBeNull();
  });

  it('does not block inviting the address again, which replaces it with a fresh invite', async () => {
    const db = seedTeam();
    const first = await addTeamMember(db.env, { teamId: 't', email: 'a@x.test' });
    await expect(teamHasEmail(db.env, 't', 'a@x.test')).resolves.toBe(true);
    await declineTeamInvite(db.env, first.member.id);
    await expect(teamHasEmail(db.env, 't', 'a@x.test')).resolves.toBe(false);
    const second = await addTeamMember(db.env, { teamId: 't', email: 'a@x.test' });
    expect(second.member.id).not.toBe(first.member.id);
    expect(rowOf(db, first.member.id)).toBeUndefined();
    expect(rowOf(db, second.member.id).status).toBe('invited');
    // The old email's link no longer names anything.
    await expect(resolveDeclineToken(db.env, first.declineToken)).resolves.toBeNull();
  });

  it('gives way to a join by link, by user and by address', async () => {
    const db = seedTeam();
    db.sql
      .prepare(
        `UPDATE teams SET invite_link_token = 'link', invite_link_expires_at = ? WHERE id = 't'`,
      )
      .run(Date.now() + 60_000);
    const { member } = await addTeamMember(db.env, { teamId: 't', email: 'a@x.test' });
    db.sql.prepare(`UPDATE team_members SET user_id = 'user-a' WHERE id = ?`).run(member.id);
    await declineTeamInvite(db.env, member.id);
    await expect(joinTeamByInviteToken(db.env, 'link', 'user-a', 'a@x.test')).resolves.toEqual({
      teamId: 't',
      alreadyMember: false,
    });
    expect(rowOf(db, member.id)).toBeUndefined();
    const joined = await getMembership(db.env, 't', 'user-a');
    expect(joined).toMatchObject({ status: 'joined', email: 'a@x.test' });
  });
});

describe('migration 0095', () => {
  it('never reminds an invite that was pending before it ran', () => {
    const db = sqliteD1({}, { before: '0095' });
    db.sql
      .prepare(`INSERT INTO teams (id, name, created_at, updated_at) VALUES ('t', 'T', 0, 0)`)
      .run();
    db.sql
      .prepare(
        `INSERT INTO team_members (id, team_id, user_id, email, role, status, created_at, updated_at)
         VALUES ('old', 't', NULL, 'a@x.test', 'member', 'invited', 0, 0),
                ('in', 't', 'u', 'u@x.test', 'admin', 'joined', 0, 0)`,
      )
      .run();
    db.sql.exec(
      readFileSync(
        fileURLToPath(
          new URL('../../migrations/0095_team_invite_decline_and_reminders.sql', import.meta.url)
            .href,
        ),
        'utf8',
      ),
    );
    expect(rowOf(db, 'old')).toMatchObject({
      reminder1_sent_at: 0,
      reminder2_sent_at: 0,
      reminder3_sent_at: 0,
      reminder_attempts: 0,
    });
    expect(rowOf(db, 'in').reminder1_sent_at).toBeNull();
  });
});
