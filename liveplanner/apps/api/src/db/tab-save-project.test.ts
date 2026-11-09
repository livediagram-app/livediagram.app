// The tab save's one-query project read (db/tab-save-project.ts), against the real migrations: the fields the save
// uses, the owner's profile (person/profiles.ts), where a new tab lands, and a trashed project reading as missing.
import { describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import { sqliteD1 } from '../test-sqlite-d1';
import { getProject } from './projects';
import { getProjectForSave } from './tab-save-project';

function setUp() {
  const db = sqliteD1();
  clearTestProfiles();
  setTestProfile('owner', 'Ada', '#ff0000');
  db.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at, team_id)
      VALUES ('d1', 'owner', 'Plan', 0, 5, 3, NULL);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'One', '{"elements":[]}', 1), ('t2', 'Two', '{"elements":[]}', 1);
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1), ('d1', 't2', 1, 1);
  `);
  return db;
}

describe('getProjectForSave', () => {
  it('answers what the save uses, matching the full read', async () => {
    const { env } = setUp();
    const saving = await getProjectForSave(env, 'd1');
    const full = await getProject(env, 'd1');
    expect(saving).toEqual({
      id: 'd1',
      ownerId: 'owner',
      teamId: null,
      name: 'Plan',
      createdAt: 3,
      ownerName: 'Ada',
      ownerColor: '#ff0000',
      nextOrderIndex: 2,
    });
    expect(saving).toMatchObject({
      ownerId: full!.ownerId,
      ownerName: full!.ownerName,
      ownerColor: full!.ownerColor,
      createdAt: full!.createdAt,
      nextOrderIndex: full!.tabs.length,
    });
  });

  // docs/specs/006-project/per-tab-storage.md "New tabs and the tab order": after the last tab, never on a place
  // another holds.
  it('places a new tab after the last, though a middle tab was deleted', async () => {
    const { env, sql } = setUp();
    // One, Two at 0, 1; a third at 2, then Two leaves: two tabs, the last at place 2.
    sql.exec(`
      INSERT INTO tabs (id, name, data, updated_at) VALUES ('t3', 'Three', '{"elements":[]}', 1);
      INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't3', 2, 1);
      DELETE FROM plan_tabs WHERE tab_id = 't2';
    `);
    expect((await getProjectForSave(env, 'd1'))!.nextOrderIndex).toBe(3);
  });

  it('places the first tab of an empty plan at 0', async () => {
    const { env, sql } = setUp();
    sql.exec(`DELETE FROM plan_tabs WHERE plan_id = 'd1';`);
    expect((await getProjectForSave(env, 'd1'))!.nextOrderIndex).toBe(0);
  });

  it('reads an unknown project as missing', async () => {
    const { env } = setUp();
    expect(await getProjectForSave(env, 'nope')).toBeNull();
  });

  it('has no owner name before the owner has a profile', async () => {
    const { env } = setUp();
    clearTestProfiles();
    expect(await getProjectForSave(env, 'd1')).toMatchObject({
      ownerName: null,
      ownerColor: null,
    });
  });
});
