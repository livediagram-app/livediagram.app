import { describe, expect, it, vi } from 'vitest';
import {
  VERSION_AUTO_MAX,
  VERSION_AUTO_MAX_AGE_MS,
  VERSION_AUTO_MAX_BYTES,
  VERSION_IDLE_MS,
} from '@liveknowledge/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { versionAgentSchemaStep } from '../versions/version-schema';
import {
  agentVersionStatement,
  agentVersionsStampStatement,
  copyTabStatement,
  deleteOldVersions,
  getVersion,
  listVersions,
  namedVersionCount,
  saveVersionStampStatement,
  setVersionName,
  versionAtRev,
  versionAuthorOf,
  versionId,
} from './versions';

// The versions table and its triggers on real SQLite (docs/specs/006-document/blueprints/version-history.md VH1 to
// VH6): the idle copy, one per revision, the prune by count, age and bytes, the api's copies and the upkeep.

const AUTHOR = { id: 'user_a', name: 'Ada', color: '#123456' };

function setUp(): SqliteD1 {
  const db = sqliteD1();
  db.sql
    .prepare(
      "INSERT INTO document (id, saved_at, created_at, name, owner_id) VALUES ('D', 0, 1, 'Doc', 'o')",
    )
    .run();
  db.sql
    .prepare(
      "INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES ('t1', 'Pitch', ?, 1000, 1, 1)",
    )
    .run(body('first'));
  db.sql
    .prepare(
      "INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('D', 't1', 0, 1)",
    )
    .run();
  return db;
}

const body = (label: string, pad = 0) =>
  JSON.stringify({ elements: [{ id: 'a', type: 'shape', label, note: 'x'.repeat(pad) }] });

// A write as every tab write lands: the body, the time, the revision one on.
function write(db: SqliteD1, label: string, at: number, pad = 0) {
  db.sql
    .prepare("UPDATE tabs SET data = ?, updated_at = ?, rev = rev + 1 WHERE id = 't1'")
    .run(body(label, pad), at);
}

const rows = (db: SqliteD1) =>
  db.sql
    .prepare('SELECT rev, kind, name, data, saved_at, created_at FROM tab_versions ORDER BY rowid')
    .all() as { rev: number; kind: string; name: string | null; data: string; saved_at: number }[];

describe('the idle copy', () => {
  it('keeps the tab as it stood before the first write after a pause, and nothing on a busy tab', () => {
    const db = setUp();
    write(db, 'second', 1000 + 600);
    write(db, 'third', 1000 + 1200);
    expect(rows(db)).toEqual([]);
    write(db, 'fourth', 1000 + 1200 + VERSION_IDLE_MS);
    expect(rows(db)).toEqual([
      expect.objectContaining({
        rev: 3,
        kind: 'idle',
        name: null,
        data: body('third'),
        saved_at: 2200,
      }),
    ]);
  });

  it('keeps nothing when the body did not change, and nothing for a write the revision trigger refuses', () => {
    const db = setUp();
    db.sql
      .prepare("UPDATE tabs SET data = data, updated_at = ?, rev = rev + 1 WHERE id = 't1'")
      .run(1000 + VERSION_IDLE_MS);
    expect(() =>
      db.sql
        .prepare("UPDATE tabs SET data = ?, updated_at = ?, rev = rev + 5 WHERE id = 't1'")
        .run(body('stale'), 1000 + 3 * VERSION_IDLE_MS),
    ).toThrow(/tab_rev_stale/);
    expect(rows(db)).toEqual([]);
  });

  it('keeps one version per revision', async () => {
    const db = setUp();
    await copyTabStatement(db.env, {
      id: versionId(),
      tabId: 't1',
      rev: 1,
      kind: 'manual',
      name: 'Draft',
      author: AUTHOR,
      now: 5,
    }).run();
    write(db, 'second', 1000 + VERSION_IDLE_MS);
    expect(rows(db).map((r) => [r.rev, r.kind, r.name])).toEqual([[1, 'manual', 'Draft']]);
  });

  it('goes with its tab', () => {
    const db = setUp();
    write(db, 'second', 1000 + VERSION_IDLE_MS);
    db.sql.prepare("DELETE FROM document_tabs WHERE tab_id = 't1'").run();
    db.sql.prepare("DELETE FROM tabs WHERE id = 't1'").run();
    expect(rows(db)).toEqual([]);
  });
});

describe('the prune', () => {
  it(`keeps the newest ${VERSION_AUTO_MAX} automatic versions, and every named one`, async () => {
    const db = setUp();
    await copyTabStatement(db.env, {
      id: 'v_named',
      tabId: 't1',
      rev: 1,
      kind: 'manual',
      name: 'Keep me',
      author: AUTHOR,
      now: 1,
    }).run();
    let at = 1000;
    for (let i = 0; i < VERSION_AUTO_MAX + 5; i += 1) {
      at += VERSION_IDLE_MS;
      write(db, `v${i}`, at);
    }
    const kept = rows(db);
    expect(kept.filter((r) => r.name === null)).toHaveLength(VERSION_AUTO_MAX);
    expect(kept.find((r) => r.name === 'Keep me')).toBeDefined();
    // The oldest went first: the writes kept revisions 2 to 55 (the first found 1 named), the newest 50 stay.
    expect(kept.filter((r) => r.name === null)[0]!.rev).toBe(6);
  });

  it('drops automatic versions kept past the age as the next one is kept', () => {
    const db = setUp();
    write(db, 'second', 1000 + VERSION_IDLE_MS);
    const later = 1000 + 2 * VERSION_IDLE_MS + VERSION_AUTO_MAX_AGE_MS + 1;
    write(db, 'third', later);
    expect(rows(db).map((r) => r.rev)).toEqual([2]);
  });

  it('keeps no more automatic bytes than the cap, counting from the newest, and always the newest', () => {
    const db = setUp();
    const pad = Math.floor(VERSION_AUTO_MAX_BYTES / 3);
    let at = 1000;
    for (let i = 0; i < 5; i += 1) {
      at += VERSION_IDLE_MS;
      write(db, `big${i}`, at, pad);
    }
    const kept = rows(db);
    const bytes = kept.reduce((sum, r) => sum + new TextEncoder().encode(r.data).length, 0);
    expect(bytes).toBeLessThanOrEqual(VERSION_AUTO_MAX_BYTES);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.at(-1)!.rev).toBe(5);
  });
});

describe("the api's copies and names", () => {
  it('copies the tab as it is for a name, and names, renames and unnames', async () => {
    const db = setUp();
    const id = versionId();
    expect(id).toMatch(/^v_[0-9a-f]{16}$/);
    await copyTabStatement(db.env, {
      id,
      tabId: 't1',
      rev: 1,
      kind: 'manual',
      name: 'Draft',
      author: AUTHOR,
      now: 9,
    }).run();
    const version = await getVersion(db.env, 't1', id);
    expect(version).toMatchObject({
      tabName: 'Pitch',
      data: body('first'),
      summary: {
        id,
        rev: 1,
        kind: 'manual',
        name: 'Draft',
        author: { name: 'Ada' },
        savedAt: 1000,
      },
    });
    expect(await versionAtRev(db.env, 't1', 1)).toMatchObject({ id });
    expect(await versionAtRev(db.env, 't1', 2)).toBeNull();
    expect(await namedVersionCount(db.env, 't1')).toBe(1);
    expect(await setVersionName(db.env, 't1', id, 'Final')).toMatchObject({ name: 'Final' });
    expect(await setVersionName(db.env, 't1', id, null)).toMatchObject({ name: null });
    expect(await setVersionName(db.env, 't2', id, 'x')).toBeNull();
    expect(await getVersion(db.env, 't2', id)).toBeNull();
    expect(await namedVersionCount(db.env, 't1')).toBe(0);
  });

  it('copies nothing when the tab moved past the revision asked for', async () => {
    const db = setUp();
    write(db, 'second', 1100);
    await copyTabStatement(db.env, {
      id: versionId(),
      tabId: 't1',
      rev: 1,
      kind: 'restore',
      name: null,
      author: AUTHOR,
      now: 9,
    }).run();
    expect(rows(db)).toEqual([]);
  });

  it("keeps one version before an agent's burst, never one per write", async () => {
    const db = setUp();
    const agent = (now: number) =>
      agentVersionStatement(db.env, { tabId: 't1', tokenId: 'tok', author: AUTHOR, now }).run();
    await agent(10_000);
    write(db, 'by agent', 10_001);
    await agent(10_002);
    expect(rows(db).map((r) => [r.rev, r.kind])).toEqual([[1, 'agent']]);
    // The same token's changeset inside the burst holds it back too.
    db.sql
      .prepare(
        `INSERT INTO agent_changesets (id, document_id, tab_id, rev, author_id, author_name, author_color, token_id,
           fingerprints, added, changed, removed, created_at)
         VALUES ('cs_1', 'D', 't1', 2, 'user_b', 'B', '#000', 'tok2', '{}', 0, 1, 0, 20000)`,
      )
      .run();
    await agentVersionStatement(db.env, {
      tabId: 't1',
      tokenId: 'tok2',
      author: { ...AUTHOR, id: 'user_b' },
      now: 20_001,
    }).run();
    expect(rows(db)).toHaveLength(1);
  });

  it('lists newest content first, without bodies', async () => {
    const db = setUp();
    write(db, 'second', 1000 + VERSION_IDLE_MS);
    write(db, 'third', 1000 + 3 * VERSION_IDLE_MS);
    const list = await listVersions(db.env, 't1');
    expect(list.map((v) => v.rev)).toEqual([2, 1]);
    expect(list[0]).not.toHaveProperty('data');
    expect(list[0]!.author).toBeNull();
  });
});

describe('the upkeep', () => {
  it('drops automatic versions past the age, never named ones', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = setUp();
    write(db, 'second', 1000 + VERSION_IDLE_MS);
    await copyTabStatement(db.env, {
      id: 'v_named',
      tabId: 't1',
      rev: 2,
      kind: 'manual',
      name: 'Kept',
      author: AUTHOR,
      now: 1,
    }).run();
    const cutoff = 1000 + 2 * VERSION_IDLE_MS;
    expect(await deleteOldVersions(db.env, cutoff)).toBe(1);
    expect(rows(db).map((r) => r.name)).toEqual(['Kept']);
  });
});

describe('the by line', () => {
  it("reads a rule's version as Automation, never as a person", () => {
    const row = { author_id: 'automation', author_name: 'Nightly', author_color: '#7c3aed' };
    expect(versionAuthorOf(row)).toEqual({ name: 'Automation · Nightly', color: '#7c3aed' });
    expect(versionAuthorOf({ ...row, author_name: '' })?.name).toBe('Automation');
    expect(versionAuthorOf({ ...row, author_id: 'user_a', author_color: null })).toEqual({
      name: 'Nightly',
      color: '',
    });
    expect(versionAuthorOf({ ...row, author_name: null })).toBeNull();
  });

  it("names an agent's version's agent beside its person, and only a real name", () => {
    const row = { author_id: 'user_a', author_name: 'Ada', author_color: '#123456' };
    expect(versionAuthorOf({ ...row, author_agent: 'Claude' })).toEqual({
      name: 'Ada',
      color: '#123456',
      agent: 'Claude',
    });
    expect(versionAuthorOf({ ...row, author_agent: '' })).toEqual({
      name: 'Ada',
      color: '#123456',
    });
    expect(versionAuthorOf({ ...row, author_agent: null })).toEqual({
      name: 'Ada',
      color: '#123456',
    });
  });
});

// VH25 to VH27: an agent's versions name the agent beside its person (version-history.md "An agent's mark").
describe("an agent's mark", () => {
  type MarkRow = {
    rev: number;
    kind: string;
    author_name: string | null;
    author_agent: string | null;
  };
  const agentRows = (db: SqliteD1) =>
    db.sql
      .prepare('SELECT rev, kind, author_name, author_agent FROM tab_versions ORDER BY rowid')
      .all() as MarkRow[];
  const stamp = (db: SqliteD1, now: number, author = AUTHOR, agent = 'Claude') =>
    agentVersionsStampStatement(db.env, { tabId: 't1', author, agent, now }).run();
  // The save trigger's version of an agent's write, naming nobody, as an agent's article write leaves it.
  const saveRow = (db: SqliteD1, rev: number, at: number, agent: string | null = null) =>
    db.sql
      .prepare(
        `INSERT INTO tab_versions (id, tab_id, rev, kind, author_agent, tab_name, data, bytes, element_count,
           saved_at, created_at) VALUES (?, 't1', ?, 'save', ?, 'Pitch', '{}', 2, 0, ?, ?)`,
      )
      .run(`v_save${rev}`, rev, agent, at, at);

  it('is a column schema step 43 adds once, safe to run again', () => {
    const db = setUp();
    const columns = () =>
      (db.sql.prepare('PRAGMA table_info(tab_versions)').all() as { name: string }[]).map(
        (c) => c.name,
      );
    expect(columns()).toContain('author_agent');
    const exec = (q: string) => {
      const statement = db.sql.prepare(q);
      if (!q.startsWith('PRAGMA')) {
        statement.run();
        return null;
      }
      const rows = statement.all();
      return { toArray: () => rows };
    };
    versionAgentSchemaStep(exec);
    expect(columns().filter((c) => c === 'author_agent')).toHaveLength(1);
    // A table without it (a room before the step) gains it, its rows reading as a person's.
    db.sql.exec('ALTER TABLE tab_versions DROP COLUMN author_agent');
    expect(columns()).not.toContain('author_agent');
    versionAgentSchemaStep(exec);
    expect(columns()).toContain('author_agent');
  });

  it('names the agent on the version before its burst and on the save it made, its person on the save', async () => {
    const db = setUp();
    await agentVersionStatement(db.env, {
      tabId: 't1',
      tokenId: 'tok',
      author: AUTHOR,
      now: 10_000,
    }).run();
    write(db, 'by agent', 10_001);
    saveRow(db, 2, 10_001);
    await stamp(db, 10_002);
    expect(agentRows(db)).toEqual([
      { rev: 1, kind: 'agent', author_name: 'Ada', author_agent: 'Claude' },
      { rev: 2, kind: 'save', author_name: 'Ada', author_agent: 'Claude' },
    ]);
    expect((await listVersions(db.env, 't1')).map((v) => v.author)).toEqual([
      { name: 'Ada', color: '#123456', agent: 'Claude' },
      { name: 'Ada', color: '#123456', agent: 'Claude' },
    ]);
    // A later write by another agent leaves both as they are.
    await stamp(db, 10_003, AUTHOR, 'Release bot');
    expect(agentRows(db).map((r) => r.author_agent)).toEqual(['Claude', 'Claude']);
  });

  it("leaves another person's versions, older ones, and a person's Save clears it", async () => {
    const db = setUp();
    await agentVersionStatement(db.env, {
      tabId: 't1',
      tokenId: 'tok',
      author: { ...AUTHOR, id: 'user_b', name: 'Bo' },
      now: 1_000,
    }).run();
    // Another person's agent version, and one long before this write: neither is this write's.
    await stamp(db, 1_000 + VERSION_IDLE_MS, { ...AUTHOR, id: 'user_b', name: 'Bo' });
    await stamp(db, 1_001);
    expect(agentRows(db).map((r) => r.author_agent)).toEqual([null]);
    // A person's Save clears any agent on the version it stamps.
    write(db, 'saved', 2_000);
    saveRow(db, 2, 2_000, 'Claude');
    await saveVersionStampStatement(db.env, 't1', 2, AUTHOR).run();
    expect(agentRows(db).at(-1)).toEqual({
      rev: 2,
      kind: 'save',
      author_name: 'Ada',
      author_agent: null,
    });
  });
});
