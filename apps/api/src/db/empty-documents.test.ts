// Which listed documents are empty (docs/specs/006-document/document-snapshots.md, "An empty document
// is never asked for"), against the real migrations: the lists read the first tab's element count, which
// every tab write binds from the tab it already holds, so an Explorer of blank documents requests no thumbnail.

import type { Tab } from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import { migrateFrom, sqliteD1 } from '../test-sqlite-d1';
import { copyDocument, listDocumentsByOwner, listDocumentsByTeam } from './documents';
import { listSharedWith } from './shared';
import { seedTabs, stampTabElementCount, swapTabData, upsertTab } from './tabs';
import { tabStatsOfData } from './tab-stats';

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
    expect(
      await swapTabData(
        env,
        'doc',
        't1',
        data,
        JSON.stringify({ elements: [] }),
        tabStatsOfData('{"elements":[]}').stats,
      ),
    ).toBe(true);
    expect((await emptiness(env)).doc).toBe(true);
  });

  it('carries the count onto a copy', async () => {
    const { env, addDocument } = setUp();
    addDocument('source');
    await seedTabs(env, 'source', [tab('t-src', [rect('a')])]);
    await copyDocument(env, 'source', 'copy', OWNER, 'copy');
    expect((await emptiness(env)).copy).toBe(false);
  });

  it('keeps the count in the write itself: no trigger re-parses the body', () => {
    const { sql } = setUp();
    // The one trigger on tabs is the revision guard (docs/specs/024-agents/agent-changesets.md,
    // CS3), which compares two integers and never reads the body.
    const triggers = sql
      .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'tabs'")
      .all();
    expect(triggers.map((t) => t.name)).toEqual(['tabs_rev_advances']);
    for (const t of triggers) expect(String(t.sql)).not.toMatch(/json|\bdata\b\s*[,)=]/i);
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

describe('migration 0059 adds the count without reading a body', () => {
  it('leaves every stored tab unknown, which reads as not empty until it is stamped', async () => {
    const { env, sql } = sqliteD1({}, { before: '0059' });
    sql.exec(`INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
              VALUES ('old-blank', '${OWNER}', 'a', 0, 1, 1), ('old-drawn', '${OWNER}', 'b', 0, 1, 1),
                     ('old-odd', '${OWNER}', 'c', 0, 1, 1)`);
    sql.exec(`INSERT INTO tabs (id, name, data, updated_at)
              VALUES ('ob', 'x', '{"elements":[]}', 1), ('od', 'x', '{"elements":[{"id":"a"},{"id":"b"}]}', 1),
                     ('oo', 'x', 'not json', 1)`);
    sql.exec(`INSERT INTO document_tabs (document_id, tab_id, order_index, added_at)
              VALUES ('old-blank', 'ob', 0, 1), ('old-drawn', 'od', 0, 1), ('old-odd', 'oo', 0, 1)`);
    // 0059 and every migration after it: the list projection below reads today's schema.
    migrateFrom(sql, '0059');
    const counts = sql.prepare('SELECT id, element_count FROM tabs ORDER BY id').all();
    expect(counts.map((c) => ({ ...c }))).toEqual([
      { id: 'ob', element_count: null },
      { id: 'od', element_count: null },
      { id: 'oo', element_count: null },
    ]);
    expect(await emptiness(env)).toEqual({
      'old-blank': false,
      'old-drawn': false,
      'old-odd': false,
    });
    // The thumbnail route, having parsed the first tab, stamps what it found.
    await stampTabElementCount(env, 'ob', 0);
    expect((await emptiness(env))['old-blank']).toBe(true);
  });
});

describe('stampTabElementCount', () => {
  it('fills an unknown count, and never overwrites a known one', async () => {
    const { env, addDocument, sql } = setUp();
    addDocument('doc');
    await seedTabs(env, 'doc', [tab('t1', [rect('a')])]);
    await stampTabElementCount(env, 't1', 0);
    expect(sql.prepare("SELECT element_count c FROM tabs WHERE id = 't1'").get()).toEqual({ c: 1 });
  });
});
