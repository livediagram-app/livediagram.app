import { describe, expect, it } from 'vitest';
import { ANONYMISED_NAME } from '@liveworkspace/index-app';
import { itemPersonId, type Item } from '@liveplanner/items';
import { sqliteD1 } from '../test-sqlite-d1';
import { appendItemHistory } from '../db/item-history';
import { listItems } from '../db/items';
import { readSheetHead } from '../db/sheets';
import { anonymisePlan } from './plan-anonymise';

// A closed account's name off a plan that outlives them (plan-anonymise.ts): here, the card history they wrote
// (docs/specs/026-plan/items.md "History"), which names its authors by their hashed id as the cards do.
describe('anonymisePlan', () => {
  it('names a closed account’s history entries Deleted account, and leaves everyone else’s', async () => {
    const db = sqliteD1();
    db.sql.exec(`INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
                 VALUES ('P', 'user_gone', 'Plan', 0, 1, 1)`);
    db.sql
      .exec(`INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at,
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

  // Created By and Last Edited By hold a JSON person keyed by the hashed id, as history does (items.md "Created and
  // Last Edited"); a raw id there is a card from before cards held a person.
  it('names a closed account Deleted account in the Created By and Last Edited By of their cards', async () => {
    const db = sqliteD1();
    db.sql.exec(`INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
                 VALUES ('P', 'user_kept', 'Plan', 0, 1, 1)`);
    const gone = JSON.stringify({
      id: await itemPersonId('user_gone'),
      name: 'Gone Person',
      color: '#2563eb',
    });
    const kept = JSON.stringify({
      id: await itemPersonId('user_kept'),
      name: 'Kept Person',
      color: '#dc2626',
    });
    const cards: [string, string, string][] = [
      ['made', gone, kept],
      ['edited', kept, gone],
      ['both', gone, gone],
      ['theirs', kept, kept],
      ['legacy', 'user_gone', 'not json'],
      ['older', 'deleted', kept],
    ];
    cards.forEach(([id, by, editedBy], i) =>
      db.sql
        .prepare(
          `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by,
                              updated_by) VALUES ('P', ?, 'task', ?, 'i', '{}', 1, 0, 0, ?, ?)`,
        )
        .run(id, i + 1, by, editedBy),
    );
    db.sql
      .prepare(
        `INSERT INTO sheets (plan_id, id, tab_id, title, layout, rev, created_at, updated_at, updated_by)
         VALUES ('P', 's1', 't', 'S', '{}', 1, 1, 1, ?), ('P', 's2', 't', 'S', '{}', 1, 1, 1, ?)`,
      )
      .run(gone, kept);

    expect(await anonymisePlan(db.env, 'P', 'user_gone')).toBe(5);

    const read = Object.fromEntries(
      (await listItems(db.env, 'P')).map((c) => [c.id, [c.createdBy.name, c.updatedBy.name]]),
    );
    const D = ANONYMISED_NAME;
    expect(read).toEqual({
      made: [D, 'Kept Person'],
      edited: ['Kept Person', D],
      both: [D, D],
      theirs: ['Kept Person', 'Kept Person'],
      legacy: [D, 'Someone'],
      older: [D, 'Kept Person'],
    });
    expect((await readSheetHead(db.env, 'P', 's1'))?.updatedBy.name).toBe(D);
    expect((await readSheetHead(db.env, 'P', 's2'))?.updatedBy.name).toBe('Kept Person');
    const stored = JSON.stringify(db.sql.prepare('SELECT created_by, updated_by FROM items').all());
    expect(stored).not.toContain('Gone Person');
    expect(stored).not.toContain('user_gone');
    // Running it again changes nothing.
    expect(await anonymisePlan(db.env, 'P', 'user_gone')).toBe(0);
  });
});
