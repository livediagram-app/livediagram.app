import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { isNotifyKey, readNotifySettings, teamMemberCounts, teamPeople } from './notify.ts';
import { answerInvitation, createTeam, deleteTeam, inviteMember, type Actor } from './teams.ts';
import { addUser, testD1 } from './test-d1.ts';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';

const ADA: Actor = { id: 'user_ada', email: 'ada@example.com' };
const BEA: Actor = { id: 'user_bea', email: 'bea@example.com' };

let db: D1Database;
let sql: DatabaseSync;

beforeEach(() => {
  ({ db, sql } = testD1());
  addUser(sql, { id: ADA.id, email: ADA.email!, name: 'Ada Account' });
  addUser(sql, { id: BEA.id, email: BEA.email!, name: 'Bea' });
});

function setPrefs(owner: string, scope: string, prefs: Record<string, unknown>) {
  sql
    .prepare(`INSERT INTO settings (owner_id, scope, prefs, updated_at) VALUES (?, ?, ?, 0)`)
    .run(owner, scope, JSON.stringify(prefs));
}

describe('readNotifySettings', () => {
  it('answers the named switches in both scopes, and leaves out what nobody set', async () => {
    setPrefs(ADA.id, 'all', { notifyMentions: false, theme: 'dark', notifyComments: true });
    setPrefs(ADA.id, 'liveplanner.app', { notifyProjectJoin: false });
    setPrefs(ADA.id, 'livediagram.app', { notifyProjectJoin: true });
    setPrefs(BEA.id, 'all', { theme: 'light' });
    const read = await readNotifySettings(db, [ADA.id, BEA.id, 'user_nobody'], 'liveplanner.app', [
      'notifyMentions',
      'notifyProjectJoin',
    ]);
    expect(read).toEqual({
      [ADA.id]: { all: { notifyMentions: false }, app: { notifyProjectJoin: false } },
    });
    expect(await readNotifySettings(db, [], 'liveplanner.app', ['notifyMentions'])).toEqual({});
  });

  it('reads a hundred people in one query, within budget', async () => {
    const owners = Array.from({ length: 100 }, (_, i) => `user_p${i}`);
    for (const owner of owners) {
      // Each with a near-full row, so the scan of every row's JSON is the worst case.
      setPrefs(owner, 'all', {
        notifyMentions: false,
        filler: 'x'.repeat(15_000),
      });
    }
    const started = cpuNowMs();
    const read = await readNotifySettings(db, owners, 'liveplanner.app', ['notifyMentions']);
    expect(Object.keys(read)).toHaveLength(100);
    expect(cpuNowMs() - started).toBeLessThan(cpuBudgetMs(250));
  });

  it('takes only notify switches', () => {
    expect(isNotifyKey('notifyMentions')).toBe(true);
    expect(isNotifyKey('theme')).toBe(false);
    expect(isNotifyKey('notify')).toBe(false);
    expect(isNotifyKey('notify"x')).toBe(false);
  });
});

describe('teamPeople', () => {
  it("answers a live team's joined and invited people, with names", async () => {
    const made = await createTeam(db, ADA, 'Design');
    if (!made.ok) throw new Error(made.error);
    const teamId = made.value.id;
    const bea = await inviteMember(db, ADA, teamId, BEA.email, 'member');
    if (!bea.ok) throw new Error(bea.error);
    await answerInvitation(db, BEA, bea.value.member.id, true);
    await inviteMember(db, ADA, teamId, 'cy@example.com', 'member');
    const declined = await inviteMember(db, ADA, teamId, 'dee@example.com', 'member');
    if (!declined.ok) throw new Error(declined.error);
    sql
      .prepare(`UPDATE team_member SET status = 'declined' WHERE id = ?`)
      .run(declined.value.member.id);
    sql
      .prepare(
        `INSERT INTO profile (owner_id, name, color, created_at, updated_at) VALUES (?, 'Ada L', NULL, 0, 0)`,
      )
      .run(ADA.id);
    sql
      .prepare(
        `INSERT INTO profile (owner_id, name, color, created_at, updated_at) VALUES (?, NULL, '#ef4444', 0, 0)`,
      )
      .run(BEA.id);

    const found = await teamPeople(db, teamId);
    expect(found?.team).toEqual({ id: teamId, name: 'Design' });
    expect(
      found?.members.map(({ userId, email, name, status, color }) => ({
        userId,
        email,
        name,
        status,
        color,
      })),
    ).toEqual([
      // Ada is on Automatic; Bea chose Red, and her chosen colour rides with her (the apps' assignee picker paints it).
      { userId: ADA.id, email: 'ada@example.com', name: 'Ada L', status: 'joined', color: null },
      { userId: BEA.id, email: 'bea@example.com', name: 'Bea', status: 'joined', color: '#ef4444' },
      { userId: null, email: 'cy@example.com', name: null, status: 'invited', color: null },
    ]);

    await deleteTeam(db, ADA, teamId);
    expect(await teamPeople(db, teamId)).toBeNull();
    expect(await teamPeople(db, 'no-such-team')).toBeNull();
  });
});

describe('teamMemberCounts', () => {
  it('counts the joined people of several teams in one read, and leaves out a deleted or unknown team', async () => {
    const design = await createTeam(db, ADA, 'Counted Design');
    const solo = await createTeam(db, ADA, 'Counted Solo');
    const gone = await createTeam(db, ADA, 'Counted Gone');
    if (!design.ok || !solo.ok || !gone.ok) throw new Error('team not made');
    const bea = await inviteMember(db, ADA, design.value.id, BEA.email, 'member');
    if (!bea.ok) throw new Error(bea.error);
    await answerInvitation(db, BEA, bea.value.member.id, true);
    // Invited, not joined: never counted.
    await inviteMember(db, ADA, design.value.id, 'cy@example.com', 'member');
    await deleteTeam(db, ADA, gone.value.id);

    expect(
      await teamMemberCounts(db, [
        design.value.id,
        solo.value.id,
        design.value.id,
        gone.value.id,
        'no-such-team',
      ]),
    ).toEqual({ [design.value.id]: 2, [solo.value.id]: 1 });
    expect(await teamMemberCounts(db, [])).toEqual({});
  });
});
