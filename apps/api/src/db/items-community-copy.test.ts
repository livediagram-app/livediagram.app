import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { insert, liveDoc } from './test-trash-fixtures';
import { copyItemsStatements } from './items';

// A Community copy (docs/specs/025-community/community.md) takes the work, never the
// people on it: the copier must not learn who was assigned, who voted, or who wrote it.
describe('copyItemsStatements', () => {
  const ALI = JSON.stringify({ id: 'p-ali', name: 'Ali', color: '#ff0000' });

  function seeded() {
    const db = sqliteD1();
    liveDoc(db.sql, 'src');
    liveDoc(db.sql, 'dst');
    insert(db.sql, 'items', {
      document_id: 'src',
      id: 'i1',
      type: 'task',
      item_key: 1,
      rank: 'a',
      fields: JSON.stringify({
        title: 'Ship',
        status: 'todo',
        assignee: JSON.parse(ALI),
        votes: { 'p-ali': 2 },
        comments: { comments: [{ id: 'c1', author: 'Ali', text: 'Hi', createdAt: 1 }] },
      }),
      rev: 1,
      created_at: 1,
      updated_at: 2,
      created_by: ALI,
      updated_by: ALI,
    });
    return db;
  }

  const copied = (db: ReturnType<typeof sqliteD1>) =>
    db.sql
      .prepare("SELECT fields, created_by, updated_by FROM items WHERE document_id = 'dst'")
      .get() as {
      fields: string;
      created_by: string;
      updated_by: string;
    };

  it('drops the assignee, votes and comments and neutralises the authors on a Community copy', async () => {
    const db = seeded();
    await db.env.DB.batch(copyItemsStatements(db.env, 'src', 'dst', null, true));
    const row = copied(db);
    expect(JSON.parse(row.fields)).toEqual({ title: 'Ship', status: 'todo' });
    expect(row.created_by).not.toContain('Ali');
    expect(JSON.parse(row.updated_by)).toMatchObject({ id: '', name: 'Someone' });
  });

  it('copies everything as is for an ordinary copy', async () => {
    const db = seeded();
    await db.env.DB.batch(copyItemsStatements(db.env, 'src', 'dst', ['i1']));
    const row = copied(db);
    expect(JSON.parse(row.fields).assignee.name).toBe('Ali');
    expect(JSON.parse(row.fields).comments.comments).toHaveLength(1);
    expect(row.created_by).toBe(ALI);
  });
});
