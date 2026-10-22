import { beforeEach, describe, expect, it } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { deleteOldProjectOpens, migrateProjectOpens } from './project-opens';

// project_opens on sign-up and over time (docs/specs/013-workspace/explorer-home.md "Guests,
// sign-up and deletion"; blueprint "Data and persistence"): one row per person per project, the
// last open and its day.

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;
let db: SqliteD1;

function open(owner: string, doc: string, last: number) {
  db.sql
    .prepare(
      `INSERT INTO project_opens (owner_id, project_id, last_opened_at, last_open_day)
       VALUES (?, ?, ?, ?)`,
    )
    .run(owner, doc, last, new Date(last).toISOString().slice(0, 10));
}

function rows(owner: string) {
  return db.sql
    .prepare('SELECT * FROM project_opens WHERE owner_id = ? ORDER BY project_id')
    .all(owner) as { project_id: string; last_opened_at: number; last_open_day: string }[];
}

beforeEach(() => {
  db = sqliteD1();
  for (const id of ['d1', 'd2', 'd3']) {
    db.sql.exec(`INSERT INTO projects (id, owner_id, name, shareable, saved_at, created_at)
                 VALUES ('${id}', 'someone', '${id}', 1, 1, 1)`);
  }
});

describe('migrateProjectOpens', () => {
  it("moves the guest's opens and merges a project opened under both identities", async () => {
    open('guest', 'd1', T0 + 2 * DAY);
    open('guest', 'd2', T0);
    open('user_a', 'd2', T0 + DAY);
    open('user_a', 'd3', T0);

    expect(await migrateProjectOpens(db.env, 'guest', 'user_a')).toEqual({ moved: 1, merged: 1 });

    expect(rows('guest')).toEqual([]);
    const [d1, d2, d3] = rows('user_a');
    expect(d1).toMatchObject({ project_id: 'd1', last_opened_at: T0 + 2 * DAY });
    expect(d2).toMatchObject({
      project_id: 'd2',
      last_opened_at: T0 + DAY,
      last_open_day: '2023-11-15',
    });
    expect(d3).toMatchObject({ project_id: 'd3', last_opened_at: T0 });
  });

  it("keeps the guest's later open when the guest opened it last", async () => {
    open('guest', 'd1', T0 + 3 * DAY);
    open('user_a', 'd1', T0);
    await migrateProjectOpens(db.env, 'guest', 'user_a');
    expect(rows('user_a')[0]).toMatchObject({
      last_opened_at: T0 + 3 * DAY,
      last_open_day: '2023-11-17',
    });
  });

  it('is a no-op the second time', async () => {
    open('guest', 'd1', T0);
    await migrateProjectOpens(db.env, 'guest', 'user_a');
    expect(await migrateProjectOpens(db.env, 'guest', 'user_a')).toEqual({ moved: 0, merged: 0 });
    expect(rows('user_a')).toHaveLength(1);
  });
});

describe('opens and the project', () => {
  it("go with a project deleted for good, everyone's", () => {
    open('a', 'd1', T0);
    open('b', 'd1', T0);
    db.sql.exec("DELETE FROM projects WHERE id = 'd1'");
    expect([...rows('a'), ...rows('b')]).toEqual([]);
  });
});

describe('deleteOldProjectOpens', () => {
  it('forgets opens last made before the cutoff', async () => {
    open('a', 'd1', T0);
    open('a', 'd2', T0 + DAY);
    expect(await deleteOldProjectOpens(db.env, T0 + 1)).toBe(1);
    expect(rows('a').map((r) => r.project_id)).toEqual(['d2']);
  });
});
