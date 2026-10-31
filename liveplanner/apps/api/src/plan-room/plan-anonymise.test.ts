import { describe, expect, it } from 'vitest';
import { ANONYMISED_NAME } from '@liveworkspace/index-app';
import { itemPersonId, type Item } from '@liveplanner/items';
import { sqliteD1 } from '../test-sqlite-d1';
import { appendItemHistory } from '../db/item-history';
import { anonymisePlan } from './plan-anonymise';

// A closed account's name off a plan that outlives them (plan-anonymise.ts): here, the card history they wrote
// (docs/specs/026-plan/items.md "History"), which names its authors by their hashed id as the cards do.
describe('anonymisePlan', () => {
  it('names a closed account’s history entries Deleted account, and leaves everyone else’s', async () => {
    const db = sqliteD1();
    db.sql.exec(`INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
                 VALUES ('P', 'user_gone', 'Plan', 0, 1, 1)`);
    db.sql.exec(`INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at,
                   created_by, updated_by) VALUES ('P', 'card-0001', 'task', 1, 'i', '{}', 1, 0, 0, '{}', '{}')`);
    const gone = { id: await itemPersonId('user_gone'), name: 'Gone Person', color: '#2563eb' };
    const kept = { id: await itemPersonId('user_kept'), name: 'Kept Person', color: '#dc2626' };
    const card = (by: Item['createdBy'], at: number): Item => ({
      id: 'card-0001',
      type: 'task',
      key: 1,
      rank: 'i',
      fields: { title: `t${at}` },
      rev: at,
      createdAt: 0,
      updatedAt: at,
      createdBy: by,
      updatedBy: by,
    });
    await appendItemHistory(db.env, 'P', [{ before: null, after: card(gone, 1) }]);
    await appendItemHistory(db.env, 'P', [{ before: card(gone, 1), after: card(kept, 2) }]);

    await anonymisePlan(db.env, 'P', 'user_gone');

    const names = db.sql
      .prepare("SELECT by ->> '$.name' AS name FROM item_history ORDER BY id")
      .all()
      .map((r) => r.name);
    expect(names).toEqual([ANONYMISED_NAME, 'Kept Person']);
    expect(JSON.stringify(db.sql.prepare('SELECT by FROM item_history').all())).not.toContain(
      gone.id,
    );
  });
});
