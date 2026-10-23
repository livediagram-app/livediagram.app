import { AsyncLocalStorage } from 'node:async_hooks';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { DocumentDb } from './document-room/document-db';
import { migrateDocumentSchema } from './document-room/document-schema';
import { nodeDocumentSql, nodeTransaction } from './test-document-sql';
import { testPersonStores } from './test-person-store';
import type { Env, DocumentEnv } from './types';
import { memoryWorkbenchNamespace } from '@liveworkspace/index-app/testing';
import { accountCredentials } from './auth/accounts';
import { closeWorkbenchSessions } from './room-access-client';

// A REAL D1 for tests: an in-memory SQLite database with every migration in
// apps/api/migrations applied, behind the D1 prepare/bind/first/all/run/batch
// surface the db/ modules call.
//
// test-d1.ts records which SQL ran; this one answers whether it WORKED. Use it
// where the behaviour lives in the schema: foreign-key cascades, primary-key
// collisions, INSERT OR IGNORE outcomes. D1 enforces foreign keys, so this
// turns them on too.
//
// The documents' content (docs/specs/015-api/api.md "Storage") is each document's own Durable Object in production. Here
// every document's tables sit in the same database as D1's (their names do not overlap), behind `env.DOCUMENT_DB`, so a
// test arranges and asserts on both through one handle, and a handler runs as it does inside a document's object.
// `env.DOCUMENT_ROOM` answers the document RPCs (document-client.ts) from those same tables, and hands `fetch` (the room's
// relays) to the DOCUMENT_ROOM the test passed, if any. A document row inserted into D1 gets its document row, as a
// create does, and what a document owes D1 (document-outbox.ts) is pushed before every D1 call, so a test reads D1 as
// it would be once the document's push has landed.
//
// Not a `.test.ts` file, so vitest doesn't collect it as a suite.

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url).href);

export type SqliteD1 = {
  // The worker's bindings and the documents' (DOCUMENT_DB): every content module and every D1 module runs against it.
  env: DocumentEnv;
  // The raw handle, for arranging rows and asserting on them directly.
  sql: DatabaseSync;
  // Land what the documents owe D1 now (every D1 call does this first), for a test that reads D1 through `sql`.
  flush: () => Promise<void>;
};

// D1 binds a boolean as 1 / 0; node:sqlite refuses one outright.
function toSql(value: unknown): SQLInputValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === undefined) throw new TypeError('D1_TYPE_ERROR: undefined is not a bindable value');
  return value as SQLInputValue;
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

// Run the one migration whose file name starts with `prefix` (e.g. '0049'),
// for a test that seeds rows under the previous schema first.
export function applyMigration(sql: DatabaseSync, prefix: string): void {
  const file = migrationFiles().find((f) => f.startsWith(`${prefix}_`));
  if (!file) throw new Error(`no migration ${prefix}`);
  sql.exec(readFileSync(MIGRATIONS_DIR + file, 'utf8'));
}

// Run every migration from `prefix` on, bringing a database seeded under an older schema up to
// the one the current code reads.
export function migrateFrom(sql: DatabaseSync, prefix: string): void {
  for (const file of migrationFiles().filter((f) => f >= prefix)) {
    sql.exec(readFileSync(MIGRATIONS_DIR + file, 'utf8'));
  }
}

// `before` stops short of that migration (e.g. '0049'), leaving it for the
// test to apply with applyMigration.
export function sqliteD1(base: Partial<Env> = {}): SqliteD1 {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of migrationFiles()) sql.exec(readFileSync(MIGRATIONS_DIR + file, 'utf8'));
  const documentSql = nodeDocumentSql(sql);
  migrateDocumentSchema((q) => documentSql.exec(q));
  // A document row comes with its document's, as a create makes both.
  sql.exec(`CREATE TEMP TRIGGER documents_document AFTER INSERT ON documents
    BEGIN
      INSERT OR IGNORE INTO document (id, saved_at, created_at)
      VALUES (NEW.id, COALESCE(NEW.saved_at, 0), COALESCE(NEW.created_at, 0));
    END`);

  // Push what the documents owe D1 before D1 answers anything. A call made while a push runs waits for it; the
  // push's own D1 batch (inside it, by its async context) goes straight through.
  const inPush = new AsyncLocalStorage<true>();
  let pushing: Promise<void> | null = null;
  const push = async (): Promise<void> => {
    if (inPush.getStore()) return;
    while (pushing) await pushing;
    if (sql.prepare('SELECT 1 FROM outbox LIMIT 1').all().length === 0) return;
    pushing = inPush.run(true, async () => {
      const { drainOutbox } = await import('./document-room/document-outbox');
      const documents = sql.prepare('SELECT DISTINCT document_id FROM outbox').all() as {
        document_id: string;
      }[];
      for (const { document_id } of documents) {
        let more = true;
        while (more) more = (await drainOutbox(env, document_id)).more;
      }
    });
    try {
      await pushing;
    } finally {
      pushing = null;
    }
  };

  const statement = (query: string, args: SQLInputValue[]) => {
    const rows = () =>
      sql
        .prepare(query)
        .all(...args)
        .map((row) => ({ ...row }));
    return {
      bind: (...next: unknown[]) => statement(query, next.map(toSql)),
      first: async (column?: string) => {
        await push();
        const row = rows()[0] ?? null;
        return column && row ? (row[column] ?? null) : row;
      },
      all: async () => {
        await push();
        return { results: rows(), success: true, meta: {} };
      },
      run: async () => {
        await push();
        const res = sql.prepare(query).run(...args);
        return {
          success: true,
          meta: { changes: Number(res.changes), last_row_id: Number(res.lastInsertRowid) },
        };
      },
      // What D1's batch hands back per statement: a read's rows, a write's
      // change count.
      batchResult: async () => {
        const prepared = sql.prepare(query);
        if (prepared.columns().length > 0) {
          return { results: rows(), success: true, meta: { changes: 0 } };
        }
        const res = prepared.run(...args);
        return { results: [], success: true, meta: { changes: Number(res.changes) } };
      },
    };
  };

  // D1 isolates each batch from every other. Each batch here awaits between its statements, so two run
  // concurrently (the cron's sweeps, under waitUntil) would interleave inside one SQLite connection and the
  // second BEGIN would fail. Batches therefore queue behind one another, as D1 serialises them.
  let batches: Promise<unknown> = Promise.resolve();
  const runBatch = async (statements: { batchResult: () => Promise<unknown> }[]) => {
    sql.exec('BEGIN');
    try {
      const results = [];
      for (const s of statements) results.push(await s.batchResult());
      sql.exec('COMMIT');
      return results;
    } catch (err) {
      sql.exec('ROLLBACK');
      throw err;
    }
  };
  const db = {
    prepare: (query: string) => statement(query, []),
    // D1 runs a batch as one transaction: all of it lands or none of it does.
    batch: async (statements: { batchResult: () => Promise<unknown> }[]) => {
      await push();
      const run = batches.then(() => runBatch(statements));
      batches = run.catch(() => undefined);
      return run;
    },
  };

  const documentDb = new DocumentDb(documentSql, {
    transaction: nodeTransaction(sql),
    ensureSchema: () => {},
    onWrite: () => {},
  });
  const env = {
    PERSON_STORE: testPersonStores(),
    ...base,
    DB: db,
    DOCUMENT_DB: documentDb.asD1(),
  } as unknown as DocumentEnv;
  // A test that sets env.DOCUMENT_ROOM later (its relay recorder) gets it wrapped the same way.
  let rooms = testDocumentRooms(env, sql, base.DOCUMENT_ROOM);
  Object.defineProperty(env, 'DOCUMENT_ROOM', {
    enumerable: true,
    get: () => rooms,
    set: (next: DurableObjectNamespace | undefined) => {
      rooms = testDocumentRooms(env, sql, next);
    },
  });
  // Each person's workbench store, in memory (@liveworkspace/index-app/testing), closing rooms as the real one does.
  if (!base.WORKBENCH) {
    env.WORKBENCH = memoryWorkbenchNamespace<'document'>({
      credentials: () => accountCredentials(env),
      closeRoom: (documentId, pairingId) => closeWorkbenchSessions(env, documentId, pairingId),
    }) as unknown as DurableObjectNamespace;
  }
  return { env, sql, flush: push };
}

// The document RPCs (document-client.ts) over the shared tables, and the room's `fetch` handed to the test's own
// DOCUMENT_ROOM (a recorder of relays), or answered 404 without one.
function testDocumentRooms(
  env: DocumentEnv,
  sql: DatabaseSync,
  rooms: DurableObjectNamespace | undefined,
): DurableObjectNamespace {
  type FakeId = DurableObjectId & { documentName: string; roomId: unknown };
  const roomOf = (id: FakeId) =>
    rooms ? (rooms.get(id.roomId as DurableObjectId) as { fetch: typeof fetch }) : null;
  const ns = {
    idFromName: (name: string): FakeId => ({
      documentName: name,
      roomId: rooms ? rooms.idFromName(name) : name,
      name,
      toString: () => name,
      equals: (other: DurableObjectId) => (other as FakeId).documentName === name,
    }),
    get: (id: FakeId) => ({
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const room = roomOf(id);
        return room
          ? room.fetch(input, init)
          : Promise.resolve(new Response(null, { status: 404 }));
      },
      outline: async (documentId: string) =>
        (await import('./document-room/document-content')).readDocumentOutline(env, documentId),
      route: async (_documentId: string, request: Request, identity: unknown) =>
        (await import('./document-room/document-route')).answerDocumentRequest(
          env,
          request,
          identity as never,
          () => {},
        ),
      image: async (
        _documentId: string,
        subject: unknown,
        tabId: string | null,
        community = false,
      ) =>
        (await import('./thumbnail')).renderDocumentImage(
          env,
          subject as never,
          tabId,
          {},
          community,
        ),
      hasTab: async (documentId: string, tabId: string) =>
        (await import('./db/tabs')).documentHasTab(env, documentId, tabId),
      placesImage: async (documentId: string, imageId: string, onlyTabId: string | null) =>
        (await import('./db/image-refs')).documentPlacesImage(env, documentId, imageId, onlyTabId),
      exportCopy: async (
        documentId: string,
        onlyTabId: string | null,
        redact: string | null,
        community = false,
      ) =>
        (await import('./document-room/document-content')).exportDocumentCopy(
          env,
          documentId,
          onlyTabId,
          redact,
          community,
        ),
      importCopy: async (documentId: string, copy: unknown) =>
        (await import('./document-room/document-content')).importDocumentCopy(
          env,
          documentId,
          copy as never,
        ),
      // Everything the document stored goes, and the room hears it as it did (its `/purge`).
      purge: async (documentId: string) => {
        sql.exec('SAVEPOINT purge');
        try {
          sql
            .prepare(
              `DELETE FROM tabs WHERE id IN (SELECT tab_id FROM document_tabs WHERE document_id = ?)`,
            )
            .run(documentId);
          sql.prepare('DELETE FROM document WHERE id = ?').run(documentId);
          sql.prepare('DELETE FROM outbox WHERE document_id = ?').run(documentId);
          sql.exec('RELEASE purge');
        } catch (err) {
          sql.exec('ROLLBACK TO purge');
          sql.exec('RELEASE purge');
          throw err;
        }
        const room = roomOf(id);
        if (room) {
          const res = await room.fetch('https://room/purge', { method: 'POST' });
          if (!res.ok) throw new Error(`status ${res.status}`);
        }
      },
      revokeCodes: async () => 0,
    }),
  };
  return ns as unknown as DurableObjectNamespace;
}
