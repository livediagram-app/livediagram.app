import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseSync } from 'node:sqlite';
import { ItemDb } from '@liveworkspace/index-app';
import {
  memoryWorkbenchNamespace,
  nodeItemSql,
  nodeTransaction,
} from '@liveworkspace/index-app/testing';
import { IndexError, type IndexClient, type ShareAccess } from '@liveworkspace/index-client';
import type { AccessLevel } from '@livediagram/api-schema';
import { accountCredentials } from './auth/accounts';
import { migrateDocumentSchema } from './document-room/document-schema';
import type { GrantCaller, GrantOutcome, ItemGrant } from './index-service';
import { closeWorkbenchSessions } from './room-access-client';
import { testPersonStores } from './test-person-store';
import type { Env, DocumentEnv } from './types';

// The api's storage for tests. A canvas's content (docs/specs/015-api/api.md "Storage") is its own Durable Object in
// production; here every canvas's tables sit in one in-memory SQLite database, behind `env.DOCUMENT_DB`, so a test
// arranges and asserts on them through one handle, and a handler runs as it does inside a canvas's object.
// `env.DOCUMENT_ROOM` answers the canvas RPCs (document-client.ts) from those same tables, and hands `fetch` (the
// room's relays) to the DOCUMENT_ROOM the test passed, if any. `flush` drains what the canvases owe the index and the
// media service (document-outbox.ts), for a test that asserts on those pushes. Each person's stores are in memory.
//
// What the index holds in production (liveworkspace/docs/one-explorer.md) is test scaffolding here: `test_documents`
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

  // Drain what the canvases owe (their outboxes). A call made while a drain runs waits for it; one made from inside
  // the drain (by its async context) returns at once.
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
    grant: async (documentId, share) => {
      const grant = testGrantFor(sql, documentId, {
        person,
        teams,
        code: share?.code ?? null,
        create: false,
      });
      if (!grant) throw new IndexError(404, 'not_found');
      return {
        grant: grant.token,
        level: grant.level,
        tabId: grant.tab,
        expiresAt: grant.exp * 1000,
        ...(grant.trashed ? { trashed: true as const } : {}),
      };
    },
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
    folderPreviews: async (ids) => {
      const rows = sql
        .prepare(
          `SELECT id FROM test_folders
            WHERE id IN (SELECT value FROM json_each(?))
              AND ((team_id IS NULL AND owner_id = ?) OR team_id IN (SELECT value FROM json_each(?)))`,
        )
        .all(JSON.stringify(ids), person ?? '', JSON.stringify(teams)) as { id: string }[];
      return { previews: rows.map((r) => ({ folderId: r.id, itemCount: 0, items: [] })) };
    },
  };
  return client as IndexClient;
}

export async function testRequestGrant(
  env: Env,
  caller: GrantCaller,
  documentId: string,
  share: ShareAccess | null,
): Promise<GrantOutcome> {
  const client = testIndexFor(env, caller);
  if (!client) return { ok: false, status: 503, error: 'index_unavailable' };
  try {
    return { ok: true, grant: await client.grant(documentId, share) };
  } catch (err) {
    if (err instanceof IndexError) return { ok: false, status: err.status, error: err.code };
    throw err;
  }
}

// What the index would grant on a canvas in a test (test-route-context.ts): the owner and a member of its team
// edit; a live `test_share_links` code grants its level, on its tab. A create (no started canvas yet) is the
// caller's own. Null for anything else.
export const TEST_GRANT_HOOK = '__testGrant';

export type TestGrantCaller = {
  person: string | null;
  teams: readonly string[];
  code: string | null;
  create: boolean;
};

function testGrantFor(
  sql: DatabaseSync,
  documentId: string,
  who: TestGrantCaller,
): ItemGrant | null {
  const document = sql
    .prepare('SELECT owner_id, team_id, created_at FROM document WHERE id = ?')
    .get(documentId) as
    { owner_id: string; team_id: string | null; created_at: number } | undefined;
  // In the Trash: its owner and team are granted, saying so; a link reaches nothing.
  const trashed = sql.prepare('SELECT 1 FROM test_trash WHERE document_id = ?').get(documentId);
  const grant = (
    level: AccessLevel,
    tab: string | null,
    sub: string,
    code: string | null,
  ): ItemGrant => ({
    item: documentId,
    level,
    tab,
    sub,
    team: document?.team_id ?? null,
    owner: document?.owner_id || (who.create ? who.person : null),
    exp: Math.floor(Date.now() / 1000) + 600,
    shareCode: code,
    token: `test-grant:${documentId}:${sub}`,
    ...(trashed ? { trashed: true } : {}),
  });
  if (!document || !document.created_at)
    return who.create && who.person ? grant('edit', null, who.person, null) : null;
  if (who.person && who.person === document.owner_id) return grant('edit', null, who.person, null);
  if (who.person && document.team_id && who.teams.includes(document.team_id))
    return grant('edit', null, who.person, null);
  if (who.code && !trashed) {
    const link = sql
      .prepare(
        'SELECT role, tab_id, expires_at FROM test_share_links WHERE code = ? AND document_id = ?',
      )
      .get(who.code, documentId) as
      { role: string; tab_id: string | null; expires_at: number | null } | undefined;
    if (link && (link.expires_at === null || link.expires_at > Date.now())) {
      return grant(
        link.role as AccessLevel,
        link.tab_id,
        who.person ?? `link:${who.code}`,
        who.code,
      );
    }
  }
  return null;
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
  type FakeId = DurableObjectId & { documentName: string; roomId: unknown };
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
      notifyAction: async (documentId: string, input: Record<string, unknown>) => {
        const meta = await (
          await import('./document-room/document-content')
        ).readDocumentMeta(env, documentId);
        if (!meta) return false;
        await (
          await import('./email/notifications')
        ).notifyActionAssigned(env, {
          ...(input as unknown as import('./document-client').ActionNotice),
          document: { id: documentId, name: meta.name },
        });
        return true;
      },
      notifyMention: async (documentId: string, input: Record<string, unknown>) => {
        const meta = await (
          await import('./document-room/document-content')
        ).readDocumentMeta(env, documentId);
        if (!meta) return false;
        await (
          await import('./email/notifications')
        ).notifyMentioned(env, {
          ...(input as unknown as import('./document-client').MentionNotice),
          document: { id: documentId, name: meta.name },
        });
        return true;
      },
      anonymise: async (documentId: string, personId: string) =>
        (await import('./document-room/document-anonymise')).anonymiseDocument(
          env,
          documentId,
          personId,
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
