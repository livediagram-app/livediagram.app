import { DatabaseSync } from 'node:sqlite';
import { ItemDb } from '@liveworkspace/index-app';
import { migrateDesignSchema } from './design-room/design-schema';
import {
  bindTestRooms,
  nodeItemSql,
  nodeTransaction,
  testIndexGrant,
  testItemGrant,
  testListFolders,
  testOutboxFlush,
  testRequestGrant as requestTestGrant,
  testRoomNamespace,
  type TestGrantCaller,
} from '@liveworkspace/index-app/testing';
import type { AccessLevel } from '@livedesign/api-schema';
import type { GrantCaller, GrantOutcome, DesignGrant } from './index-service';
import type { IndexClient, ShareAccess } from '@liveworkspace/index-client';
import type { Env, DesignEnv } from './types';

// A real store for tests: an in-memory SQLite database holding the designs' content (docs/specs/015-api/api.md
// "Storage"), which in production is each design's own Durable Object. Every design's tables sit in the one
// database, behind `env.DESIGN_DB`, so a test arranges and asserts on them through one handle, and a handler runs as
// it does inside a design's object. Foreign keys are on, as in the objects.
//
// `env.DESIGN_ROOM` answers the design RPCs (design-client.ts) from those same tables, and hands `fetch` (the room's
// relays) to the DESIGN_ROOM the test passed, if any. What the index holds in production (designs' rows, share
// links, folders) is scaffolded in TEMP tables below. `flush` drains what the designs owe the index and the media
// service (design-outbox.ts), as each design's alarm would.
//
// Not a `.test.ts` file, so vitest doesn't collect it as a suite.

export type SqliteD1 = {
  // The worker's bindings and the designs' (DESIGN_DB): every content module runs against it.
  env: DesignEnv;
  // The raw handle, for arranging rows and asserting on them directly.
  sql: DatabaseSync;
  // Drain the designs' outboxes now, as their alarms would.
  flush: () => Promise<void>;
};

export function sqliteD1(base: Partial<Env> = {}): SqliteD1 {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  const designSql = nodeItemSql(sql);
  migrateDesignSchema((q) => designSql.exec(q));
  // Test scaffolding for what the index holds in production (liveworkspace/docs/specs/004-index/one-explorer.md): `test_designs`
  // writes a started design's own row (what a create writes), and `test_share_links` holds the links the index
  // would grant through. `testGrantFor` (below) reads both, as the index's access rule does.
  sql.exec(`CREATE TEMP VIEW test_designs AS
    SELECT id, owner_id, name, team_id, source, saved_at, created_at, opens_in, tab_kind,
           0 AS shareable, NULL AS folder_id
      FROM design`);
  sql.exec(`CREATE TEMP TRIGGER test_designs_insert INSTEAD OF INSERT ON test_designs
    BEGIN
      INSERT INTO design (id, owner_id, name, team_id, source, saved_at, created_at, opens_in, tab_kind)
      VALUES (NEW.id, NEW.owner_id, COALESCE(NEW.name, ''), NEW.team_id, NEW.source, COALESCE(NEW.saved_at, 0),
              MAX(COALESCE(NEW.created_at, 1), 1), NEW.opens_in, NEW.tab_kind)
      ON CONFLICT (id) DO UPDATE SET owner_id = excluded.owner_id, name = excluded.name,
        team_id = excluded.team_id, source = excluded.source, saved_at = excluded.saved_at,
        created_at = excluded.created_at;
    END`);
  sql.exec(`CREATE TEMP TABLE test_folders (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, team_id TEXT NULL, parent_id TEXT NULL, name TEXT NOT NULL)`);
  sql.exec(`CREATE TEMP TABLE test_share_links (
    code TEXT PRIMARY KEY, design_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'edit', level TEXT NULL,
    tab_id TEXT NULL, created_at INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NULL, expiry TEXT NULL)`);

  // Drain what the designs owe the index and the media service now, as each design's alarm would.
  const flush = testOutboxFlush(sql, {
    itemColumn: 'design_id',
    mode: 'each',
    drain: async (id) => (await import('./design-room/design-outbox')).drainOutbox(env, id),
  });

  const designDb = new ItemDb(designSql, {
    transaction: nodeTransaction(sql),
    ensureSchema: () => {},
    onWrite: () => {},
  });
  const env = { ...base, DESIGN_DB: designDb.asD1() } as unknown as DesignEnv;
  Object.defineProperty(env, TEST_GRANT_HOOK, {
    value: (designId: string, who: TestGrantCaller) => testGrantFor(sql, designId, who),
    enumerable: false,
  });
  Object.defineProperty(env, TEST_SQL, { value: sql, enumerable: false });
  // A test that sets env.DESIGN_ROOM later (its relay recorder) gets it wrapped the same way.
  bindTestRooms(env, 'DESIGN_ROOM', base.DESIGN_ROOM, (rooms) => testDesignRooms(env, sql, rooms));
  return { env, sql, flush };
}

const TEST_SQL = '__testSql';

// The index as a test's caller reaches it (index-service.ts `indexFor` and `requestGrant`, mocked with these): its
// grants by `testGrantFor`'s rule, and the folders in `test_folders` (a person's own, and their teams').
export function testIndexFor(env: unknown, caller: GrantCaller): IndexClient | null {
  const sql = (env as Record<string, unknown>)[TEST_SQL] as DatabaseSync | undefined;
  if (!sql) return null;
  const person = caller.kind === 'delegate' ? caller.personId : null;
  const teams = caller.kind === 'delegate' ? caller.teams : [];
  const client: Partial<IndexClient> = {
    grant: testIndexGrant((itemId, who) => testGrantFor(sql, itemId, who), person, teams),
    listFolders: testListFolders(sql, person, teams),
  };
  return client as IndexClient;
}

export async function testRequestGrant(
  env: unknown,
  caller: GrantCaller,
  designId: string,
  share: ShareAccess | null,
): Promise<GrantOutcome> {
  return requestTestGrant(testIndexFor(env, caller), designId, share);
}

// What the index would grant on a design in a test (test-route-context.ts): the owner and a member of its team
// edit; a live `test_share_links` code grants its level, on its tab. A create (no started design yet) is the
// caller's own. Null for anything else.
export const TEST_GRANT_HOOK = '__testGrant';

export type { TestGrantCaller };

function testGrantFor(sql: DatabaseSync, itemId: string, who: TestGrantCaller): DesignGrant | null {
  return testItemGrant(sql, itemId, who, {
    item: 'design',
    linkColumn: 'design_id',
    linkLevel: true,
  }) as DesignGrant | null;
}

// The design RPCs (design-client.ts) over the shared tables, and the room's `fetch` handed to the test's own
// DESIGN_ROOM (a recorder of relays), or answered 404 without one.
function testDesignRooms(
  env: DesignEnv,
  sql: DatabaseSync,
  rooms: DurableObjectNamespace | undefined,
): DurableObjectNamespace {
  // The design's Community post's link as the room reads it (design-room.ts communityOf).
  const communityOf = async (designId: string) => {
    const cp = await import('./design-room/community-post');
    const post = await cp.readCommunityPost(env);
    if (!post) return null;
    const meta = await (await import('./design-room/design-content')).readDesignMeta(env, designId);
    return { code: post.shareCode, open: cp.openCommunityCode(env, post, meta) === post.shareCode };
  };
  // The post when `code` is its open link (design-room.ts openPost).
  const openPost = async (designId: string, code: string) => {
    const post = await communityOf(designId);
    if (!post || post.code !== code || !post.open) return null;
    return (await import('./design-room/community-post')).readCommunityPost(env);
  };
  return testRoomNamespace(rooms, (id, roomOf) => ({
    outline: async (designId: string) =>
      (await import('./design-room/design-content')).readDesignOutline(env, designId),
    route: async (designId: string, request: Request, identity: unknown) =>
      (await import('./design-room/design-route')).answerDesignRequest(
        env,
        request,
        identity as never,
        () => {},
        await communityOf(designId),
      ),
    exportImage: async (
      designId: string,
      query: { tabId: string | null; code: string | null; ifVersion: number | null },
    ) => {
      const { meta, savedAt } = await (
        await import('./design-room/design-content')
      ).readDesignHead(env, designId);
      if (!meta) return { status: 'not_found' };
      // A Community post's link draws only while the post is open (design-room.ts exportImage).
      const post = query.code ? await communityOf(designId) : null;
      const onPost = post !== null && post.code === query.code;
      if (onPost && !post.open) return { status: 'not_found' };
      if (query.ifVersion === savedAt) return { status: 'unchanged', version: savedAt };
      if (
        query.tabId !== null &&
        !(await (await import('./db/tabs')).designHasTab(env, designId, query.tabId))
      ) {
        return { status: 'not_found' };
      }
      const svg = await (
        await import('./thumbnail')
      ).drawDesign(env, { id: designId, name: meta.name }, query.tabId, { community: onPost });
      return svg === null
        ? { status: 'empty', version: savedAt }
        : {
            status: 'ok',
            body: svg,
            contentType: 'image/svg+xml; charset=utf-8',
            version: savedAt,
          };
    },
    heldBlobs: async (_designId: string, tabId: string, ids: string[]) =>
      (await import('./db/photo-blobs')).heldBlobs(env, tabId, ids),
    servesImage: async (designId: string, imageId: string, onlyTabId: string | null) =>
      (await import('./db/image-grants')).designServesImage(env, designId, imageId, onlyTabId),
    grantOwnImages: async (_designId: string, ids: string[], personId: string) =>
      (await import('./db/image-grants')).grantOwnImages(env, ids, personId, Date.now()),
    // The Drive file's two halves (design-room.ts exportFile and importFile).
    exportFile: async (designId: string, query: { ifVersion: number | null }) =>
      (await import('./design-room/design-file')).exportDesignFile(env, designId, query.ifVersion),
    // The data export's comment threads (design-room.ts exportComments).
    exportComments: async (designId: string) =>
      (await import('./design-room/design-comments')).exportDesignComments(env, designId),
    importFile: async (designId: string, file: unknown) =>
      (await import('./design-room/design-file')).importDesignFile(env, designId, file as never),
    hasTab: async (designId: string, tabId: string) =>
      (await import('./db/tabs')).designHasTab(env, designId, tabId),
    exportCopy: async (
      designId: string,
      onlyTabId: string | null,
      copier: { by: string | null; code: string | null } | null,
    ) => {
      const post = copier?.code ? await communityOf(designId) : null;
      const community = post !== null && post.open && post.code === copier?.code;
      const copy = await (
        await import('./design-room/design-content')
      ).exportDesignCopy(env, designId, onlyTabId, copier?.by ?? null, community);
      return copy ? { copy, community } : null;
    },
    community: (designId: string) => communityOf(designId),
    communityPostTitle: async (designId: string, code: string) =>
      (await openPost(designId, code))?.title ?? null,
    communityListing: async (designId: string, code: string) => {
      const stored = await openPost(designId, code);
      if (!stored) return null;
      const cp = await import('./design-room/community-post');
      return { postId: stored.postId, author: await cp.communityPostAuthor(env, stored) };
    },
    joined: async (designId: string, personId: string) => {
      const meta = await (
        await import('./design-room/design-content')
      ).readDesignMeta(env, designId);
      if (!meta) return;
      await (
        await import('./email/notifications')
      ).notifyDesignJoin(env, { id: designId, ownerId: meta.ownerId, name: meta.name }, personId);
    },
    importCopy: async (designId: string, copy: unknown) =>
      (await import('./design-room/design-content')).importDesignCopy(env, designId, copy as never),
    // Everything the design stored goes, and the room hears it as it did (its `/purge`).
    purge: async (designId: string) => {
      sql.exec('SAVEPOINT purge');
      try {
        sql
          .prepare(
            `DELETE FROM tabs WHERE id IN (SELECT tab_id FROM design_tabs WHERE design_id = ?)`,
          )
          .run(designId);
        sql.prepare('DELETE FROM design WHERE id = ?').run(designId);
        sql.prepare('DELETE FROM outbox WHERE design_id = ?').run(designId);
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

// A share link the index would grant through, for a test (as the index's createShareLink was called).
export function testShareLink(
  db: SqliteD1,
  designId: string,
  code: string,
  role: AccessLevel,
  _expiry: string = 'never',
  tabId: string | null = null,
): void {
  db.sql
    .prepare(
      'INSERT INTO test_share_links (code, design_id, role, level, tab_id, created_at) VALUES (?, ?, ?, ?, ?, 1)',
    )
    .run(code, designId, role, role, tabId);
}

// A copy as the index makes one (its `copy-to` call, routes/internal-items.ts), then opened by its new owner, as
// copyDesign did in one step: the source's content into the new design, which starts as `owner`'s, named `name`.
export async function testCopyDesign(
  env: DesignEnv,
  sourceId: string,
  newId: string,
  owner: string,
  name: string,
  onlyTabId: string | null = null,
  copierId: string | null = null,
): Promise<import('./types').DesignDTO | null> {
  const content = await import('./design-room/design-content');
  const copy = await content.exportDesignCopy(env, sourceId, onlyTabId, copierId);
  if (!copy) return null;
  await content.importDesignCopy(env, newId, copy);
  const now = Date.now();
  await content.initDesign(env, newId, {
    name,
    ownerId: owner,
    teamId: null,
    source: null,
    opensIn: null,
    tabKind: null,
    savedAt: now,
    createdAt: now,
  });
  return (await import('./db/designs')).getDesign(env, newId);
}
