// Tests only (`@liveworkspace/index-app/testing`): the parts of an app api's test database (each app's
// `test-sqlite-d1.ts`) that stand in for the index and for its items' Durable Objects. What the index holds in
// production (liveworkspace/docs/specs/004-index/one-explorer.md) is scaffolded in TEMP tables there: the items' rows,
// `test_share_links` (the links the index would grant through), `test_folders` (the folders it would list) and, for
// an app that has it, `test_trash`. These read them as the index's access rule does, wrap the test's own room
// namespace (its relay recorder) around the item RPCs, and drain what the items owe the index.

import { AsyncLocalStorage } from 'node:async_hooks';
import type { DatabaseSync } from 'node:sqlite';
import { IndexError, type IndexClient, type ShareAccess } from '@liveworkspace/index-client';

const identifier = (name: string): string => {
  if (!/^\w+$/.test(name)) throw new Error(`test index: ${name} is not a table or column name`);
  return name;
};

/** Who asks the test index for a grant. A create (no started item yet) is the caller's own. */
export type TestGrantCaller = {
  person: string | null;
  teams: readonly string[];
  code: string | null;
  create: boolean;
};

/** How an app's test database holds what the grant rule reads. */
export type TestGrantRule = {
  /** The item's own table: `document`. */
  item: string;
  /** `test_share_links`' item column: `document_id`. */
  linkColumn: string;
  /** The links carry a `level`, read before their `role`. */
  linkLevel?: boolean;
  /** `test_trash`'s item column, for an app whose index keeps a Trash its grants say. */
  trashColumn?: string;
  /** The grant names the item's owner (the caller's own on a create). */
  owner?: boolean;
};

export type TestItemGrant = {
  item: string;
  level: string;
  tab: string | null;
  sub: string;
  team: string | null;
  owner?: string | null;
  exp: number;
  shareCode: string | null;
  token: string;
  trashed?: boolean;
};

// What the index would grant on an item in a test: the owner and a member of its team edit; a live
// `test_share_links` code grants its level, on its tab. A create (no started item yet) is the caller's own. In the
// Trash (an app with one), its owner and team are granted, saying so, and a link reaches nothing. Null for anything
// else.
export function testItemGrant(
  sql: DatabaseSync,
  itemId: string,
  who: TestGrantCaller,
  rule: TestGrantRule,
): TestItemGrant | null {
  const item = sql
    .prepare(`SELECT owner_id, team_id, created_at FROM ${identifier(rule.item)} WHERE id = ?`)
    .get(itemId) as { owner_id: string; team_id: string | null; created_at: number } | undefined;
  const trashed = rule.trashColumn
    ? sql.prepare(`SELECT 1 FROM test_trash WHERE ${identifier(rule.trashColumn)} = ?`).get(itemId)
    : undefined;
  const grant = (
    level: string,
    tab: string | null,
    sub: string,
    code: string | null,
  ): TestItemGrant => ({
    item: itemId,
    level,
    tab,
    sub,
    team: item?.team_id ?? null,
    ...(rule.owner ? { owner: item?.owner_id || (who.create ? who.person : null) } : {}),
    exp: Math.floor(Date.now() / 1000) + 600,
    shareCode: code,
    token: `test-grant:${itemId}:${sub}`,
    ...(trashed ? { trashed: true } : {}),
  });
  if (!item || !item.created_at)
    return who.create && who.person ? grant('edit', null, who.person, null) : null;
  if (who.person && who.person === item.owner_id) return grant('edit', null, who.person, null);
  if (who.person && item.team_id && who.teams.includes(item.team_id))
    return grant('edit', null, who.person, null);
  if (who.code && !trashed) {
    const link = sql
      .prepare(
        `SELECT role, ${rule.linkLevel ? 'level' : 'NULL AS level'}, tab_id, expires_at FROM test_share_links
          WHERE code = ? AND ${identifier(rule.linkColumn)} = ?`,
      )
      .get(who.code, itemId) as
      | { role: string; level: string | null; tab_id: string | null; expires_at: number | null }
      | undefined;
    if (link && (link.expires_at === null || link.expires_at > Date.now())) {
      return grant(
        link.level ?? link.role,
        link.tab_id,
        who.person ?? `link:${who.code}`,
        who.code,
      );
    }
  }
  return null;
}

/** The index client's `grant`, answered by an app's grant rule: a 404 where the rule grants nothing. */
export function testIndexGrant(
  grantFor: (itemId: string, who: TestGrantCaller) => TestItemGrant | null,
  person: string | null,
  teams: readonly string[],
): IndexClient['grant'] {
  return (async (itemId: string, share?: ShareAccess | null) => {
    const grant = grantFor(itemId, { person, teams, code: share?.code ?? null, create: false });
    if (!grant) throw new IndexError(404, 'not_found');
    return {
      grant: grant.token,
      level: grant.level,
      tabId: grant.tab,
      expiresAt: grant.exp * 1000,
      ...(grant.trashed ? { trashed: true as const } : {}),
    };
  }) as IndexClient['grant'];
}

/** The outcome of an app's `requestGrant` from a test index client (null: the index is out of reach). */
export async function testRequestGrant(
  client: IndexClient | null,
  itemId: string,
  share: ShareAccess | null,
): Promise<
  | { ok: true; grant: Awaited<ReturnType<IndexClient['grant']>> }
  | { ok: false; status: number; error: string }
> {
  if (!client) return { ok: false, status: 503, error: 'index_unavailable' };
  try {
    return { ok: true, grant: await client.grant(itemId, share) };
  } catch (err) {
    if (err instanceof IndexError) return { ok: false, status: err.status, error: err.code };
    throw err;
  }
}

/** The index client's `listFolders`: the folders in `test_folders` a person reaches (their own, and their teams'). */
export function testListFolders(
  sql: DatabaseSync,
  person: string | null,
  teams: readonly string[],
): IndexClient['listFolders'] {
  return (async () => {
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
  }) as IndexClient['listFolders'];
}

/** The index client's `folderPreviews`: the named folders in `test_folders` a person reaches, each empty. */
export function testFolderPreviews(
  sql: DatabaseSync,
  person: string | null,
  teams: readonly string[],
): IndexClient['folderPreviews'] {
  return (async (ids: readonly string[]) => {
    const rows = sql
      .prepare(
        `SELECT id FROM test_folders
            WHERE id IN (SELECT value FROM json_each(?))
              AND ((team_id IS NULL AND owner_id = ?) OR team_id IN (SELECT value FROM json_each(?)))`,
      )
      .all(JSON.stringify(ids), person ?? '', JSON.stringify(teams)) as { id: string }[];
    return { previews: rows.map((r) => ({ folderId: r.id, itemCount: 0, items: [] })) };
  }) as IndexClient['folderPreviews'];
}

/** A test room's id: its name, and the id the test's own namespace (its relay recorder) gave it. */
export type TestRoomId = DurableObjectId & { itemName: string; roomId: unknown };

/** The test's own room behind an id, for its relays (`fetch`), or null without one. */
export type TestRoomOf = (id: TestRoomId) => { fetch: typeof fetch } | null;

// The item RPCs an app's room answers, over the test database (`rpcs`), and the room's `fetch` handed to the test's
// own namespace (a recorder of relays), or answered 404 without one.
export function testRoomNamespace(
  rooms: DurableObjectNamespace | undefined,
  rpcs: (id: TestRoomId, roomOf: TestRoomOf) => object,
): DurableObjectNamespace {
  const roomOf: TestRoomOf = (id) =>
    rooms ? (rooms.get(id.roomId as DurableObjectId) as { fetch: typeof fetch }) : null;
  const ns = {
    idFromName: (name: string): TestRoomId =>
      ({
        itemName: name,
        roomId: rooms ? rooms.idFromName(name) : name,
        name,
        toString: () => name,
        equals: (other: DurableObjectId) => (other as TestRoomId).itemName === name,
      }) as TestRoomId,
    get: (id: TestRoomId) => ({
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const room = roomOf(id);
        return room
          ? room.fetch(input, init)
          : Promise.resolve(new Response(null, { status: 404 }));
      },
      ...rpcs(id, roomOf),
    }),
  };
  return ns as unknown as DurableObjectNamespace;
}

// The room binding on a test env (`key`, e.g. `DOCUMENT_ROOM`): the test namespace around the one the test passed,
// and around any it sets later (its relay recorder), wrapped the same way.
export function bindTestRooms(
  env: object,
  key: string,
  given: DurableObjectNamespace | undefined,
  wrap: (rooms: DurableObjectNamespace | undefined) => DurableObjectNamespace,
): void {
  let rooms = wrap(given);
  Object.defineProperty(env, key, {
    enumerable: true,
    get: () => rooms,
    set: (next: DurableObjectNamespace | undefined) => {
      rooms = wrap(next);
    },
  });
}

export type TestOutboxFlush = {
  /** The outbox's item column: `document_id`. */
  itemColumn: string;
  /** Drains one item's outbox once, saying whether it has more. */
  drain: (itemId: string) => Promise<{ more: boolean }>;
  /**
   * `serial` runs one drain at a time (a call made while one runs waits for it, then drains what is left);
   * `reentrant` too, and a call made from inside a drain (by its async context) returns at once; `each` drains on
   * every call.
   */
  mode: 'each' | 'serial' | 'reentrant';
};

// Drain what the items owe (their outboxes), every item with keys, until each is empty, as their alarms would.
export function testOutboxFlush(sql: DatabaseSync, flush: TestOutboxFlush): () => Promise<void> {
  const column = identifier(flush.itemColumn);
  const drainAll = async () => {
    const items = sql.prepare(`SELECT DISTINCT ${column} FROM outbox`).all() as Record<
      string,
      string
    >[];
    for (const row of items) {
      let more = true;
      while (more) more = (await flush.drain(row[column]!)).more;
    }
  };
  if (flush.mode === 'each') return drainAll;
  const inPush = flush.mode === 'reentrant' ? new AsyncLocalStorage<true>() : null;
  let pushing: Promise<void> | null = null;
  return async () => {
    if (inPush?.getStore()) return;
    while (pushing) await pushing;
    if (sql.prepare('SELECT 1 FROM outbox LIMIT 1').all().length === 0) return;
    pushing = inPush ? inPush.run(true, drainAll) : drainAll();
    try {
      await pushing;
    } finally {
      pushing = null;
    }
  };
}
