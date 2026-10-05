import { describe, expect, it } from 'vitest';
import type { ElementOp, Tab } from '@livediagram/document';
import { CHANGESET_MERGE_PAGE } from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import {
  changesetMergePages,
  deleteOldChangesets,
  getChangeset,
  getChangesetPart,
  insertChangesetPartStatement,
  insertChangesetStatement,
  lastChangesetRev,
  listChangesets,
  type ChangesetRecord,
} from './changesets';
import { tabWriteStatements, upsertTab } from './tabs';

// The changeset store (docs/specs/024-agents/blueprints/agent-changesets.md "Data and
// persistence"), on real SQLite with every migration.

const tab: Tab = { id: 't1', name: 'Board', elements: [] };

async function documentWithTab(): Promise<SqliteD1> {
  const db = sqliteD1();
  db.sql.exec(`INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
               VALUES ('D', 'o', 'Doc', 0, 1, 1)`);
  await upsertTab(db.env, 'D', tab, 0);
  return db;
}

function record(over: Partial<ChangesetRecord> = {}): ChangesetRecord {
  return {
    id: 'cs_0000000001',
    documentId: 'D',
    tabId: 't1',
    rev: 2,
    baseRev: 1,
    authorId: 'user_o',
    authorName: 'Webber',
    authorColor: '#0ea5e9',
    tokenId: 'tok_1',
    summary: 'add payment service',
    fingerprints: { before: {}, after: { b: 'ffffffffffffffff' } },
    counts: { added: 1, changed: 0, removed: 0 },
    createdTab: false,
    revertOf: null,
    createdAt: 1000,
    ...over,
  };
}

const ops: ElementOp[] = [
  {
    kind: 'add',
    element: { id: 'b', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 },
    at: 0,
  },
];

async function store(db: SqliteD1, r: ChangesetRecord): Promise<void> {
  await db.env.DB.batch([
    insertChangesetStatement(db.env, r),
    insertChangesetPartStatement(db.env, r.id, 'ops', JSON.stringify(ops)),
    insertChangesetPartStatement(db.env, r.id, 'inverse', '[]'),
    insertChangesetPartStatement(db.env, r.id, 'results', '{"results":[],"text":""}'),
  ]);
}

describe('changeset records', () => {
  it('round-trips a record and its parts', async () => {
    const db = await documentWithTab();
    await store(db, record());
    expect(await getChangeset(db.env, 'D', 'cs_0000000001')).toEqual(record());
    expect(await getChangesetPart(db.env, 'cs_0000000001', 'ops')).toBe(JSON.stringify(ops));
    expect(await getChangeset(db.env, 'other', 'cs_0000000001')).toBeNull();
  });

  it('holds one changeset per tab revision', async () => {
    const db = await documentWithTab();
    await store(db, record());
    await expect(store(db, record({ id: 'cs_0000000002' }))).rejects.toThrow();
  });

  it('never lands without its tab write: a stale tab write aborts the record with it', async () => {
    const db = await documentWithTab();
    await expect(
      db.env.DB.batch([
        ...tabWriteStatements(db.env, 'D', tab, 0, { expected: 0 }),
        insertChangesetStatement(db.env, record()),
      ]),
    ).rejects.toThrow('tab_rev_stale');
    expect(await getChangeset(db.env, 'D', 'cs_0000000001')).toBeNull();
  });

  it("answers the tab's last changeset revision", async () => {
    const db = await documentWithTab();
    expect(await lastChangesetRev(db.env, 't1')).toBeNull();
    await store(db, record({ rev: 2 }));
    await store(db, record({ id: 'cs_0000000002', rev: 5 }));
    expect(await lastChangesetRev(db.env, 't1')).toBe(5);
  });

  it('lists newest first, by tab, within a limit', async () => {
    const db = await documentWithTab();
    await store(db, record({ rev: 2, createdAt: 1 }));
    await store(db, record({ id: 'cs_0000000002', rev: 3, createdAt: 2 }));
    const all = await listChangesets(db.env, 'D', { limit: 20 });
    expect(all.map((r) => r.id)).toEqual(['cs_0000000002', 'cs_0000000001']);
    expect(await listChangesets(db.env, 'D', { limit: 1 })).toHaveLength(1);
    expect(await listChangesets(db.env, 'D', { limit: 20, tabId: 'nope' })).toEqual([]);
  });
});

describe('the merge read', () => {
  it('pages the records after a seen revision in revision order, each with its ops', async () => {
    const db = await documentWithTab();
    const total = CHANGESET_MERGE_PAGE + 3;
    for (let i = 0; i < total; i += 1) {
      await store(db, record({ id: `cs_${String(i).padStart(10, '0')}`, rev: i + 2 }));
    }
    const pages = [];
    for await (const page of changesetMergePages(db.env, 't1', { afterRev: 4 })) pages.push(page);
    const revs = pages.flat().map((p) => p.record.rev);
    expect(revs[0]).toBe(5);
    expect(revs).toHaveLength(total - 3);
    expect(pages[0]).toHaveLength(CHANGESET_MERGE_PAGE);
    expect(pages[0]![0]!.ops).toEqual(ops);
  });

  it('reads by age when the save carried no seen revision', async () => {
    const db = await documentWithTab();
    await store(db, record({ rev: 2, createdAt: 100 }));
    await store(db, record({ id: 'cs_0000000002', rev: 3, createdAt: 900 }));
    const pages = [];
    for await (const page of changesetMergePages(db.env, 't1', { since: 500 })) pages.push(page);
    expect(pages.flat().map((p) => p.record.rev)).toEqual([3]);
  });
});

describe('the sweep', () => {
  it('deletes records older than the cutoff, their parts by cascade', async () => {
    const db = await documentWithTab();
    await store(db, record({ createdAt: 10 }));
    await store(db, record({ id: 'cs_0000000002', rev: 3, createdAt: 99 }));
    expect(await deleteOldChangesets(db.env, 50)).toBe(1);
    expect(await getChangeset(db.env, 'D', 'cs_0000000001')).toBeNull();
    const parts = db.sql
      .prepare(
        "SELECT COUNT(*) AS n FROM agent_changeset_parts WHERE changeset_id = 'cs_0000000001'",
      )
      .get()!;
    expect(parts.n).toBe(0);
  });

  it('goes with its document', async () => {
    const db = await documentWithTab();
    await store(db, record());
    db.sql.exec("DELETE FROM documents WHERE id = 'D'");
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM agent_changesets').get()!.n).toBe(0);
  });
});
