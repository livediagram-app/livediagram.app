// The tab save's one-query document read (db/tab-save-document.ts), against the real migrations: the fields the
// save uses (the writer's name and colour come from liveworkspace, read by the save itself), the tab count, and an
// unknown document reading as missing. The Trash is the index's (liveworkspace/docs/specs/004-index/one-explorer.md).
import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { getDocument } from './documents';
import { getDocumentForSave } from './tab-save-document';

function setUp() {
  const db = sqliteD1();
  db.sql.exec(`
    INSERT INTO test_documents (id, owner_id, name, saved_at, created_at, team_id)
      VALUES ('d1', 'owner', 'Plan', 5, 3, NULL);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'One', '{"elements":[]}', 1), ('t2', 'Two', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1), ('d1', 't2', 1, 1);
  `);
  return db;
}

describe('getDocumentForSave', () => {
  it('answers what the save uses, matching the full read', async () => {
    const { env } = setUp();
    const saving = await getDocumentForSave(env, 'd1');
    const full = await getDocument(env, 'd1');
    expect(saving).toEqual({
      id: 'd1',
      ownerId: 'owner',
      teamId: null,
      name: 'Plan',
      createdAt: 3,
      tabCount: 2,
    });
    expect(saving).toMatchObject({
      ownerId: full!.ownerId,
      createdAt: full!.createdAt,
      tabCount: full!.tabs.length,
    });
  });

  it('reads an unknown document as missing', async () => {
    const { env } = setUp();
    expect(await getDocumentForSave(env, 'nope')).toBeNull();
  });
});
