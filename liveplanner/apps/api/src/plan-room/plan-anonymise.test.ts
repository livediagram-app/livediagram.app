import { describe, expect, it } from 'vitest';
import { ANONYMISED_NAME } from '@liveworkspace/index-app';
import { itemPersonId, type Item } from '@liveplanner/items';
import { sqliteD1 } from '../test-sqlite-d1';
import { appendItemHistory } from '../db/item-history';
import { listItems } from '../db/items';
import { readSheetHead } from '../db/sheets';
import { listHomeThreads } from '../db/card-threads';
import { anonymisePlan, anonymiseReactions, anonymiseTabReactions } from './plan-anonymise';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';

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

  // A card thread names its resolver and its comments' reactors by hashed id beside their names
  // (comment-reactions.md "On a card's comment threads"); a thread or reaction from before that holds only a name.
  it('names a closed account Deleted account where it resolved a thread or reacted, and leaves older rows', async () => {
    const db = sqliteD1();
    db.sql.exec(`INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
                 VALUES ('P', 'user_kept', 'Plan', 0, 1, 1)`);
    const gone = await itemPersonId('user_gone');
    const kept = await itemPersonId('user_kept');
    const starter = JSON.stringify({ name: 'Kept Person', color: '#dc2626' });
    const comments = JSON.stringify([
      {
        id: 'c1',
        authorName: 'Kept Person',
        text: 'hi',
        at: 1,
        reactions: [
          { emoji: 'heart', by: 'k-gone', name: 'Gone Person', person: gone },
          { emoji: 'heart', by: 'k-kept', name: 'Kept Person', person: kept },
          { emoji: 'eyes', by: 'k-gone', name: 'Gone Person' },
        ],
      },
    ]);
    const plain = JSON.stringify([{ id: 'c2', authorName: 'Kept Person', text: 'yo', at: 1 }]);
    const insert = db.sql.prepare(
      `INSERT INTO card_threads (plan_id, id, resolved, resolved_by, resolved_by_id, resolved_at, comments,
                                 created_at, created_by, updated_at, cards) VALUES ('P', ?, ?, ?, ?, ?, ?, 1, ?, 1, '[]')`,
    );
    insert.run('reacted', 0, null, null, null, comments, starter);
    insert.run('resolved', 1, 'Gone Person', gone, 5, plain, starter);
    insert.run('older', 1, 'Gone Person', null, 5, plain, starter);
    insert.run('kept', 1, 'Kept Person', kept, 5, plain, starter);

    await anonymisePlan(db.env, 'P', 'user_gone');

    const threads = Object.fromEntries((await listHomeThreads(db.env, 'P')).map((t) => [t.id, t]));
    const D = ANONYMISED_NAME;
    expect(threads.reacted!.comments[0]!.reactions!.map((r) => r.name)).toEqual([
      D,
      'Kept Person',
      'Gone Person',
    ]);
    expect(threads.reacted!.comments[0]!.reactions![0]).not.toHaveProperty('person', gone);
    expect(threads.resolved).toMatchObject({ resolvedBy: D, resolvedById: 'deleted' });
    expect(threads.older!.resolvedBy).toBe('Gone Person');
    expect(threads.kept).toMatchObject({ resolvedBy: 'Kept Person', resolvedById: kept });
    // Running it again changes nothing.
    expect(await anonymisePlan(db.env, 'P', 'user_gone')).toBe(0);
  });

  // The room stamps a canvas reaction's `person` (docs/specs/012-collaboration/comment-reactions.md), so a tab's own
  // comment threads are found by hashed id too.
  it('names a closed account Deleted account where it reacted on a canvas comment', async () => {
    const db = sqliteD1();
    db.sql.exec(`INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
                 VALUES ('P', 'user_kept', 'Plan', 0, 1, 1)`);
    const gone = await itemPersonId('user_gone');
    const kept = await itemPersonId('user_kept');
    const reactions = [
      { emoji: 'heart', by: 'k-gone', name: 'Gone Person', person: gone },
      { emoji: 'heart', by: 'k-kept', name: 'Kept Person', person: kept },
    ];
    const comment = { id: 'c1', authorName: 'Kept Person', text: 'hi', at: 1, reactions };
    const data = JSON.stringify({
      id: 't1',
      name: 'T',
      elements: [
        { id: 'e1', type: 'shape', commentThread: { resolved: false, comments: [comment] } },
      ],
    });
    db.sql
      .prepare(`INSERT INTO tabs (id, name, data, updated_at, rev) VALUES ('t1', 'T', ?, 1, 0)`)
      .run(data);
    db.sql.exec(
      `INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('P', 't1', 0, 1)`,
    );

    await anonymisePlan(db.env, 'P', 'user_gone');

    const row = db.sql.prepare(`SELECT data, rev FROM tabs WHERE id = 't1'`).get() as {
      data: string;
      rev: number;
    };
    const stored = JSON.parse(row.data).elements[0].commentThread.comments[0].reactions;
    expect(stored.map((r: { name: string }) => r.name)).toEqual([ANONYMISED_NAME, 'Kept Person']);
    expect(stored[0].person).not.toBe(gone);
    expect(row.rev).toBe(1);
    expect(await anonymisePlan(db.env, 'P', 'user_gone')).toBe(0);
  });

  it('walks a big tab once, and skips one that never names the person', () => {
    const elements = Array.from({ length: 2000 }, (_, i) => ({
      id: `e${i}`,
      commentThread: {
        comments: [
          {
            id: `c${i}`,
            reactions: [{ emoji: 'heart', by: 'k', name: 'N', person: i === 7 ? 'gone' : 'x' }],
          },
        ],
      },
    }));
    const text = JSON.stringify({ elements });
    let out = anonymiseTabReactions(text, 'gone');
    const cpu = cpuMsOf(() => {
      out = anonymiseTabReactions(text, 'gone');
    });
    expect(out.changed).toBe(true);
    expect(cpu).toBeLessThan(cpuBudgetMs(100));
    expect(anonymiseTabReactions(text, 'nobody')).toEqual({ value: text, changed: false });
    expect(anonymiseTabReactions('{not json gone', 'gone')).toEqual({
      value: '{not json gone',
      changed: false,
    });
  });

  it('leaves comments text it cannot read as reactions as it is', () => {
    for (const text of [
      '{not json h1',
      '{"h1": 1}',
      '[{"id": "c", "text": "h1"}]',
      '[null, "h1"]',
    ]) {
      expect(anonymiseReactions(text, 'h1')).toEqual({ value: text, changed: false });
    }
  });
});
