// Connect as tabs on the index (liveworkspace/docs/specs/004-index/connected-tabs.md "Linked from a Send to", its
// blueprint, Work Tracker 1429): after a Send to, the source file and the destination file each get a connected tab
// that opens the other. A linked connection (`connections.linked`) makes no pass, so it widens nothing: the open door
// answers a reader only with the access they already hold. Both tabs go in through the apps' internal doors, so the
// same call serves every picker and liveplanner's agents.
//
//   GET  /items/:id/linked-tabs?with=<other>   how the two files stand, as the person    → 200 LinkedTabsRead
//   POST /items/:id/linked-tabs {targetId}      each file given its tab, as the person   → 201 / 200 LinkedTabsMade

import {
  CONNECTIONS_PER_ITEM,
  itemConnectedTabPath,
  itemConnectedTabsPath,
  levelAtLeast,
  readLinkedTabsInput,
  type App,
  type ConnectedTabWrite,
  type LinkedTabOutcome,
  type LinkedTabSide,
  type LinkedTabsMade,
  type LinkedTabsRead,
} from '@liveworkspace/index-client';
import { loadItem } from './access';
import { callApp, callAppForJson } from './app-calls';
import type { Person } from './auth';
import { isId, isPartId } from './codec';
import { CONNECTION_REVERSE_TIMEOUT_MS } from './config';
import { newConnectionId } from './connection-rows';
import { isDelegate } from './connections';
import type { RouteContext } from './context';
import type { Env } from './env';
import { badRequest, forbidden, json, notFound, readObject, unauthorized } from './http';
import { overRunLimit } from './kits';
import type { ItemRow } from './rows';

type Row = {
  id: string;
  host_item_id: string;
  host_tab_id: string | null;
  pair_id: string | null;
  linked: number;
};

type File = { row: ItemRow; canEdit: boolean };

const UNTITLED = 'Untitled';

// One file as the person reaches it with their own access (owner, team, a link they opened; never a code sent with
// this request), live. Editor on the whole of it may change its tabs.
async function fileOf(env: Env, person: Person, id: string): Promise<File | Response> {
  const loaded = await loadItem(env, id, { person, share: null }, 'view');
  if (loaded instanceof Response) return loaded;
  const { row, access } = loaded;
  if (row.trashed_at !== null || row.archived_at !== null) return notFound();
  const canEdit = levelAtLeast(access.level, 'edit') && access.tabId === null && !access.public;
  return { row, canEdit };
}

// The rows between the two files, either way: at most a host's cap each way.
async function rowsBetween(env: Env, a: string, b: string): Promise<Row[]> {
  const { results } = await env.INDEX_DB.prepare(
    `SELECT id, host_item_id, host_tab_id, pair_id, linked FROM connections
     WHERE (host_item_id = ?1 AND target_item_id = ?2) OR (host_item_id = ?2 AND target_item_id = ?1)
     LIMIT ?3`,
  )
    .bind(a, b, CONNECTIONS_PER_ITEM * 2)
    .all<Row>();
  return results;
}

// A host's tab for the other file: a connection holding a tab, or a linked one on its way in.
const holding = (rows: readonly Row[], host: string): Row | undefined =>
  rows.find((r) => r.host_item_id === host && (r.host_tab_id !== null || r.linked === 1));

const sideOf = (rows: readonly Row[], file: File): LinkedTabSide =>
  holding(rows, file.row.id) ? 'connected' : file.canEdit ? 'can' : 'cannot';

type Pair = { source: File; target: File; rows: Row[] };

// Both files, as the person reaches them, and the rows between them; or why not.
async function pairOf(
  env: Env,
  person: Person,
  sourceId: string,
  targetId: string,
): Promise<Pair | Response> {
  if (!isId(sourceId) || !isId(targetId)) return notFound();
  if (sourceId === targetId) return badRequest('connection_self');
  const source = await fileOf(env, person, sourceId);
  if (source instanceof Response) return source;
  const target = await fileOf(env, person, targetId);
  if (target instanceof Response) return target;
  return { source, target, rows: await rowsBetween(env, sourceId, targetId) };
}

// A linked row from `host` to `target`, with no tab yet: only while the host holds fewer than its cap, and holds no
// tab for the target already (so two links at once make one tab).
function insertLinked(db: D1Database, id: string, host: string, target: string, at: number) {
  return db
    .prepare(
      `INSERT INTO connections (id, host_item_id, host_tab_id, target_item_id, share_code, pair_id, created_at, linked)
       SELECT ?1, ?2, NULL, ?3, NULL, NULL, ?4, 1
       WHERE (SELECT COUNT(*) FROM connections WHERE host_item_id = ?2) < ?5
         AND NOT EXISTS (SELECT 1 FROM connections WHERE host_item_id = ?2 AND target_item_id = ?3
                         AND (host_tab_id IS NOT NULL OR linked = 1))`,
    )
    .bind(id, host, target, at, CONNECTIONS_PER_ITEM);
}

// Two rows made each other's pair, only when both are there and neither has one yet.
const pairStatement = (db: D1Database, a: string, b: string) =>
  db
    .prepare(
      `UPDATE connections SET pair_id = CASE id WHEN ?1 THEN ?2 ELSE ?1 END
       WHERE id IN (?1, ?2) AND pair_id IS NULL
         AND (SELECT COUNT(*) FROM connections WHERE id IN (?1, ?2) AND pair_id IS NULL) = 2`,
    )
    .bind(a, b);

// The host's tab, through its app's internal door. Made: the row learns its tab. Not: the row goes (its pair's
// `pair_id` is cleared by the key).
async function writeTab(
  env: Env,
  id: string,
  host: ItemRow,
  other: ItemRow,
): Promise<LinkedTabOutcome> {
  const write: ConnectedTabWrite = {
    name: other.title.trim() || UNTITLED,
    connection: { id, app: other.app, itemId: other.id },
  };
  const res = await callAppForJson(
    env,
    host.app,
    itemConnectedTabsPath(host.id),
    write,
    CONNECTION_REVERSE_TIMEOUT_MS,
  );
  const tabId = res.ok ? res.body.tabId : undefined;
  const db = env.INDEX_DB;
  if (isPartId(tabId)) {
    await db
      .prepare('UPDATE connections SET host_tab_id = ?, confirmed_at = ? WHERE id = ?')
      .bind(tabId, Date.now(), id)
      .run();
    return 'made';
  }
  console.warn('[index] linked tab not made', {
    app: host.app,
    error: res.ok ? 'invalid_tab' : res.error,
  });
  await db.prepare('DELETE FROM connections WHERE id = ?').bind(id).run();
  return 'unreached';
}

/** Each file given a connected tab that opens the other, as `person` may; one already there is kept. */
export async function linkFiles(
  env: Env,
  person: Person,
  sourceId: string,
  targetId: string,
): Promise<LinkedTabsMade | Response> {
  const pair = await pairOf(env, person, sourceId, targetId);
  if (pair instanceof Response) return pair;
  const { source, target, rows } = pair;
  const sides = { source: sideOf(rows, source), target: sideOf(rows, target) };
  const db = env.INDEX_DB;
  const now = Date.now();
  const wanted = (['source', 'target'] as const)
    .filter((k) => sides[k] === 'can')
    .map((k) => {
      const host = pair[k].row;
      const other = (k === 'source' ? target : source).row;
      return { key: k, id: newConnectionId(), host, other };
    });
  const answer: LinkedTabsMade = {
    source: sides.source === 'can' ? 'cannot' : sides.source,
    target: sides.target === 'can' ? 'cannot' : sides.target,
  };
  if (wanted.length === 0) return answer;

  const statements = wanted.map((w) => insertLinked(db, w.id, w.host.id, w.other.id, now));
  // The pair: both made here, or the one made with the other file's own row towards it, when that has none yet.
  if (wanted.length === 2) statements.push(pairStatement(db, wanted[0]!.id, wanted[1]!.id));
  else {
    const made = wanted[0]!;
    const existing = holding(rows, made.other.id);
    if (existing && existing.pair_id === null)
      statements.push(pairStatement(db, made.id, existing.id));
  }
  const results = await db.batch(statements);

  await Promise.all(
    wanted.map(async (w, i) => {
      if (results[i]!.meta.changes > 0) {
        answer[w.key] = await writeTab(env, w.id, w.host, w.other);
        return;
      }
      const held = await db
        .prepare('SELECT COUNT(*) AS n FROM connections WHERE host_item_id = ?')
        .bind(w.host.id)
        .first<{ n: number }>();
      answer[w.key] = (held?.n ?? 0) >= CONNECTIONS_PER_ITEM ? 'full' : 'connected';
    }),
  );
  console.info('[index] linked tabs', answer);
  return answer;
}

// GET and POST /items/:id/linked-tabs, a person in person.
export async function handleLinkedTabs(ctx: RouteContext, sourceId: string): Promise<Response> {
  const { request, env, url } = ctx;
  if (request.method !== 'GET' && request.method !== 'POST') return notFound();
  // An account in person: never an app, the Drive mirror or an export acting for one, nor a guest.
  const person = ctx.caller.person;
  if (!person) return unauthorized();
  if (isDelegate(person)) return forbidden();
  if (person.kind !== 'account') return forbidden('sign_in_required');
  if (request.method === 'GET') {
    const targetId = url.searchParams.get('with') ?? '';
    const pair = await pairOf(env, person, sourceId, targetId);
    if (pair instanceof Response) return pair;
    const read: LinkedTabsRead = {
      source: sideOf(pair.rows, pair.source),
      target: sideOf(pair.rows, pair.target),
    };
    return json(read, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const limited = await overRunLimit(env, `linked-tabs:${person.id}`);
  if (limited) return limited;
  const input = readLinkedTabsInput(await readObject(request));
  if (!input) return badRequest();
  const made = await linkFiles(env, person, sourceId, input.targetId);
  if (made instanceof Response) return made;
  const status = made.source === 'made' || made.target === 'made' ? 201 : 200;
  return json(made, { status });
}

// A linked pair goes together (blueprint "Removing a pair"): the other file's app is asked to take its tab away. Best
// effort: the pair's row is gone already, so a tab left behind opens as a copy's would, offering Remove.
export async function tellPairRemoved(
  env: Env,
  pair: { id: string; host_item_id: string; host_app: App },
): Promise<void> {
  const res = await callApp(
    env,
    pair.host_app,
    'DELETE',
    itemConnectedTabPath(pair.host_item_id, pair.id),
  );
  if (!res.ok) console.warn('[index] linked pair tab not removed', { app: pair.host_app });
}
