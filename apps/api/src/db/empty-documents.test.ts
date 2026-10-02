// Which listed documents are empty (docs/specs/006-document/document-snapshots.md, "An empty document
// is never asked for"), against the real migrations: the lists read the first tab's element count, kept
// by the tabs triggers on every write, so an Explorer of blank documents requests no thumbnail.

import type { Tab } from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import { applyMigration, sqliteD1 } from '../test-sqlite-d1';
import { listDocumentsByOwner, listDocumentsByTeam } from './documents';
import { listSharedWith } from './shared';
import { seedTabs, swapTabData, upsertTab } from './tabs';

const OWNER = 'owner-1';
const VISITOR = 'visitor-1';

const rect = (id: string) =>
  ({ id, kind: 'shape', shape: 'rectangle', x: 0, y: 0, width: 10, height: 10 }) as never;
const tab = (id: string, elements: unknown[]): Tab =>
  ({ id, name: id, elements }) as unknown as Tab;

function setUp() {
  const db = sqliteD1();
  const addDocument = (id: string, over: { teamId?: string; shareable?: boolean } = {}) =>
    db.sql
      .prepare(
        'INSERT INTO documents (id, owner_id, name, shareable, team_id, saved_at, created_at) VALUES (?, ?, ?, ?, ?, 1, 1)',
      )
      .run(id, OWNER, id, over.shareable ? 1 : 0, over.teamId ?? null);
  return { ...db, addDocument };
}

async function emptiness(env: ReturnType<typeof sqliteD1>['env']) {
  const list = await listDocumentsByOwner(env, OWNER);
  return Object.fromEntries(list.map((d) => [d.id, d.empty]));
}

describe('a document list says which documents are empty', () => {
  it('reads the first tab: no elements or no tab is empty, any element is not', async () => {
    const { env, addDocument } = setUp();
    addDocument('blank');
    addDocument('drawn');
    addDocument('tabless');
    addDocument('second-tab-only');
    await seedTabs(env, 'blank', [tab('t-blank', [])]);
    await seedTabs(env, 'drawn', [tab('t-drawn', [rect('a')])]);
    await seedTabs(env, 'second-tab-only', [tab('t-first', []), tab('t-second', [rect('b')])]);
    expect(await emptiness(env)).toEqual({
      blank: true,
      drawn: false,
      tabless: true,
      'second-tab-only': true,
    });
  });

  it('follows every write: an autosave that draws, and a swap that clears', async () => {
    const { env, addDocument, sql } = setUp();
    addDocument('doc');
    await upsertTab(env, 'doc', tab('t1', []), 0);
    expect((await emptiness(env)).doc).toBe(true);
    await upsertTab(env, 'doc', tab('t1', [rect('a')]), 0);
    expect((await emptiness(env)).doc).toBe(false);
    const { data } = sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get() as { data: string };
    expect(await swapTabData(env, 'doc', 't1', data, JSON.stringify({ elements: [] }))).toBe(true);
    expect((await emptiness(env)).doc).toBe(true);
  });

  it('reads a tab body it cannot count as not empty, so its row still asks', async () => {
    const { env, addDocument, sql } = setUp();
    addDocument('odd');
    await seedTabs(env, 'odd', [tab('t-odd', [])]);
    sql.exec("UPDATE tabs SET data = 'not json' WHERE id = 't-odd'");
    expect((await emptiness(env)).odd).toBe(false);
  });

  it('says the same on the team library', async () => {
    const { env, addDocument, sql } = setUp();
    sql.exec(
      "INSERT INTO teams (id, name, organisation, created_at, updated_at) VALUES ('team-1', 'Crew', NULL, 1, 1)",
    );
    addDocument('team-blank', { teamId: 'team-1' });
    addDocument('team-drawn', { teamId: 'team-1' });
    await seedTabs(env, 'team-blank', [tab('t-tb', [])]);
    await seedTabs(env, 'team-drawn', [tab('t-td', [rect('a')])]);
    const list = await listDocumentsByTeam(env, 'team-1');
    expect(Object.fromEntries(list.map((d) => [d.id, d.empty]))).toEqual({
      'team-blank': true,
      'team-drawn': false,
    });
  });

  it('reads a tab-scoped share by its own tab, and an all-tabs share by the first', async () => {
    const { env, addDocument, sql } = setUp();
    addDocument('whole', { shareable: true });
    addDocument('scoped', { shareable: true });
    await seedTabs(env, 'whole', [tab('w1', []), tab('w2', [rect('a')])]);
    await seedTabs(env, 'scoped', [tab('s1', []), tab('s2', [rect('b')])]);
    sql.exec(`INSERT INTO share_links (code, document_id, role, tab_id, created_at)
              VALUES ('code-w', 'whole', 'view', NULL, 1), ('code-s', 'scoped', 'view', 's2', 1)`);
    sql.exec(`INSERT INTO shared_with (owner_id, document_id, role, tab_id, last_seen)
              VALUES ('${VISITOR}', 'whole', 'view', NULL, 2), ('${VISITOR}', 'scoped', 'view', 's2', 1)`);
    const list = await listSharedWith(env, VISITOR);
    expect(Object.fromEntries(list.map((d) => [d.id, d.empty]))).toEqual({
      whole: true,
      scoped: false,
    });
  });
});

describe('migration 0059 backfills the element counts', () => {
  it('counts every tab already stored, and leaves an uncountable one unknown', async () => {
    const { env, sql } = sqliteD1({}, { before: '0059' });
    sql.exec(`INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
              VALUES ('old-blank', '${OWNER}', 'a', 0, 1, 1), ('old-drawn', '${OWNER}', 'b', 0, 1, 1),
                     ('old-odd', '${OWNER}', 'c', 0, 1, 1)`);
    sql.exec(`INSERT INTO tabs (id, name, data, updated_at)
              VALUES ('ob', 'x', '{"elements":[]}', 1), ('od', 'x', '{"elements":[{"id":"a"},{"id":"b"}]}', 1),
                     ('oo', 'x', 'not json', 1)`);
    sql.exec(`INSERT INTO document_tabs (document_id, tab_id, order_index, added_at)
              VALUES ('old-blank', 'ob', 0, 1), ('old-drawn', 'od', 0, 1), ('old-odd', 'oo', 0, 1)`);
    applyMigration(sql, '0059');
    const counts = sql.prepare('SELECT id, element_count FROM tabs ORDER BY id').all();
    expect(counts).toEqual([
      { id: 'ob', element_count: 0 },
      { id: 'od', element_count: 2 },
      { id: 'oo', element_count: null },
    ]);
    expect(await emptiness(env)).toEqual({
      'old-blank': true,
      'old-drawn': false,
      'old-odd': false,
    });
  });
});
