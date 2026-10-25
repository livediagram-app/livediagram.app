import { beforeEach, describe, expect, it } from 'vitest';
import {
  answerInvitation,
  createTeam,
  deleteTeam,
  inviteMember,
  leaveAllTeams,
  listMembers,
  listMyInvitations,
  listMyTeams,
  MAX_TEAMS_PER_ACCOUNT,
  removeMember,
  setMemberRole,
  teamChanges,
  teamsClaim,
  updateTeam,
  type Actor,
} from './teams.ts';
import { addUser, testD1 } from './test-d1.ts';

const ADA: Actor = { id: 'user_ada', email: 'ada@example.com' };
const BEA: Actor = { id: 'user_bea', email: 'bea@example.com' };
const CY: Actor = { id: 'user_cy', email: 'cy@example.com' };

let db: D1Database;

beforeEach(() => {
  const d1 = testD1();
  db = d1.db;
  for (const actor of [ADA, BEA, CY]) addUser(d1.sql, { id: actor.id, email: actor.email! });
});

async function teamWith(...members: Actor[]): Promise<string> {
  const made = await createTeam(db, ADA, 'Design');
  if (!made.ok) throw new Error(made.error);
  for (const member of members) {
    const invited = await inviteMember(db, ADA, made.value.id, member.email, 'member');
    if (!invited.ok) throw new Error(invited.error);
    await answerInvitation(db, member, invited.value.member.id, true);
  }
  return made.value.id;
}

const memberId = async (teamId: string, actor: Actor) =>
  (await listMembers(db, teamId)).find((m) => m.userId === actor.id)!.id;

describe('teams', () => {
  it('makes the creator its admin', async () => {
    const made = await createTeam(db, ADA, '  Design  ');
    expect(made).toMatchObject({
      ok: true,
      value: { name: 'Design', role: 'admin', memberCount: 1 },
    });
    expect(await listMyTeams(db, ADA.id)).toEqual([
      expect.objectContaining({ name: 'Design', role: 'admin', memberCount: 1 }),
    ]);
  });

  it('refuses a blank name', async () => {
    expect(await createTeam(db, ADA, '   ')).toEqual({
      ok: false,
      status: 400,
      error: 'name_required',
    });
  });

  it('lets only the invited, verified address answer an invitation', async () => {
    const teamId = await teamWith();
    const invited = await inviteMember(db, ADA, teamId, 'BEA@example.com', 'member');
    if (!invited.ok) throw new Error(invited.error);
    expect(await listMyInvitations(db, BEA.email)).toEqual([
      expect.objectContaining({ teamName: 'Design', invitedByName: 'user_ada' }),
    ]);
    // Someone else, and Bea without a verified address, can't take it.
    expect(await answerInvitation(db, CY, invited.value.member.id, true)).toMatchObject({
      ok: false,
    });
    expect(
      await answerInvitation(db, { id: BEA.id, email: null }, invited.value.member.id, true),
    ).toMatchObject({ ok: false, error: 'email_unverified' });
    expect(await answerInvitation(db, BEA, invited.value.member.id, true)).toMatchObject({
      ok: true,
      value: { status: 'joined' },
    });
    expect(await listMyTeams(db, BEA.id)).toEqual([
      expect.objectContaining({ id: teamId, role: 'member', memberCount: 2 }),
    ]);
    expect(await listMyInvitations(db, BEA.email)).toEqual([]);
  });

  it('refuses a second invitation to the same address, and lets a declined one be sent again', async () => {
    const teamId = await teamWith();
    const first = await inviteMember(db, ADA, teamId, BEA.email, 'member');
    expect(await inviteMember(db, ADA, teamId, BEA.email, 'member')).toMatchObject({
      ok: false,
      error: 'already_invited',
    });
    if (!first.ok) throw new Error(first.error);
    await answerInvitation(db, BEA, first.value.member.id, false);
    expect(await inviteMember(db, ADA, teamId, BEA.email, 'admin')).toMatchObject({ ok: true });
  });

  it('keeps the running of a team to its admins', async () => {
    const teamId = await teamWith(BEA);
    expect(await updateTeam(db, BEA, teamId, { name: 'Mine' })).toMatchObject({
      ok: false,
      error: 'admin_only',
    });
    expect(await inviteMember(db, BEA, teamId, CY.email, 'member')).toMatchObject({
      ok: false,
      error: 'admin_only',
    });
    expect(await deleteTeam(db, BEA, teamId)).toMatchObject({ ok: false, error: 'admin_only' });
    expect(await updateTeam(db, CY, teamId, { name: 'Mine' })).toMatchObject({ ok: false, status: 404 });
    expect(await updateTeam(db, ADA, teamId, { name: 'Studio' })).toMatchObject({ ok: true });
  });

  it('never leaves a team without an admin', async () => {
    const teamId = await teamWith(BEA);
    const ada = await memberId(teamId, ADA);
    expect(await setMemberRole(db, ADA, teamId, ada, 'member')).toMatchObject({
      error: 'last_admin',
    });
    expect(await removeMember(db, ADA, teamId, ada)).toMatchObject({ error: 'last_admin' });
    await setMemberRole(db, ADA, teamId, await memberId(teamId, BEA), 'admin');
    expect(await removeMember(db, ADA, teamId, ada)).toMatchObject({
      ok: true,
      value: { teamDeleted: false },
    });
    expect(await listMyTeams(db, ADA.id)).toEqual([]);
  });

  it('lets a member leave, but not remove anyone else', async () => {
    const teamId = await teamWith(BEA, CY);
    expect(await removeMember(db, BEA, teamId, await memberId(teamId, CY))).toMatchObject({
      error: 'admin_only',
    });
    expect(await removeMember(db, BEA, teamId, await memberId(teamId, BEA))).toMatchObject({
      ok: true,
    });
    expect(await listMyTeams(db, BEA.id)).toEqual([]);
  });

  it('deletes the team when its last member leaves', async () => {
    const teamId = await teamWith();
    expect(await removeMember(db, ADA, teamId, await memberId(teamId, ADA))).toMatchObject({
      value: { teamDeleted: true },
    });
    expect(await listMyTeams(db, ADA.id)).toEqual([]);
  });

  it('caps the teams one account can be in', async () => {
    for (let i = 0; i < MAX_TEAMS_PER_ACCOUNT; i++) await createTeam(db, ADA, `Team ${i}`);
    expect(await createTeam(db, ADA, 'One more')).toMatchObject({ error: 'team_limit_reached' });
    expect(await teamsClaim(db, ADA.id)).toHaveLength(MAX_TEAMS_PER_ACCOUNT);
  });

  it('hands a team on when its only admin closes their account', async () => {
    const shared = await teamWith(BEA);
    const solo = (await createTeam(db, ADA, 'Solo')) as { ok: true; value: { id: string } };
    await leaveAllTeams(db, ADA.id);
    expect(await listMyTeams(db, BEA.id)).toEqual([
      expect.objectContaining({ id: shared, role: 'admin', memberCount: 1 }),
    ]);
    const changes = await teamChanges(db, null);
    expect(changes.teams.find((t) => t.id === solo.value.id)?.deleted).toBe(true);
  });
});

describe('teamChanges', () => {
  it('follows every change after the cursor, tombstones included', async () => {
    const teamId = await teamWith(BEA);
    const first = await teamChanges(db, null);
    expect(first.teams.map((t) => t.name)).toEqual(['Design']);
    expect(first.members.map((m) => [m.userId, m.status])).toEqual(
      expect.arrayContaining([
        ['user_ada', 'joined'],
        ['user_bea', 'joined'],
      ]),
    );

    // Nothing new: an empty page, and the cursor stays put.
    const idle = await teamChanges(db, first.cursor);
    expect(idle).toMatchObject({ teams: [], members: [], cursor: first.cursor, more: false });

    await removeMember(db, ADA, teamId, await memberId(teamId, BEA));
    const removed = await teamChanges(db, first.cursor);
    expect(removed.members).toEqual([
      expect.objectContaining({ userId: 'user_bea', status: 'removed' }),
    ]);

    await deleteTeam(db, ADA, teamId);
    const deleted = await teamChanges(db, removed.cursor);
    expect(deleted.teams).toEqual([expect.objectContaining({ id: teamId, deleted: true })]);
    expect(deleted.members).toEqual([
      expect.objectContaining({ userId: 'user_ada', status: 'removed' }),
    ]);
  });

  it('pages without skipping rows that share a rev', async () => {
    const teamId = await teamWith(BEA, CY);
    await deleteTeam(db, ADA, teamId);
    // One statement marked all three members removed under one rev; read one row at a time.
    let cursor: string | null = null;
    const seen: string[] = [];
    for (let page = 0; page < 20; page++) {
      const changes = await teamChanges(db, cursor, 1);
      seen.push(...changes.members.map((m) => `${m.id}:${m.status}`));
      cursor = changes.cursor;
      if (!changes.more && changes.members.length === 0) break;
    }
    const removed = seen.filter((entry) => entry.endsWith(':removed'));
    expect(new Set(removed).size).toBe(3);
  });
});
