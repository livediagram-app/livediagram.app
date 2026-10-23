// The tab save's one-query design read (db/tab-save-design.ts), against the real migrations: the fields the
// save uses, the tab count, and an unknown design reading as missing.
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
      tabCount: 2,
    });
    expect(saving).toMatchObject({
      ownerId: full!.ownerId,
      createdAt: full!.createdAt,
      tabCount: full!.tabs.length,
    });
  });

  it('reads an unknown design as missing', async () => {
    const { env } = setUp();
    expect(await getDesignForSave(env, 'nope')).toBeNull();
  });

});
