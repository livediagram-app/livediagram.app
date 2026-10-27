import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { migratePlanSchema, PLAN_SCHEMA_VERSION } from './plan-schema';

// The move of each card's old single thread into its first thread (card-thread-schema.ts; docs/specs/026-plan/
// items.md "Existing comments"): a plan at version 6 gains the thread tables, every card with comments a thread
// keeping its resolved state, and a card that lands later in the old shape is taken the same way.

const comment = (id: string, at: number, over: Record<string, unknown> = {}) => ({
  id,
  text: `Comment ${id}`,
  createdAt: at,
  authorName: 'Ada',
  authorColor: '#2563eb',
  authorId: 'owner-ada',
  ...over,
});

function planAtVersion6() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  const exec = nodeItemSql(sql);
  migratePlanSchema((q) => exec.exec(q));
  sql.exec(`
    DROP TRIGGER items_legacy_thread; DROP TRIGGER items_threads_gone;
    DROP TABLE card_thread_links; DROP TABLE card_threads;
    UPDATE _plan_schema SET version = 6;
    INSERT INTO plan (id, owner_id, name, saved_at, created_at) VALUES ('p1', 'owner-ada', 'Plan', 1, 1);
  `);
  const insert = sql.prepare(
    `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
     VALUES ('p1', ?, 'task', ?, 'a', ?, 1, 1, 50, '{}', '{}')`,
  );
  insert.run(
    'open',
    1,
    JSON.stringify({
      title: 'Open one',
      comments: { comments: [comment('a', 10), comment('b', 20)], resolved: false },
    }),
  );
  insert.run(
    'done',
    2,
    JSON.stringify({
      title: 'Resolved one',
      comments: {
        comments: [comment('c', 30, { authorId: undefined, authorName: 'Bo' })],
        resolved: true,
      },
    }),
  );
  insert.run(
    'empty',
    3,
    JSON.stringify({ title: 'Empty', comments: { comments: [], resolved: false } }),
  );
  insert.run('none', 4, JSON.stringify({ title: 'None' }));
  return { sql, exec };
}

type Row = Record<string, unknown>;

describe('the old single thread', () => {
  it('becomes each card’s first thread as the plan reaches version 7', () => {
    const { sql, exec } = planAtVersion6();
    migratePlanSchema((q) => exec.exec(q));
    expect(sql.prepare('SELECT version FROM _plan_schema').get()!.version).toBe(
      PLAN_SCHEMA_VERSION,
    );

    const threads = sql.prepare('SELECT * FROM card_threads ORDER BY id').all() as Row[];
    expect(threads.map((t) => t.id)).toEqual(['c-done', 'c-open']);
    const [done, open] = threads;
    expect(open).toMatchObject({
      plan_id: 'p1',
      title: '',
      resolved: 0,
      resolved_at: null,
      created_at: 10,
      updated_at: 20,
      rev: 1,
    });
    expect((JSON.parse(String(open!.comments)) as Row[]).map((c) => c.id)).toEqual(['a', 'b']);
    expect(JSON.parse(String(open!.created_by))).toEqual({
      name: 'Ada',
      color: '#2563eb',
      authorId: 'owner-ada',
    });
    expect(JSON.parse(String(open!.cards))).toEqual([{ projectId: 'p1', itemId: 'open', key: 1 }]);
    expect(done).toMatchObject({ resolved: 1, resolved_at: 30 });
    expect(JSON.parse(String(done!.created_by))).toEqual({
      name: 'Bo',
      color: '#2563eb',
      authorId: null,
    });

    const links = sql.prepare('SELECT * FROM card_thread_links ORDER BY item_id').all() as Row[];
    expect(links.map((l) => [l.item_id, l.thread_id, l.home, l.open_comments])).toEqual([
      ['done', 'c-done', 'p1', 0],
      ['open', 'c-open', 'p1', 2],
    ]);
    // Every card's old field goes, the empty one's too.
    const fields = sql.prepare('SELECT id, fields FROM items ORDER BY id').all() as Row[];
    expect(fields.every((f) => !('comments' in JSON.parse(String(f.fields))))).toBe(true);
    // The Inbox hears the new threads.
    expect(sql.prepare(`SELECT key FROM outbox WHERE key = '~cards'`).all()).toHaveLength(1);
  });

  it('takes a card that lands later in the old shape, and a card’s delete takes its links', () => {
    const { sql, exec } = planAtVersion6();
    migratePlanSchema((q) => exec.exec(q));
    sql
      .prepare(
        `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
         VALUES ('p1', 'late', 'task', 9, 'b', ?, 1, 1, 70, '{}', '{}')`,
      )
      .run(
        JSON.stringify({
          title: 'Late',
          comments: { comments: [comment('z', 60)], resolved: false },
        }),
      );
    const late = sql.prepare(`SELECT id, cards FROM card_threads WHERE id = 'c-late'`).get() as Row;
    expect(JSON.parse(String(late.cards))).toEqual([{ projectId: 'p1', itemId: 'late', key: 9 }]);
    const item = sql.prepare(`SELECT fields FROM items WHERE id = 'late'`).get() as Row;
    expect(JSON.parse(String(item.fields))).toEqual({ title: 'Late' });

    sql.exec(`DELETE FROM items WHERE id = 'late'`);
    expect(sql.prepare(`SELECT * FROM card_thread_links WHERE item_id = 'late'`).all()).toEqual([]);
  });

  it('runs again harmlessly', () => {
    const { exec } = planAtVersion6();
    migratePlanSchema((q) => exec.exec(q));
    expect(() => migratePlanSchema((q) => exec.exec(q))).not.toThrow();
  });
});
