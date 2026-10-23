import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemberChange, TeamChange, TeamChanges } from '@liveworkspace/auth-client';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { catchUpTeams, syncTeams } from './team-sync';

// The teams mirror (liveworkspace/docs/accounts.md "How an app keeps up"), against a stand-in for
// liveworkspace's change feed that serves `pages` in order.

const CREDENTIALS = { accountsUrl: 'https://accounts.example', clientId: 'lp', clientSecret: 's' };

let pages: TeamChanges[];
const asked: (string | null)[] = [];
vi.stubGlobal('fetch', async (input: string) => {
  asked.push(new URL(input).searchParams.get('cursor'));
  const page = pages.shift() ?? { teams: [], members: [], cursor: 'end', more: false };
  return Response.json(page);
});

const team = (id: string, over: Partial<TeamChange> = {}): TeamChange => ({
  id,
  name: 'Design',
  deleted: false,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});
const member = (id: string, userId: string, over: Partial<MemberChange> = {}): MemberChange => ({
  id,
  teamId: 'team1',
  userId,
  email: `${userId}@example.com`,
  role: 'member',
  status: 'joined',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});
const page = (teams: TeamChange[], members: MemberChange[], cursor: string, more = false) => ({
  teams,
  members,
  cursor,
  more,
});

let db: SqliteD1;
beforeEach(() => {
  db = sqliteD1();
  pages = [];
  asked.length = 0;
});

const membersOf = (teamId: string) =>
  db.sql
    .prepare('SELECT id, user_id, role, status FROM team_members WHERE team_id = ? ORDER BY id')
    .all(teamId);

describe('syncTeams', () => {
  it('copies teams and their joined members, and keeps the cursor', async () => {
    pages = [
      page(
        [team('team1')],
        [member('m1', 'ada', { role: 'admin' }), member('m2', 'bea')],
        '1:team1,2:m2',
      ),
    ];
    expect(await syncTeams(db.env, CREDENTIALS)).toBe(3);
    expect(membersOf('team1')).toEqual([
      { id: 'm1', user_id: 'ada', role: 'admin', status: 'joined' },
      { id: 'm2', user_id: 'bea', role: 'member', status: 'joined' },
    ]);
    expect(db.sql.prepare('SELECT organisation FROM teams').get()).toEqual({ organisation: null });
    pages = [page([team('team1', { name: 'Studio', organisation: 'Acme' })], [], '3:team1,2:m2')];
    await syncTeams(db.env, CREDENTIALS);
    expect(asked).toEqual([null, '1:team1,2:m2']);
    expect(db.sql.prepare('SELECT name, organisation FROM teams').get()).toEqual({
      name: 'Studio',
      organisation: 'Acme',
    });
  });

  it('follows every page to the end', async () => {
    pages = [
      page([team('team1')], [], 'a', true),
      page([], [member('m1', 'ada')], 'b', true),
      page([], [member('m2', 'bea')], 'c'),
    ];
    expect(await syncTeams(db.env, CREDENTIALS)).toBe(3);
    expect(membersOf('team1')).toHaveLength(2);
  });

  it('drops someone who left, was removed or never joined', async () => {
    pages = [page([team('team1')], [member('m1', 'ada'), member('m2', 'bea')], 'a')];
    await syncTeams(db.env, CREDENTIALS);
    pages = [
      page(
        [],
        [member('m2', 'bea', { status: 'removed' }), member('m3', 'cy', { status: 'invited' })],
        'b',
      ),
    ];
    await syncTeams(db.env, CREDENTIALS);
    expect(membersOf('team1')).toEqual([
      { id: 'm1', user_id: 'ada', role: 'member', status: 'joined' },
    ]);
  });

  it('takes a rejoin under a new member id', async () => {
    pages = [page([team('team1')], [member('m1', 'ada')], 'a')];
    await syncTeams(db.env, CREDENTIALS);
    pages = [page([], [member('m9', 'ada', { role: 'admin' })], 'b')];
    await syncTeams(db.env, CREDENTIALS);
    expect(membersOf('team1')).toEqual([
      { id: 'm9', user_id: 'ada', role: 'admin', status: 'joined' },
    ]);
  });

  it('deletes a deleted team with its members', async () => {
    pages = [page([team('team1')], [member('m1', 'ada')], 'a')];
    await syncTeams(db.env, CREDENTIALS);
    pages = [
      page([team('team1', { deleted: true })], [member('m1', 'ada', { status: 'removed' })], 'b'),
    ];
    await syncTeams(db.env, CREDENTIALS);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM teams').get()).toEqual({ n: 0 });
    expect(membersOf('team1')).toEqual([]);
  });

  it('skips a member of a team it never saw', async () => {
    pages = [page([], [member('m1', 'ada', { teamId: 'gone' })], 'a')];
    await syncTeams(db.env, CREDENTIALS);
    expect(membersOf('gone')).toEqual([]);
  });
});

describe('catchUpTeams', () => {
  it('reads the feed only when the claim differs from the copy, then not again', async () => {
    const claim = [{ id: 'team1', name: 'Design', role: 'admin' as const }];
    pages = [page([team('team1')], [member('m1', 'user_ada', { role: 'admin' })], 'a')];
    await catchUpTeams(db.env, CREDENTIALS, 'user_ada', claim);
    expect(asked).toHaveLength(1);
    expect(membersOf('team1')).toHaveLength(1);
    // The same claim again, in this isolate: no read, no query.
    await catchUpTeams(db.env, CREDENTIALS, 'user_ada', claim);
    expect(asked).toHaveLength(1);
  });

  it('leaves a matching copy alone', async () => {
    pages = [page([team('team1')], [member('m1', 'user_bea')], 'a')];
    await syncTeams(db.env, CREDENTIALS);
    asked.length = 0;
    await catchUpTeams(db.env, CREDENTIALS, 'user_bea', [
      { id: 'team1', name: 'Design', role: 'member' },
    ]);
    expect(asked).toEqual([]);
  });

  // Every signed-in request runs this check, so its steady state must stay cheap: 10,000 requests
  // carrying a 49-team claim (the most it compares), each a freshly parsed copy, without the
  // database or the feed.
  it('costs next to nothing per request once caught up, at the largest claim', async () => {
    const teams = Array.from({ length: 49 }, (_, i) => team(`team${String(i).padStart(2, '0')}`));
    pages = [
      page(
        teams,
        teams.map((t, i) => member(`m${i}`, 'user_dee', { teamId: t.id })),
        'a',
      ),
    ];
    const claim = teams.map((t) => ({ id: t.id, name: t.name, role: 'member' as const }));
    await catchUpTeams(db.env, CREDENTIALS, 'user_dee', claim);
    const prepare = vi.spyOn(db.env.DB, 'prepare');
    asked.length = 0;
    const started = performance.now();
    for (let i = 0; i < 10_000; i++) {
      await catchUpTeams(db.env, CREDENTIALS, 'user_dee', structuredClone(claim));
    }
    expect(performance.now() - started).toBeLessThan(1000);
    expect(prepare).not.toHaveBeenCalled();
    expect(asked).toEqual([]);
  });

  it('never throws, so a request goes on when liveworkspace is down', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 502 }));
    await expect(
      catchUpTeams(db.env, CREDENTIALS, 'user_cy', [{ id: 'x', name: 'X', role: 'member' }]),
    ).resolves.toBeUndefined();
  });
});
