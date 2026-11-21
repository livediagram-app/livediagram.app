import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { VERSION_IDLE_MS } from '@liveknowledge/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { DOCUMENT_SCHEMA_VERSION, migrateDocumentSchema } from '../document-room/document-schema';
import { listVersions, saveVersionStampStatement } from '../db/versions';
import { knowledgeKit, OWNER, page } from '../routes/knowledge-test-kit';
import { setTestProfile, clearTestProfiles } from '../test-profiles';

// Each Save keeps a version, and no version keeps a draft (docs/specs/006-document/version-history.md "When a version
// is kept"; blueprint VH1a, VH1b), on real SQLite: the save trigger, the idle trigger passing over a draft, the
// rebuild of a room made before step 34, and the tab PUT naming the person who saved.

vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});
vi.mock('../person/profiles', () => import('../test-profiles'));

afterEach(() => {
  clearTestProfiles();
  vi.restoreAllMocks();
});

const flow = (text: string) => ({
  blocks: [
    { id: 'title', type: 'paragraph', style: 'title', runs: [{ text: 'Deploys' }] },
    { id: 'p', type: 'paragraph', runs: [{ text }] },
  ],
});

// A page's stored body: its saved writing, and a draft beside it when `draft` is given.
const body = (saved: string, draft?: string, by = 'Priya') =>
  JSON.stringify({
    elements: [],
    pages: [{ id: 'page-1', kind: 'article', flow: 'art-1' }],
    articles: { 'art-1': flow(saved), ...(draft !== undefined ? { draft: flow(draft) } : {}) },
    ...(draft !== undefined ? { draft: { by, at: 1, base: {} } } : {}),
  });

function setUp(): SqliteD1 {
  const db = sqliteD1();
  db.sql
    .prepare(
      "INSERT INTO document (id, saved_at, created_at, name, owner_id) VALUES ('D', 0, 1, 'KB', 'o')",
    )
    .run();
  db.sql
    .prepare(
      "INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES ('t1', 'Deploys', ?, 1000, 0, 1)",
    )
    .run(body('first'));
  return db;
}

// A write as every tab write lands: the body, the time, the revision one on.
function write(db: SqliteD1, data: string, at: number) {
  db.sql
    .prepare("UPDATE tabs SET data = ?, updated_at = ?, rev = rev + 1 WHERE id = 't1'")
    .run(data, at);
}

type Row = {
  rev: number;
  kind: string;
  data: string;
  author_name: string | null;
  saved_at: number;
};
const rows = (db: SqliteD1) =>
  db.sql
    .prepare('SELECT rev, kind, data, author_name, saved_at FROM tab_versions ORDER BY rowid')
    .all() as Row[];

describe('the save trigger', () => {
  it("keeps nothing for a draft's keystrokes, and the page as saved on Save, naming the draft's writer", () => {
    const db = setUp();
    write(db, body('first', 'f'), 1100);
    write(db, body('first', 'fresh words'), 1200);
    expect(rows(db)).toEqual([]);
    write(db, body('fresh words'), 1300);
    expect(rows(db)).toEqual([
      { rev: 4, kind: 'save', data: body('fresh words'), author_name: 'Priya', saved_at: 1300 },
    ]);
  });

  it('keeps nothing for a Discard, and nothing when the body did not change', () => {
    const db = setUp();
    write(db, body('first', 'thrown away'), 1100);
    write(db, body('first'), 1200);
    write(db, body('first'), 1300);
    expect(rows(db)).toEqual([]);
  });

  it('keeps a Save whose draft never reached the server, naming nobody, and one per revision', () => {
    const db = setUp();
    // Mod-S inside the autosave's wait: the draft was never stored, the saved writing changed.
    write(db, body('typed fast'), 1100);
    expect(rows(db)).toEqual([
      expect.objectContaining({ rev: 2, kind: 'save', author_name: null }),
    ]);
    // A version already at the revision a save makes (a named one, say) keeps that one.
    db.sql
      .prepare(
        `INSERT INTO tab_versions (id, tab_id, rev, kind, name, tab_name, data, bytes, element_count, saved_at, created_at)
         VALUES ('v_named', 't1', 3, 'manual', 'Kept', 'Deploys', '{}', 2, 0, 1, 1)`,
      )
      .run();
    write(db, body('again'), 1200);
    expect(rows(db).map((r) => r.kind)).toEqual(['save', 'manual']);
  });

  it('never aborts a write whose body is not JSON, and keeps nothing for it', () => {
    const db = setUp();
    expect(() => write(db, 'not json', 1100)).not.toThrow();
    expect(() => write(db, body('back'), 1200)).not.toThrow();
    expect(rows(db)).toEqual([]);
  });

  it('keeps nothing for a tab with no writing (a canvas tab)', () => {
    const db = setUp();
    write(db, JSON.stringify({ elements: [{ id: 'a' }] }), 1100);
    db.sql.exec('DELETE FROM tab_versions');
    write(db, JSON.stringify({ elements: [{ id: 'b' }] }), 1200);
    expect(rows(db)).toEqual([]);
  });
});

describe('the idle trigger', () => {
  it('passes over a page that held a draft, and still keeps a saved page after a pause', () => {
    const db = setUp();
    write(db, body('first', 'left open'), 1100);
    // A keystroke after half an hour: the page as it stood held a draft, so nothing is kept.
    write(db, body('first', 'left open, then more'), 1100 + VERSION_IDLE_MS);
    expect(rows(db)).toEqual([]);
    write(db, body('saved'), 1200 + VERSION_IDLE_MS);
    // The first write after another pause keeps the saved page, which the Save already kept: one per revision.
    write(db, body('saved', 'next'), 1200 + 2 * VERSION_IDLE_MS);
    expect(rows(db)).toEqual([expect.objectContaining({ kind: 'save', data: body('saved') })]);
  });
});

describe('schema step 34', () => {
  it("rebuilds a room's versions so the kind takes save, keeping every row", () => {
    const sql = new DatabaseSync(':memory:');
    sql.exec('PRAGMA foreign_keys = ON');
    const exec = nodeItemSql(sql);
    migrateDocumentSchema((q) => exec.exec(q));
    // As a room made before step 34: the step 8 table and trigger, with a version in it.
    sql.exec(`
      DROP TRIGGER tab_versions_saved;
      DROP TABLE tab_versions;
      CREATE TABLE tab_versions (
        id TEXT PRIMARY KEY, tab_id TEXT NOT NULL REFERENCES tabs (id) ON DELETE CASCADE, rev INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('idle', 'agent', 'restore', 'manual')), name TEXT NULL,
        author_id TEXT NULL, author_name TEXT NULL, author_color TEXT NULL, tab_name TEXT NOT NULL,
        data TEXT NOT NULL, bytes INTEGER NOT NULL, element_count INTEGER NOT NULL, saved_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL);
      INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES ('t1', 'Deploys', '${body('first')}', 1000, 0, 1);
      INSERT INTO tab_versions (id, tab_id, rev, kind, name, tab_name, data, bytes, element_count, saved_at, created_at)
        VALUES ('v_old', 't1', 1, 'idle', NULL, 'Deploys', '{}', 2, 0, 900, 1000);
      UPDATE _document_schema SET version = ${DOCUMENT_SCHEMA_VERSION - 1};
    `);
    migrateDocumentSchema((q) => exec.exec(q));
    sql
      .prepare("UPDATE tabs SET data = ?, updated_at = 2000, rev = 2 WHERE id = 't1'")
      .run(body('saved'));
    const kept = sql.prepare('SELECT id, kind FROM tab_versions ORDER BY rowid').all();
    expect(kept).toEqual([
      { id: 'v_old', kind: 'idle' },
      { id: expect.stringMatching(/^v_[0-9a-f]{16}$/), kind: 'save' },
    ]);
    // A deleted tab still takes its versions with it.
    sql.exec("DELETE FROM tabs WHERE id = 't1'");
    expect(sql.prepare('SELECT COUNT(*) AS n FROM tab_versions').get()).toEqual({ n: 0 });
  });
});

describe('saveVersionStampStatement', () => {
  it('names the person who saved on the save version at that revision, and nothing else', async () => {
    const db = setUp();
    write(db, body('saved'), 1100);
    await saveVersionStampStatement(db.env, 't1', 2, {
      id: 'user_s',
      name: 'Sam',
      color: '#112233',
    }).run();
    await saveVersionStampStatement(db.env, 't1', 9, {
      id: 'user_x',
      name: 'Nobody',
      color: '#0',
    }).run();
    const [version] = await listVersions(db.env, 't1');
    expect(version).toMatchObject({
      kind: 'save',
      rev: 2,
      author: { name: 'Sam', color: '#112233' },
    });
  });
});

describe('a Save through the tab PUT', () => {
  const writing = (text: string) => [
    { id: 'title', type: 'paragraph', style: 'title', runs: [{ text: 'Deploys' }] },
    { id: 'p1', type: 'paragraph', runs: [{ text }] },
  ];
  const versions = async (kit: Awaited<ReturnType<typeof knowledgeKit>>) =>
    (
      await (
        await kit.call('viewer', 'GET', '/api/documents/kb/tabs/deploys/versions')
      ).json<{
        versions: { kind: string; author: { name: string; color: string } | null }[];
      }>()
    ).versions;

  it('lists each Save, by the person who pressed it, and never the draft between them', async () => {
    setTestProfile(OWNER, 'Olive', '#0a0b0c');
    const kit = await knowledgeKit();
    const put = (extra: object, text: string) =>
      kit.call(
        'editor',
        'PUT',
        '/api/documents/kb/tabs/deploys',
        page('deploys', 'Deploys', writing(text), extra),
      );
    const draft = (text: string) => ({
      articles: { f1: { blocks: writing('saved') }, draft: { blocks: writing(text) } },
      draft: { by: 'Someone Else', at: 1, base: {} },
    });
    expect((await put(draft('one'), 'saved')).status).toBeLessThan(300);
    expect((await put(draft('one two'), 'saved')).status).toBeLessThan(300);
    expect(await versions(kit)).toEqual([]);
    expect((await put({}, 'one two')).status).toBeLessThan(300);
    expect(await versions(kit)).toEqual([
      expect.objectContaining({ kind: 'save', author: { name: 'Olive', color: '#0a0b0c' } }),
    ]);
    expect((await put(draft('three'), 'one two')).status).toBeLessThan(300);
    expect((await put({}, 'three')).status).toBeLessThan(300);
    expect((await versions(kit)).map((v) => v.kind)).toEqual(['save', 'save']);
  });
});
