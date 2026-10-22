import { describe, expect, it } from 'vitest';
import { TAG_LIMIT } from '@livepages/api-schema';
import { sqliteD1 } from '../test-sqlite-d1';
import { migrateOwnerId } from './account';
import {
  addDocumentTag,
  createTag,
  deleteTag,
  listTags,
  removeDocumentTag,
  updateTag,
} from './tags';

// docs/specs/013-workspace/tags.md "Storage" and "API", against a real SQLite schema: the unique name index, the
// limit counted in the insert, the owner check riding in each write, and both cascades.

function arrange() {
  const db = sqliteD1();
  for (const [id, owner] of [
    ['d1', 'o'],
    ['d2', 'o'],
    ['peer', 'p'],
  ] as const) {
    db.sql
      .prepare(
        'INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, 1, 1)',
      )
      .run(id, owner, id);
  }
  return db;
}

const make = (env: ReturnType<typeof arrange>['env'], owner: string, id: string, name: string) =>
  createTag(env, owner, { id, name, colour: 'blue' });

describe('createTag', () => {
  it('makes a tag the owner then lists', async () => {
    const { env } = arrange();
    const made = await make(env, 'o', 't1', 'Design');
    expect(made).toEqual({
      ok: true,
      value: expect.objectContaining({ id: 't1', name: 'Design' }),
    });
    expect((await listTags(env, 'o')).tags.map((t) => t.name)).toEqual(['Design']);
    expect((await listTags(env, 'p')).tags).toEqual([]);
  });

  it('refuses a name the owner already uses, in any case', async () => {
    const { env } = arrange();
    await make(env, 'o', 't1', 'Design');
    expect(await make(env, 'o', 't2', 'DESIGN')).toEqual({ ok: false, reason: 'name-taken' });
  });

  it('lets two people use the same name', async () => {
    const { env } = arrange();
    await make(env, 'o', 't1', 'Design');
    expect((await make(env, 'p', 't2', 'Design')).ok).toBe(true);
  });

  it('refuses past the limit, counted in the insert itself', async () => {
    const { env, sql } = arrange();
    const insert = sql.prepare(
      "INSERT INTO tags (id, owner_id, name, colour, created_at, updated_at) VALUES (?, 'o', ?, 'blue', 1, 1)",
    );
    for (let i = 0; i < TAG_LIMIT; i++) insert.run(`t${i}`, `Tag ${i}`);
    expect(await make(env, 'o', 'one-more', 'One more')).toEqual({ ok: false, reason: 'limit' });
    expect((await make(env, 'p', 'theirs', 'Theirs')).ok).toBe(true);
  });

  it('lists alphabetically, ignoring case', async () => {
    const { env } = arrange();
    await make(env, 'o', 't1', 'beta');
    await make(env, 'o', 't2', 'Alpha');
    expect((await listTags(env, 'o')).tags.map((t) => t.name)).toEqual(['Alpha', 'beta']);
  });
});

describe('updateTag', () => {
  it('renames and recolours, keeping what is not sent', async () => {
    const { env } = arrange();
    await make(env, 'o', 't1', 'Design');
    const renamed = await updateTag(env, 'o', 't1', { name: 'UX' });
    expect(renamed).toEqual({
      ok: true,
      value: expect.objectContaining({ name: 'UX', colour: 'blue' }),
    });
    const recoloured = await updateTag(env, 'o', 't1', { colour: '#123456' });
    expect(recoloured).toEqual({
      ok: true,
      value: expect.objectContaining({ name: 'UX', colour: '#123456' }),
    });
  });

  it("refuses someone else's tag and a taken name", async () => {
    const { env } = arrange();
    await make(env, 'o', 't1', 'Design');
    await make(env, 'o', 't2', 'Research');
    expect(await updateTag(env, 'p', 't1', { name: 'Mine' })).toEqual({
      ok: false,
      reason: 'not-found',
    });
    expect(await updateTag(env, 'o', 't2', { name: 'design' })).toEqual({
      ok: false,
      reason: 'name-taken',
    });
  });
});

describe('document tags', () => {
  it('puts a tag on a document idempotently and takes it off', async () => {
    const { env } = arrange();
    await make(env, 'o', 't1', 'Design');
    expect(await addDocumentTag(env, 'o', 't1', 'd1')).toBe(true);
    expect(await addDocumentTag(env, 'o', 't1', 'd1')).toBe(true);
    expect((await listTags(env, 'o')).links).toEqual([{ tagId: 't1', documentId: 'd1' }]);
    expect(await removeDocumentTag(env, 'o', 't1', 'd1')).toBe(true);
    expect(await removeDocumentTag(env, 'o', 't1', 'd1')).toBe(true);
    expect((await listTags(env, 'o')).links).toEqual([]);
  });

  it("refuses a tag that is not the caller's, changing nothing", async () => {
    const { env } = arrange();
    await make(env, 'o', 't1', 'Design');
    await addDocumentTag(env, 'o', 't1', 'd1');
    expect(await addDocumentTag(env, 'p', 't1', 'peer')).toBe(false);
    expect(await removeDocumentTag(env, 'p', 't1', 'd1')).toBe(false);
    expect((await listTags(env, 'o')).links).toEqual([{ tagId: 't1', documentId: 'd1' }]);
  });

  it('answers false for a document that does not exist', async () => {
    const { env } = arrange();
    await make(env, 'o', 't1', 'Design');
    expect(await addDocumentTag(env, 'o', 't1', 'gone')).toBe(false);
  });

  it("tags anyone's document: the link is the tagger's own row", async () => {
    const { env } = arrange();
    await make(env, 'o', 't1', 'Design');
    expect(await addDocumentTag(env, 'o', 't1', 'peer')).toBe(true);
  });

  it('leaves a document in the Trash out of the list, keeping the link for a restore', async () => {
    const { env, sql } = arrange();
    await make(env, 'o', 't1', 'Design');
    await addDocumentTag(env, 'o', 't1', 'd1');
    sql.prepare("UPDATE documents SET trashed_at = 5 WHERE id = 'd1'").run();
    expect((await listTags(env, 'o')).links).toEqual([]);
    sql.prepare("UPDATE documents SET trashed_at = NULL WHERE id = 'd1'").run();
    expect((await listTags(env, 'o')).links).toEqual([{ tagId: 't1', documentId: 'd1' }]);
  });

  it('cascades: deleting the tag or the document drops the link', async () => {
    const { env, sql } = arrange();
    await make(env, 'o', 't1', 'Design');
    await make(env, 'o', 't2', 'Research');
    await addDocumentTag(env, 'o', 't1', 'd1');
    await addDocumentTag(env, 'o', 't2', 'd2');
    expect(await deleteTag(env, 'p', 't1')).toBe(false);
    expect(await deleteTag(env, 'o', 't1')).toBe(true);
    sql.prepare("DELETE FROM documents WHERE id = 'd2'").run();
    const left = sql.prepare('SELECT COUNT(*) AS n FROM document_tags').get() as { n: number };
    expect(left.n).toBe(0);
  });
});

describe('signing up carries tags across', () => {
  it('moves guest tags and merges one whose name the account uses', async () => {
    const { env } = arrange();
    await make(env, 'guest', 'g-design', 'design');
    await make(env, 'guest', 'g-only', 'Guest only');
    await make(env, 'o', 'a-design', 'Design');
    await addDocumentTag(env, 'guest', 'g-design', 'd1');
    await addDocumentTag(env, 'guest', 'g-only', 'd2');
    await addDocumentTag(env, 'o', 'a-design', 'd2');

    await migrateOwnerId(env, 'guest', 'o');

    const after = await listTags(env, 'o');
    expect(after.tags.map((t) => t.id)).toEqual(['a-design', 'g-only']);
    expect(after.links).toEqual(
      expect.arrayContaining([
        { tagId: 'a-design', documentId: 'd1' },
        { tagId: 'a-design', documentId: 'd2' },
        { tagId: 'g-only', documentId: 'd2' },
      ]),
    );
    expect(after.links).toHaveLength(3);
    expect((await listTags(env, 'guest')).tags).toEqual([]);
  });
});

// "Performance and limits": every tag statement seeks an index, so a person's list, a document delete's cascade and an
// account's tags never read the whole table.
describe('tag statements seek an index', () => {
  const { sql } = sqliteD1();
  it.each([
    'SELECT id, name, colour, created_at FROM tags WHERE owner_id = ?1 ORDER BY name COLLATE NOCASE',
    `SELECT dt.tag_id, dt.document_id FROM tags t JOIN document_tags dt ON dt.tag_id = t.id WHERE t.owner_id = ?1
       AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = dt.document_id AND d.trashed_at IS NOT NULL)`,
    'DELETE FROM document_tags WHERE document_id = ?',
    'DELETE FROM document_tags WHERE tag_id = ?',
    'DELETE FROM tags WHERE owner_id = ?',
  ])('%s', (statement) => {
    const binds = (statement.match(/\?/g) ?? []).map(() => 'x');
    const plan = sql
      .prepare(`EXPLAIN QUERY PLAN ${statement}`)
      .all(...binds)
      .map((row) => String(row['detail']));
    expect(plan.filter((detail) => /^SCAN /.test(detail))).toEqual([]);
  });
});
