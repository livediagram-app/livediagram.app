import { expect } from 'vitest';
import { elementFingerprint, type Element, type ElementOp } from '@livediagram/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import type { ChangesetRecord } from '../db/changesets';
import type { ItemGrant } from '../index-service';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// What the tab save's tests share (the whole-tab PUT's and the delta save's): a one-tab document in SQLite, its
// stored elements and revision, and a changeset recorded behind the saver's back.

export const OWNER = 'user_owner';
export const box = (id: string, label = id): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  label,
});

export function call(
  db: SqliteD1,
  method: string,
  path: string,
  opts: {
    body?: unknown;
    headers?: Record<string, string>;
    token?: boolean;
    // A share-link visitor: who they are and the grant they hold.
    visitor?: { owner: string; grant: ItemGrant };
  } = {},
) {
  if (opts.visitor) {
    return handleDocuments(
      makeTestRouteContext(method, path, {
        env: db.env,
        owner: opts.visitor.owner,
        body: opts.body,
        headers: opts.headers,
        grant: opts.visitor.grant,
      }),
    );
  }
  return handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner: OWNER,
      accountUserId: opts.token ? null : OWNER,
      verifiedUserId: OWNER,
      body: opts.body,
      headers: opts.headers,
      token: opts.token ? { id: 'tok_1' } : null,
    }),
  );
}

// A share link's grant on document D at `level`, scoped to `tab` when given.
export const grantAt = (level: ItemGrant['level'], tab: string | null = null): ItemGrant => ({
  item: 'D',
  level,
  tab,
  sub: 'link:abc',
  team: null,
  exp: 2_000_000_000,
  shareCode: 'abc',
  token: 'g',
});

export async function documentWith(elements: Element[], env: Partial<Env> = {}): Promise<SqliteD1> {
  const db = sqliteD1(env);
  const res = await call(db, 'POST', '/api/documents', {
    body: { id: 'D', name: 'Board', tabs: [{ id: 't1', name: 'Board', elements }] },
  });
  expect(res.status).toBe(201);
  return db;
}

export const stored = (db: SqliteD1) =>
  (
    JSON.parse(db.sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get()!.data as string) as {
      elements: Element[];
    }
  ).elements;
export const revOf = (db: SqliteD1) =>
  db.sql.prepare("SELECT rev FROM tabs WHERE id = 't1'").get()!.rev;

// A changeset recorded as the pipeline records it: the tab advanced to `rev` with `n` added.
// Straight through SQLite, so a test may run it from inside an intercepted D1 batch.
export function recordAdd(db: SqliteD1, n: Element, createdAt = Date.now()): number {
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
