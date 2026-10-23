import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { claimMilestone, recordSighting, verifiedEmails } from './account-apps.ts';
import { addUser, testD1 } from './test-d1.ts';

let db: D1Database;
let sql: DatabaseSync;

beforeEach(() => {
  ({ db, sql } = testD1());
  addUser(sql, { id: 'user_ada', email: 'ada@example.com' });
  addUser(sql, { id: 'user_bea', email: 'bea@example.com', verified: false });
});

describe('sightings', () => {
  it('is first once per app, and never for an unknown account', async () => {
    expect(await recordSighting(db, 'user_ada', 'liveplanner.app', 1)).toBe(true);
    expect(await recordSighting(db, 'user_ada', 'liveplanner.app', 2)).toBe(false);
    expect(await recordSighting(db, 'user_ada', 'livediagram.app', 3)).toBe(true);
    expect(await recordSighting(db, 'user_nobody', 'livediagram.app')).toBe(false);
    expect(sql.prepare('SELECT app, first_seen_at FROM account_app ORDER BY app').all()).toEqual([
      { app: 'livediagram.app', first_seen_at: 3 },
      { app: 'liveplanner.app', first_seen_at: 1 },
    ]);
  });

  it('goes with the account', async () => {
    await recordSighting(db, 'user_ada', 'liveplanner.app');
    sql.prepare('DELETE FROM "user" WHERE id = ?').run('user_ada');
    expect(sql.prepare('SELECT count(*) AS n FROM account_app').get()).toEqual({ n: 0 });
  });
});

describe('milestones', () => {
  it('claims each once per app, and nothing for an app that never saw the account', async () => {
    expect(await claimMilestone(db, 'user_ada', 'liveplanner.app', 'milestone')).toBe(false);
    await recordSighting(db, 'user_ada', 'liveplanner.app');
    expect(await claimMilestone(db, 'user_ada', 'liveplanner.app', 'milestone')).toBe(true);
    expect(await claimMilestone(db, 'user_ada', 'liveplanner.app', 'milestone')).toBe(false);
    expect(await claimMilestone(db, 'user_ada', 'liveplanner.app', 'firstShare')).toBe(true);
  });
});

describe('emails', () => {
  it('answers verified addresses only', async () => {
    expect(await verifiedEmails(db, ['user_ada', 'user_bea', 'user_nobody', 'user_ada'])).toEqual({
      user_ada: 'ada@example.com',
    });
    expect(await verifiedEmails(db, [])).toEqual({});
  });
});
