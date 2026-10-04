import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHANGESET_MERGE_WINDOW_MS } from '@livediagram/api-schema';
import { elementFingerprint, type Element, type ElementOp } from '@livediagram/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import type { ChangesetRecord } from '../db/changesets';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// The editor's whole-tab save (docs/specs/024-agents/blueprints/agent-changesets.md "The tab PUT"):
// refused to tokens, merged with the changesets the saver had not seen, written at the revision it
// read.

const OWNER = 'user_owner';
const box = (id: string, label = id): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, label }) as Element;

function call(
  db: SqliteD1,
  method: string,
  path: string,
  opts: { body?: unknown; headers?: Record<string, string>; token?: boolean } = {},
) {
  return handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner: OWNER,
      clerkUserId: opts.token ? null : OWNER,
      verifiedUserId: OWNER,
      body: opts.body,
      headers: opts.headers,
      token: opts.token ? { id: 'tok_1' } : null,
    }),
  );
}

async function documentWith(elements: Element[], env: Partial<Env> = {}): Promise<SqliteD1> {
  const db = sqliteD1(env);
  const res = await call(db, 'POST', '/api/documents', {
    body: { id: 'D', name: 'Board', tabs: [{ id: 't1', name: 'Board', elements }] },
  });
  expect(res.status).toBe(201);
  return db;
}

const stored = (db: SqliteD1) =>
  JSON.parse(db.sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get()!.data as string)
    .elements as Element[];
const revOf = (db: SqliteD1) => db.sql.prepare("SELECT rev FROM tabs WHERE id = 't1'").get()!.rev;

// A changeset recorded as the pipeline records it: the tab advanced to `rev` with `n` added.
// Straight through SQLite, so a test may run it from inside an intercepted D1 batch.
function recordAdd(db: SqliteD1, n: Element, createdAt = Date.now()): number {
  const rev = Number(revOf(db)) + 1;
  const elements = [...stored(db), n];
  db.sql
    .prepare("UPDATE tabs SET data = ?, rev = ? WHERE id = 't1'")
    .run(JSON.stringify({ elements }), rev);
  const record: ChangesetRecord = {
    id: `cs_${String(rev).padStart(10, '0')}`,
    documentId: 'D',
    tabId: 't1',
    rev,
    baseRev: null,
    authorId: OWNER,
    authorName: 'Webber',
    authorColor: '#0ea5e9',
    tokenId: 'tok_1',
    summary: null,
    fingerprints: { before: {}, after: { [n.id]: elementFingerprint(n) } },
    counts: { added: 1, changed: 0, removed: 0 },
    createdTab: false,
    revertOf: null,
    createdAt,
  };
  const ops: ElementOp[] = [{ kind: 'add', element: n, at: elements.length - 1 }];
  db.sql
    .prepare(
      `INSERT INTO agent_changesets (id, document_id, tab_id, rev, author_id, author_name,
         author_color, token_id, fingerprints, added, changed, removed, created_at)
       VALUES (?, 'D', 't1', ?, ?, 'Webber', '#0ea5e9', 'tok_1', ?, 1, 0, 0, ?)`,
    )
    .run(record.id, rev, OWNER, JSON.stringify(record.fingerprints), createdAt);
  db.sql
    .prepare("INSERT INTO agent_changeset_parts (changeset_id, part, data) VALUES (?, 'ops', ?)")
    .run(record.id, JSON.stringify(ops));
  return rev;
}

const save = (
  db: SqliteD1,
  elements: Element[],
  headers: Record<string, string> = {},
  extra = {},
) =>
  call(db, 'PUT', '/api/documents/D/tabs/t1', {
    body: { id: 't1', name: 'Board', elements, ...extra },
    headers,
  });

afterEach(() => vi.restoreAllMocks());

describe('the tab PUT', () => {
  it('refuses an API token with use_changesets, naming the route, before reading anything', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const res = await call(db, 'PUT', '/api/documents/D/tabs/t1', {
      body: { id: 't1', name: 'Board', elements: [] },
      token: true,
    });
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({
      error: 'use_changesets',
      message:
        'Agents and scripts write tabs with changesets: POST /api/documents/D/tabs/t1/changesets',
    });
    expect(stored(db).map((e) => e.id)).toEqual(['a']);
    expect(info).toHaveBeenCalledWith('[changeset] whole-tab-refused', {
      documentId: 'D',
      tabId: 't1',
      tokenId: 'tok_1',
    });
  });

  it('answers the new revision and strips record fields from the body', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const res = await save(
      db,
      [box('a', 'b')],
      {},
      { rev: 99, documentId: 'X', orderIndex: 7, updatedAt: 1 },
    );
    expect(res.status).toBe(200);
    const { tab } = (await res.json()) as {
      tab: { rev: number; documentId: string; orderIndex: number };
    };
    expect(tab).toMatchObject({ rev: 2, documentId: 'D', orderIndex: 0 });
    const data = JSON.parse(
      db.sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get()!.data as string,
    );
    expect(data).not.toHaveProperty('rev');
    expect(data).not.toHaveProperty('documentId');
  });

  it('merges a changeset the saver had not seen, and logs it', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const seen = revOf(db);
    recordAdd(db, box('n'));
    const res = await save(db, [box('a', 'edited')], { 'X-Changeset-Seen': String(seen) });
    expect(res.status).toBe(200);
    expect(stored(db).map((e) => [e.id, (e as { label?: string }).label])).toEqual([
      ['a', 'edited'],
      ['n', 'n'],
    ]);
    expect(info).toHaveBeenCalledWith(
      '[changeset] merged-on-save',
      expect.objectContaining({ documentId: 'D', tabId: 't1', elements: 1 }),
    );
  });

  it('merges nothing the saver has already seen', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const rev = recordAdd(db, box('n'));
    await save(db, [box('a')], { 'X-Changeset-Seen': String(rev) });
    expect(stored(db).map((e) => e.id)).toEqual(['a']);
  });

  it('without the header (an older editor), merges the last 10 minutes only', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    recordAdd(db, box('old'), Date.now() - CHANGESET_MERGE_WINDOW_MS - 1000);
    recordAdd(db, box('recent'));
    await save(db, [box('a')]);
    expect(stored(db).map((e) => e.id)).toEqual(['a', 'recent']);
  });

  it('reads an unparsable header as absent, and logs it', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    recordAdd(db, box('recent'));
    await save(db, [box('a')], { 'X-Changeset-Seen': 'soon' });
    expect(stored(db).map((e) => e.id)).toEqual(['a', 'recent']);
    expect(warn).toHaveBeenCalledWith(
      '[changeset] seen-invalid',
      expect.objectContaining({ length: 4 }),
    );
  });

  it('repeats a lost race once, merging what won, then answers tab_busy', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const seen = String(revOf(db));
    // A changeset lands between the save's read and its write, once.
    const batch = db.env.DB.batch.bind(db.env.DB);
    let interleave = 1;
    db.env.DB.batch = (async (statements: D1PreparedStatement[]) => {
      if (interleave > 0) {
        interleave -= 1;
        recordAdd(db, box(`raced${interleave}`));
      }
      return batch(statements);
    }) as typeof db.env.DB.batch;
    expect((await save(db, [box('a', 'mine')], { 'X-Changeset-Seen': seen })).status).toBe(200);
    expect(stored(db).map((e) => e.id)).toEqual(['a', 'raced0']);

    interleave = 5;
    expect((await save(db, [box('a')], { 'X-Changeset-Seen': seen })).status).toBe(409);
  });
});

describe('the tab read', () => {
  it('carries the revision in the body and as a weak ETag', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    await save(db, [box('a', 'b')]);
    const res = await call(db, 'GET', '/api/documents/D/tabs/t1');
    expect(res.headers.get('ETag')).toBe('W/"2"');
    expect(((await res.json()) as { tab: { rev: number } }).tab.rev).toBe(2);
  });
});
