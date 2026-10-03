import { beforeEach, describe, expect, it } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { migrateOwnerId } from './account';
import {
  clearPlacementDefault,
  listPlacementDefaults,
  setPlacementDefault,
} from './placement-defaults';

// placement_defaults on a real schema (docs/specs/013-workspace/default-folders.md): one default per
// person and key, listed in key order, a key out of force never listed, and a sign-up keeping the
// account's own default where both identities set one.

const T0 = 1_700_000_000_000;
let db: SqliteD1;

function rows() {
  return db.sql
    .prepare(
      'SELECT owner_id, default_key, folder_id FROM placement_defaults ORDER BY owner_id, default_key',
    )
    .all()
    .map((r) => ({ ...r }));
}

beforeEach(() => {
  db = sqliteD1();
});

describe('placement defaults store', () => {
  it('lists nothing for a person with no defaults', async () => {
    expect(await listPlacementDefaults(db.env, 'user_a')).toEqual([]);
  });

  it('lists the defaults in key order', async () => {
    await setPlacementDefault(db.env, 'user_a', 'mode:draw', 'f-sketch');
    await setPlacementDefault(db.env, 'user_a', 'mode:diagram', 'f-diagram');
    expect(await listPlacementDefaults(db.env, 'user_a')).toEqual([
      { key: 'mode:diagram', folderId: 'f-diagram' },
      { key: 'mode:draw', folderId: 'f-sketch' },
    ]);
  });

  it("lists only the person's own defaults", async () => {
    await setPlacementDefault(db.env, 'user_b', 'mode:draw', 'f-b');
    expect(await listPlacementDefaults(db.env, 'user_a')).toEqual([]);
  });

  it('replaces the folder when a key is set again', async () => {
    await setPlacementDefault(db.env, 'user_a', 'mode:draw', 'f-old');
    await setPlacementDefault(db.env, 'user_a', 'mode:draw', 'f-new');
    expect(rows()).toEqual([{ owner_id: 'user_a', default_key: 'mode:draw', folder_id: 'f-new' }]);
  });

  it('leaves out a stored key that is not in force', async () => {
    db.sql
      .prepare(
        'INSERT INTO placement_defaults (owner_id, default_key, folder_id, updated_at) VALUES (?, ?, ?, ?)',
      )
      .run('user_a', 'kind:mindmap', 'f-mind', T0);
    expect(await listPlacementDefaults(db.env, 'user_a')).toEqual([]);
  });

  it('clears one key and keeps the other', async () => {
    await setPlacementDefault(db.env, 'user_a', 'mode:draw', 'f-sketch');
    await setPlacementDefault(db.env, 'user_a', 'mode:diagram', 'f-diagram');
    await clearPlacementDefault(db.env, 'user_a', 'mode:draw');
    expect(await listPlacementDefaults(db.env, 'user_a')).toEqual([
      { key: 'mode:diagram', folderId: 'f-diagram' },
    ]);
  });

  it('clears a key that has no default without complaint', async () => {
    await expect(clearPlacementDefault(db.env, 'user_a', 'mode:draw')).resolves.toBeUndefined();
  });
});

describe('placement defaults on sign-up', () => {
  it("carries a guest's defaults into the account", async () => {
    await setPlacementDefault(db.env, 'guest-1', 'mode:draw', 'f-guest');
    await migrateOwnerId(db.env, 'guest-1', 'user_a');
    expect(rows()).toEqual([
      { owner_id: 'user_a', default_key: 'mode:draw', folder_id: 'f-guest' },
    ]);
  });

  it("keeps the account's own default for a key both identities set", async () => {
    await setPlacementDefault(db.env, 'user_a', 'mode:draw', 'f-account');
    await setPlacementDefault(db.env, 'guest-1', 'mode:draw', 'f-guest');
    await setPlacementDefault(db.env, 'guest-1', 'mode:diagram', 'f-guest-diagram');
    await migrateOwnerId(db.env, 'guest-1', 'user_a');
    expect(rows()).toEqual([
      { owner_id: 'user_a', default_key: 'mode:diagram', folder_id: 'f-guest-diagram' },
      { owner_id: 'user_a', default_key: 'mode:draw', folder_id: 'f-account' },
    ]);
  });
});
