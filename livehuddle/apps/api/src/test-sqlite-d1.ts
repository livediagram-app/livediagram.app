import { DatabaseSync } from 'node:sqlite';
import { ItemDb } from '@liveworkspace/index-app';
import {
  bindTestRooms,
  nodeItemSql,
  nodeTransaction,
  testFolderPreviews,
  testIndexGrant,
  testItemGrant,
  testOutboxFlush,
  testRequestGrant as requestTestGrant,
  testRoomNamespace,
  type TestGrantCaller,
} from '@liveworkspace/index-app/testing';
import { IndexError, type IndexClient, type ShareAccess } from '@liveworkspace/index-client';
import type { AccessLevel } from '@livehuddle/api-schema';
import { migrateDocumentSchema } from './document-room/document-schema';
import type { GrantCaller, GrantOutcome, ItemGrant } from './index-service';
import { testPersonStores } from './test-person-store';
import type { Env, DocumentEnv } from './types';

// The api's storage for tests. A canvas's content (docs/specs/015-api/api.md "Storage") is its own Durable Object in
// production; here every canvas's tables sit in one in-memory SQLite database, behind `env.DOCUMENT_DB`, so a test
// arranges and asserts on them through one handle, and a handler runs as it does inside a canvas's object.
// `env.DOCUMENT_ROOM` answers the canvas RPCs (document-client.ts) from those same tables, and hands `fetch` (the
// room's relays) to the DOCUMENT_ROOM the test passed, if any. `flush` drains what the canvases owe the index and the
// media service (document-outbox.ts), for a test that asserts on those pushes. Each person's stores are in memory.
//
// What the index holds in production (liveworkspace/docs/specs/004-index/one-explorer.md) is test scaffolding here: `test_documents`
// writes a started canvas's own row (what a create writes), `test_share_links` holds the links the index would grant
// through and `test_folders` the folders it would list. `testGrantFor` (below) reads them, as the index's access rule
// does. Not a `.test.ts` file, so vitest doesn't collect it as a suite.

export type SqliteD1 = {
  // The worker's bindings and the canvases' (DOCUMENT_DB): every content module runs against it.
  env: DocumentEnv;
  // The raw handle, for arranging rows and asserting on them directly.
  sql: DatabaseSync;
  // Drain what the canvases owe the index and the media service now.
  flush: () => Promise<void>;
};

export function sqliteD1(base: Partial<Env> = {}): SqliteD1 {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  const documentSql = nodeItemSql(sql);
  migrateDocumentSchema((q) => documentSql.exec(q));
  sql.exec(`CREATE TEMP VIEW test_documents AS
    SELECT id, owner_id, name, team_id, source, saved_at, created_at FROM document`);
  sql.exec(`CREATE TEMP TRIGGER test_documents_insert INSTEAD OF INSERT ON test_documents
    BEGIN
      INSERT INTO document (id, owner_id, name, team_id, source, saved_at, created_at)
      VALUES (NEW.id, NEW.owner_id, COALESCE(NEW.name, ''), NEW.team_id, NEW.source, COALESCE(NEW.saved_at, 0),
              MAX(COALESCE(NEW.created_at, 1), 1))
      ON CONFLICT (id) DO UPDATE SET owner_id = excluded.owner_id, name = excluded.name,
        team_id = excluded.team_id, source = excluded.source, saved_at = excluded.saved_at,
        created_at = excluded.created_at;
    END`);
  sql.exec(`CREATE TEMP TABLE test_folders (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, team_id TEXT NULL, parent_id TEXT NULL, name TEXT NOT NULL)`);
  sql.exec(`CREATE TEMP TABLE test_share_links (
    code TEXT PRIMARY KEY, document_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'edit',
    tab_id TEXT NULL, created_at INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NULL, password TEXT NULL)`);
  sql.exec(`CREATE TEMP TABLE test_trash (document_id TEXT PRIMARY KEY)`);

  // Drain what they owe (their outboxes). A call made while a drain runs waits for it; one made from inside the
  // drain (by its async context) returns at once.
  const push = testOutboxFlush(sql, {
    itemColumn: 'document_id',
    mode: 'reentrant',
    drain: async (id) => (await import('./document-room/document-outbox')).drainOutbox(env, id),
  });

  const documentDb = new ItemDb(documentSql, {
    transaction: nodeTransaction(sql),
    ensureSchema: () => {},
    onWrite: () => {},
  });
  const env = {
    PERSON_STORE: testPersonStores(),
    ...base,
    DOCUMENT_DB: documentDb.asD1(),
  } as unknown as DocumentEnv;
  Object.defineProperty(env, TEST_GRANT_HOOK, {
    value: (documentId: string, who: TestGrantCaller) => testGrantFor(sql, documentId, who),
    enumerable: false,
  });
  Object.defineProperty(env, TEST_SQL, { value: sql, enumerable: false });
  // A test that sets env.DOCUMENT_ROOM later (its relay recorder) gets it wrapped the same way.
  bindTestRooms(env, 'DOCUMENT_ROOM', base.DOCUMENT_ROOM, (rooms) =>
    testDocumentRooms(env, sql, rooms),
  );
  return { env, sql, flush: push };
}

const TEST_SQL = '__testSql';

// The index as a test's caller reaches it (index-service.ts `indexFor` and `requestGrant`, mocked with these): its
// grants by `testGrantFor`'s rule, a link resolved from `test_share_links`, and the folders in `test_folders` (a
// person's own, and their teams').
export function testIndexFor(env: unknown, caller: GrantCaller): IndexClient | null {
  const sql = (env as Record<string, unknown>)[TEST_SQL] as DatabaseSync | undefined;
  if (!sql) return null;
  const person = caller.kind === 'delegate' ? caller.personId : null;
  const teams = caller.kind === 'delegate' ? caller.teams : [];
  const client: Partial<IndexClient> = {
    grant: testIndexGrant((itemId, who) => testGrantFor(sql, itemId, who), person, teams),
    // An item the caller reaches (by the same rule as a grant), as the index lists it; 404 otherwise.
    getItem: async (documentId) => {
      const grant = testGrantFor(sql, documentId, { person, teams, code: null, create: false });
      if (!grant) throw new IndexError(404, 'not_found');
      const row = sql
        .prepare('SELECT name, owner_id, team_id, created_at, saved_at FROM document WHERE id = ?')
        .get(documentId) as {
        name: string;
        owner_id: string;
        team_id: string | null;
        created_at: number;
        saved_at: number;
      };
      return {
        item: {
          id: documentId,
          name: row.name,
          ownerId: row.owner_id,
          teamId: row.team_id,
          createdAt: row.created_at,
          updatedAt: row.saved_at,
          trashedAt: null,
        } as unknown as Awaited<ReturnType<IndexClient['getItem']>>['item'],
      };
    },
    folderPreviews: testFolderPreviews(sql, person, teams),
  };
  return client as IndexClient;
}

export async function testRequestGrant(
  env: Env,
  caller: GrantCaller,
  documentId: string,
  share: ShareAccess | null,
): Promise<GrantOutcome> {
  return requestTestGrant(testIndexFor(env, caller), documentId, share);
}

// What the index would grant on a canvas in a test (test-route-context.ts): the owner and a member of its team
// edit; a live `test_share_links` code grants its level, on its tab. A create (no started canvas yet) is the
// caller's own. Null for anything else.
export const TEST_GRANT_HOOK = '__testGrant';

export type { TestGrantCaller };

// A canvas in the Trash: its owner and team are granted, saying so; a link reaches nothing.
function testGrantFor(sql: DatabaseSync, itemId: string, who: TestGrantCaller): ItemGrant | null {
  return testItemGrant(sql, itemId, who, {
    item: 'document',
    linkColumn: 'document_id',
    trashColumn: 'document_id',
    owner: true,
  }) as ItemGrant | null;
}

// A share link the index would grant through, for a test (as the index's createShareLink was called).
export function testShareLink(
  db: SqliteD1,
  documentId: string,
  code: string,
  role: AccessLevel,
  tabId: string | null = null,
  expiresAt: number | null = null,
): void {
  db.sql
    .prepare(
      'INSERT INTO test_share_links (code, document_id, role, tab_id, created_at, expires_at) VALUES (?, ?, ?, ?, 1, ?)',
    )
    .run(code, documentId, role, tabId, expiresAt);
}

// A canvas moved to the Trash, as the index would hold it (testGrantFor).
export function testTrash(db: SqliteD1, documentId: string): void {
  db.sql.prepare('INSERT OR IGNORE INTO test_trash (document_id) VALUES (?)').run(documentId);
}

// A started canvas, as a create writes it: its own row (owner, name, team).
export function testDocument(
  db: SqliteD1,
  id: string,
  ownerId: string,
  opts: { name?: string; teamId?: string | null; savedAt?: number; createdAt?: number } = {},
): void {
  db.sql
    .prepare(
      'INSERT INTO test_documents (id, owner_id, name, team_id, source, saved_at, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?)',
    )
    .run(
      id,
      ownerId,
      opts.name ?? 'Untitled',
      opts.teamId ?? null,
      opts.savedAt ?? 1,
      opts.createdAt ?? 1,
    );
}

// The document RPCs (document-client.ts) over the shared tables, and the room's `fetch` handed to the test's own
// DOCUMENT_ROOM (a recorder of relays), or answered 404 without one.
function testDocumentRooms(
  env: DocumentEnv,
  sql: DatabaseSync,
  rooms: DurableObjectNamespace | undefined,
): DurableObjectNamespace {
  // The canvas's Community post's link as the room reads it (document-room.ts communityOf).
  const communityOf = async (documentId: string) => {
    const cp = await import('./document-room/community-post');
    const post = await cp.readCommunityPost(env);
    if (!post) return null;
    const meta = await (
      await import('./document-room/document-content')
    ).readDocumentMeta(env, documentId);
    return { code: post.shareCode, open: cp.openCommunityCode(env, post, meta) === post.shareCode };
  };
  return testRoomNamespace(rooms, (id, roomOf) => ({
    outline: async (documentId: string) =>
      (await import('./document-room/document-content')).readDocumentOutline(env, documentId),
    route: async (_documentId: string, request: Request, identity: unknown) =>
      (await import('./document-room/document-route')).answerDocumentRequest(
        env,
        request,
        identity as never,
        () => {},
      ),
    exportImage: async (
      documentId: string,
      query: {
        tabId: string | null;
        code: string | null;
        appearance: 'light' | 'dark' | null;
        ifVersion: number | null;
      },
    ) => {
      const content = await import('./document-room/document-content');
      const { meta, savedAt } = await content.readDocumentHead(env, documentId);
      if (!meta) return { status: 'not_found' };
      // A Community post's link draws only while the post is open (document-room.ts exportImage).
      const community = query.code === null ? null : await communityOf(documentId);
      const onPost = community !== null && community.code === query.code;
      if (onPost && !community.open) return { status: 'not_found' };
      if (query.ifVersion === savedAt) return { status: 'unchanged', version: savedAt };
      if (
        query.tabId !== null &&
        !(await (await import('./db/tabs')).documentHasTab(env, documentId, query.tabId))
      ) {
        return { status: 'not_found' };
      }
      const svg = await (
        await import('./thumbnail')
      ).drawDocument(
        env,
        { id: documentId, name: meta.name },
        query.tabId,
        { appearance: query.appearance },
        onPost,
      );
      return svg === null
        ? { status: 'empty', version: savedAt }
        : {
            status: 'ok',
            body: svg,
            contentType: 'image/svg+xml; charset=utf-8',
            version: savedAt,
          };
    },
    // The data export's comment threads (document-room.ts exportComments).
    exportComments: async (documentId: string) =>
      (await import('./document-room/document-comments')).exportDocumentComments(env, documentId),
    // The Drive file's two halves (document-room.ts exportFile and importFile).
    exportFile: async (documentId: string, query: { ifVersion: number | null }) =>
      (await import('./document-room/document-file')).exportDocumentFile(
        env,
        documentId,
        query.ifVersion,
      ),
    importFile: async (documentId: string, file: unknown) =>
      (await import('./document-room/document-file')).importDocumentFile(
        env,
        documentId,
        file as never,
      ),
    hasTab: async (documentId: string, tabId: string) =>
      (await import('./db/tabs')).documentHasTab(env, documentId, tabId),
    servesImage: async (documentId: string, imageId: string, onlyTabId: string | null) =>
      (await (
        await import('./db/image-refs')
      ).documentPlacesImage(env, documentId, imageId, onlyTabId)) &&
      (await import('./db/image-grants')).documentMayServeImage(env, documentId, imageId),
    exportCopy: async (
      documentId: string,
      onlyTabId: string | null,
      copier: { by: string | null; code: string | null } | null,
    ) => {
      const content = await import('./document-room/document-content');
      const meta = await content.readDocumentMeta(env, documentId);
      if (!meta) return null;
      const post = copier?.code ? await communityOf(documentId) : null;
      const community = post !== null && post.open && post.code === copier?.code;
      const by = copier?.by ?? null;
      const copy = await content.exportDocumentCopy(
        env,
        documentId,
        onlyTabId,
        by !== null && by !== meta.ownerId ? by : null,
        community,
      );
      return copy ? { copy, community } : null;
    },
    community: (documentId: string) => communityOf(documentId),
    communityPostTitle: async (documentId: string, code: string) => {
      const post = await communityOf(documentId);
      if (!post || post.code !== code || !post.open) return null;
      return (
        (await (await import('./document-room/community-post')).readCommunityPost(env))?.title ??
        null
      );
    },
    communityListing: async (documentId: string, code: string) => {
      const post = await communityOf(documentId);
      if (!post || post.code !== code || !post.open) return null;
      const cp = await import('./document-room/community-post');
      const stored = await cp.readCommunityPost(env);
      return stored
        ? { postId: stored.postId, author: await cp.communityPostAuthor(env, stored) }
        : null;
    },
    joined: async (documentId: string, personId: string) => {
      const meta = await (
        await import('./document-room/document-content')
      ).readDocumentMeta(env, documentId);
      if (!meta) return;
      await (
        await import('./email/notifications')
      ).notifyDocumentJoin(
        env,
        { id: documentId, ownerId: meta.ownerId, name: meta.name },
        personId,
      );
    },
    anonymise: async (documentId: string, personId: string, guestKeys: readonly string[] = []) =>
      (await import('./document-room/document-anonymise')).anonymiseDocument(
        env,
        documentId,
        personId,
        guestKeys,
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
  }));
}

// What a copy does to the canvases' tables (the copy RPCs plus the new canvas's start), for tests that assert on the
// copied rows: `exportDocumentCopy` from the source, `importDocumentCopy` and `initDocument` on the new id.
export async function testCopyDocument(
  env: DocumentEnv,
  sourceId: string,
  newId: string,
  owner: string,
  name: string,
  onlyTabId: string | null = null,
  redactForCommunity = false,
): Promise<import('./types').DocumentDTO | null> {
  const content = await import('./document-room/document-content');
  const copy = await content.exportDocumentCopy(env, sourceId, onlyTabId, null, redactForCommunity);
  if (!copy) return null;
  await content.importDocumentCopy(env, newId, copy);
  const now = Date.now();
  await content.initDocument(env, newId, {
    name,
    ownerId: owner,
    teamId: null,
    source: null,
    savedAt: now,
    createdAt: now,
  });
  return (await import('./db/documents')).getDocument(env, newId);
}
