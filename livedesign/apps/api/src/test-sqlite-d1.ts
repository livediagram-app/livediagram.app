import { DatabaseSync } from 'node:sqlite';
import { ItemDb } from '@liveworkspace/index-app';
import { migrateDesignSchema } from './design-room/design-schema';
import { nodeItemSql, nodeTransaction } from '@liveworkspace/index-app/testing';
import type { AccessLevel } from '@livedesign/api-schema';
import type { GrantCaller, GrantOutcome, DesignGrant } from './index-service';
import { IndexError, type IndexClient, type ShareAccess } from '@liveworkspace/index-client';
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
  // Test scaffolding for what the index holds in production (liveworkspace/docs/one-explorer.md): `test_designs`
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
  const flush = async (): Promise<void> => {
    const { drainOutbox } = await import('./design-room/design-outbox');
    const designs = sql.prepare('SELECT DISTINCT design_id FROM outbox').all() as {
      design_id: string;
    }[];
    for (const { design_id } of designs) {
      let more = true;
      while (more) more = (await drainOutbox(env, design_id)).more;
    }
  };

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
  let rooms = testDesignRooms(env, sql, base.DESIGN_ROOM);
  Object.defineProperty(env, 'DESIGN_ROOM', {
    enumerable: true,
    get: () => rooms,
    set: (next: DurableObjectNamespace | undefined) => {
      rooms = testDesignRooms(env, sql, next);
    },
  });
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
    grant: async (designId, share) => {
      const grant = testGrantFor(sql, designId, {
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
      };
    },
    listFolders: async () => {
      const rows = sql
        .prepare(
          `SELECT id, owner_id, team_id, parent_id, name FROM test_folders
            WHERE (team_id IS NULL AND owner_id = ?) OR team_id IN (SELECT value FROM json_each(?))`,
        )
        .all(person ?? '', JSON.stringify(teams)) as {
        id: string;
        owner_id: string;
        team_id: string | null;
        parent_id: string | null;
        name: string;
      }[];
      return {
        folders: rows.map((r) => ({
          id: r.id,
          ownerId: r.owner_id,
          teamId: r.team_id,
          parentId: r.parent_id,
          name: r.name,
          createdAt: 0,
          updatedAt: 0,
        })),
        nextCursor: null,
      };
    },
  };
  return client as IndexClient;
}

export async function testRequestGrant(
  env: unknown,
  caller: GrantCaller,
  designId: string,
  share: ShareAccess | null,
): Promise<GrantOutcome> {
  const client = testIndexFor(env, caller);
  if (!client) return { ok: false, status: 503, error: 'index_unavailable' };
  try {
    return { ok: true, grant: await client.grant(designId, share) };
  } catch (err) {
    if (err instanceof IndexError) return { ok: false, status: err.status, error: err.code };
    throw err;
  }
}

// What the index would grant on a design in a test (test-route-context.ts): the owner and a member of its team
// edit; a live `test_share_links` code grants its level, on its tab. A create (no started design yet) is the
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
  designId: string,
  who: TestGrantCaller,
): DesignGrant | null {
  const design = sql
    .prepare('SELECT owner_id, team_id, created_at FROM design WHERE id = ?')
    .get(designId) as { owner_id: string; team_id: string | null; created_at: number } | undefined;
  const grant = (
    level: AccessLevel,
    tab: string | null,
    sub: string,
    code: string | null,
  ): DesignGrant => ({
    item: designId,
    level,
    tab,
    sub,
    team: design?.team_id ?? null,
    exp: Math.floor(Date.now() / 1000) + 600,
    shareCode: code,
    token: `test-grant:${designId}:${sub}`,
  });
  if (!design || !design.created_at)
    return who.create && who.person ? grant('edit', null, who.person, null) : null;
  if (who.person && who.person === design.owner_id) return grant('edit', null, who.person, null);
  if (who.person && design.team_id && who.teams.includes(design.team_id))
    return grant('edit', null, who.person, null);
  if (who.code) {
    const link = sql
      .prepare(
        'SELECT role, level, tab_id, expires_at FROM test_share_links WHERE code = ? AND design_id = ?',
      )
      .get(who.code, designId) as
      | { role: string; level: string | null; tab_id: string | null; expires_at: number | null }
      | undefined;
    if (link && (link.expires_at === null || link.expires_at > Date.now())) {
      const level = (link.level ?? link.role) as AccessLevel;
      return grant(level, link.tab_id, who.person ?? `link:${who.code}`, who.code);
    }
  }
  return null;
}

// The design RPCs (design-client.ts) over the shared tables, and the room's `fetch` handed to the test's own
// DESIGN_ROOM (a recorder of relays), or answered 404 without one.
function testDesignRooms(
  env: DesignEnv,
  sql: DatabaseSync,
  rooms: DurableObjectNamespace | undefined,
): DurableObjectNamespace {
  type FakeId = DurableObjectId & { designName: string; roomId: unknown };
  const roomOf = (id: FakeId) =>
    rooms ? (rooms.get(id.roomId as DurableObjectId) as { fetch: typeof fetch }) : null;
  const ns = {
    idFromName: (name: string): FakeId => ({
      designName: name,
      roomId: rooms ? rooms.idFromName(name) : name,
      name,
      toString: () => name,
      equals: (other: DurableObjectId) => (other as FakeId).designName === name,
    }),
    get: (id: FakeId) => ({
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const room = roomOf(id);
        return room
          ? room.fetch(input, init)
          : Promise.resolve(new Response(null, { status: 404 }));
      },
      outline: async (designId: string) =>
        (await import('./design-room/design-content')).readDesignOutline(env, designId),
      route: async (_designId: string, request: Request, identity: unknown) =>
        (await import('./design-room/design-route')).answerDesignRequest(
          env,
          request,
          identity as never,
          () => {},
        ),
      exportImage: async (
        designId: string,
        query: { tabId: string | null; code: string | null; ifVersion: number | null },
      ) => {
        const { meta, savedAt } = await (
          await import('./design-room/design-content')
        ).readDesignHead(env, designId);
        if (!meta) return { status: 'not_found' };
        if (query.ifVersion === savedAt) return { status: 'unchanged', version: savedAt };
        if (
          query.tabId !== null &&
          !(await (await import('./db/tabs')).designHasTab(env, designId, query.tabId))
        ) {
          return { status: 'not_found' };
        }
        const svg = await (
          await import('./thumbnail')
        ).drawDesign(env, { id: designId, name: meta.name }, query.tabId);
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
      // The Drive file's two halves (design-room.ts exportFile and importFile).
      exportFile: async (designId: string, query: { ifVersion: number | null }) =>
        (await import('./design-room/design-file')).exportDesignFile(env, designId, query.ifVersion),
      importFile: async (designId: string, file: unknown) =>
        (await import('./design-room/design-file')).importDesignFile(env, designId, file as never),
      hasTab: async (designId: string, tabId: string) =>
        (await import('./db/tabs')).designHasTab(env, designId, tabId),
      exportCopy: async (designId: string, onlyTabId: string | null, copierId: string | null) =>
        (await import('./design-room/design-content')).exportDesignCopy(
          env,
          designId,
          onlyTabId,
          copierId,
        ),
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
        (await import('./design-room/design-content')).importDesignCopy(
          env,
          designId,
          copy as never,
        ),
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
    }),
  };
  return ns as unknown as DurableObjectNamespace;
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
