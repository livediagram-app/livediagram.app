// The tab save's one-query design read (db/tab-save-design.ts), against the real migrations: the fields the save uses,
// where a new tab lands, and an unknown design reading as missing.
import { describe, expect, it, vi } from 'vitest';
vi.mock('../accounts/profiles', async () =>
  (await import('../test-profiles')).fakeProfilesModule(),
);
import { resetProfiles, seedProfile } from '../test-profiles';
import { sqliteD1 } from '../test-sqlite-d1';
import { getDesign } from './designs';
import { getDesignForSave } from './tab-save-design';

function setUp() {
  const db = sqliteD1();
  resetProfiles();
  seedProfile('owner', 'Ada', '#ff0000');
  db.sql.exec(`
    INSERT INTO test_designs (id, owner_id, name, shareable, saved_at, created_at, team_id)
      VALUES ('d1', 'owner', 'Design', 0, 5, 3, NULL);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'One', '{"elements":[]}', 1), ('t2', 'Two', '{"elements":[]}', 1);
    INSERT INTO design_tabs (design_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1), ('d1', 't2', 1, 1);
  `);
  return db;
}

describe('getDesignForSave', () => {
  it('answers what the save uses, matching the full read', async () => {
    const { env } = setUp();
    const saving = await getDesignForSave(env, 'd1');
    const full = await getDesign(env, 'd1');
    expect(saving).toEqual({
      id: 'd1',
      ownerId: 'owner',
      teamId: null,
      name: 'Design',
      createdAt: 3,
      nextOrderIndex: 2,
    });
    expect(saving).toMatchObject({
      ownerId: full!.ownerId,
      createdAt: full!.createdAt,
      nextOrderIndex: full!.tabs.length,
    });
  });

  // docs/specs/006-design/per-tab-storage.md "New tabs and the tab order": after the last tab, never on a place
  // another holds.
  it('places a new tab after the last, though a middle tab was deleted', async () => {
    const { env, sql } = setUp();
    // One, Two at 0, 1; a third at 2, then Two leaves: two tabs, the last at place 2.
    sql.exec(`
      INSERT INTO tabs (id, name, data, updated_at) VALUES ('t3', 'Three', '{"elements":[]}', 1);
      INSERT INTO design_tabs (design_id, tab_id, order_index, added_at) VALUES ('d1', 't3', 2, 1);
      DELETE FROM design_tabs WHERE tab_id = 't2';
    `);
    expect((await getDesignForSave(env, 'd1'))!.nextOrderIndex).toBe(3);
  });

  it('places the first tab of an empty design at 0', async () => {
    const { env, sql } = setUp();
    sql.exec(`DELETE FROM design_tabs WHERE design_id = 'd1';`);
    expect((await getDesignForSave(env, 'd1'))!.nextOrderIndex).toBe(0);
  });

  it('reads an unknown design as missing', async () => {
    const { env } = setUp();
    expect(await getDesignForSave(env, 'nope')).toBeNull();
  });
});
