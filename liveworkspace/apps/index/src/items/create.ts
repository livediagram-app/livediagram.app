// Making an item (items.ts).

import { inTeamNow } from '../fresh-teams';
import { isApp, ITEM_SOURCES, APP_KINDS, type ItemSource } from '@liveworkspace/index-client';
import { type Person, scopeOf } from '../auth';
import { isId } from '../codec';
import { defaultPlacement } from '../default-placement';
import { touchItem } from '../drive';
import { INTENT_MAX } from '../config';
import type { PersonContext } from '../context';
import type { Env } from '../env';
import { readTitle, getFolderRow } from '../folders';
import { signingKey, mintGrant } from '../grants';
import { readObject, badRequest, forbidden, notFound, fail, conflict, json } from '../http';
import { type ItemRow, type Access, decorate } from '../rows';
import { eventStatements } from '../events';
import { drainTombstonesSoon } from '../purge';
import { DEFAULT_TITLE } from './shared';

export async function itemFor(env: Env, person: Person | null, row: ItemRow, access: Access) {
  const [item] = await decorate(env, person, [row], new Map([[row.id, access]]));
  return item!;
}

export const optionalId = (value: unknown): value is string | null | undefined =>
  value === undefined || value === null || isId(value);

// POST /items: the index makes the id; the item's Durable Object starts empty when first opened with
// the grant.
export async function createItem(ctx: PersonContext): Promise<Response> {
  const { request, env, person } = ctx;
  const body = await readObject(request);
  if (!body) return badRequest();
  if (!isApp(body.app)) return badRequest('invalid_app');
  // An app acting for a person makes its own kind only.
  if (person.app && person.app !== body.app) return forbidden('wrong_app');
  const title = body.title === undefined ? DEFAULT_TITLE : readTitle(body.title);
  if (!title) return badRequest('invalid_title');
  if (!optionalId(body.teamId)) return badRequest('invalid_team');
  if (!optionalId(body.folderId)) return badRequest('invalid_folder');
  // A client may name the id it minted (an offline item synced up, an API client that made one): 409
  // `item_exists` when it is taken, 409 `item_purging` while a purged item of that id still has content in its app
  // (below).
  if (body.id !== undefined && !isId(body.id)) return badRequest('invalid_body');
  const intent = body.intent ?? null;
  if (intent !== null && (typeof intent !== 'string' || intent.length > INTENT_MAX)) {
    return badRequest();
  }
  const source = body.source ?? null;
  if (source !== null && !(ITEM_SOURCES as readonly unknown[]).includes(source))
    return badRequest();
  let teamId = body.teamId ?? null;
  if (teamId && !(await inTeamNow(env, person, teamId))) return forbidden('not_team_member');
  let scope = scopeOf(person.id, teamId);
  let folderId = body.folderId ?? null;
  if (folderId) {
    const folder = await getFolderRow(env, folderId);
    if (!folder || folder.scope !== scope) return notFound('folder_not_found');
  }
  // No place named (no `folderId` key, no team) and an intent: the person's default folder for it, if any.
  if (!('folderId' in body) && teamId === null && intent !== null) {
    const placed = await defaultPlacement(env, person, body.app, intent as string);
    if (placed) ({ folderId, teamId, scope } = placed);
  }
  // Without a key there would be no grant to open it with: refuse before making the row.
  if (!(await signingKey(env))) return fail(503, 'grants_unavailable');

  const now = Date.now();
  const row: ItemRow = {
    id: (body.id as string | undefined) ?? crypto.randomUUID(),
    app: body.app,
    kind: APP_KINDS[body.app],
    owner_id: person.id,
    team_id: teamId,
    scope,
    folder_id: folderId,
    title,
    source: source as ItemSource | null,
    intent: intent as string | null,
    summary: '{}',
    created_at: now,
    updated_at: now,
    trashed_at: null,
    trash_reason: null,
    archived_at: null,
  };
  // A named id whose purged item is still waiting for its app to drop the content: ask the app now, so an offline
  // item put back under its own id is not kept waiting for the cron. insertItem refuses while the tombstone stands.
  if (body.id !== undefined && (await isPurging(env, row.id)))
    await drainTombstonesSoon(env, [row.id]);
  try {
    await insertItem(
      env,
      row,
      row.source && row.source !== 'person' ? { source: row.source } : null,
      body.synced === true ? 'synced' : 'created',
    );
  } catch (err) {
    if (err instanceof ItemPurgingError) return conflict('item_purging');
    if (String(err).includes('UNIQUE')) return conflict('item_exists');
    throw err;
  }
  touchItem(ctx.drive, row);
  const access: Access = { level: 'edit', tabId: null, via: 'owner', code: null };
  const grant = await mintGrant(env, {
    app: row.app,
    sub: person.id,
    itemId: row.id,
    level: 'edit',
    tabId: null,
    ownerId: row.owner_id,
    teamId,
  });
  console.info('[index] created', {
    app: row.app,
    team: teamId !== null,
    filed: !('folderId' in body) && folderId !== null ? 'default' : 'given',
  });
  return json({ item: await itemFor(env, person, row, access), grant }, { status: 201 });
}

/** An id whose purged item's content its app has not dropped yet (a `purge_tombstones` row): no item is made under
 *  it. The app keeps content by item id and serves it to whoever the index says may read the item, so a new row
 *  would hand the purged item's content to whoever made it, and the pending purge would then wipe what they saved. */
export class ItemPurgingError extends Error {
  constructor() {
    super('item_purging');
  }
}

const isPurging = async (env: Env, id: string): Promise<boolean> =>
  (await env.INDEX_DB.prepare('SELECT 1 FROM purge_tombstones WHERE item_id = ?')
    .bind(id)
    .first()) !== null;

// The row, and its `created` event (`synced` for an offline item put back) in the same batch. The migration's
// handoff makes its items with it too (migration-handoff.ts). The row is made only when its id has no tombstone, in
// the insert itself, so a purge landing at the same moment cannot slip a row in (ItemPurgingError); the event reads
// the row, so none is written without it.
export async function insertItem(
  env: Env,
  row: ItemRow,
  detail: Record<string, string | null> | null = null,
  type: 'created' | 'synced' = 'created',
): Promise<void> {
  const db = env.INDEX_DB;
  const insert = db
    .prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, source, intent, summary,
       created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM purge_tombstones WHERE item_id = ?)`,
    )
    .bind(
      row.id,
      row.app,
      row.kind,
      row.owner_id,
      row.team_id,
      row.scope,
      row.folder_id,
      row.title,
      row.source,
      row.intent,
      row.summary,
      row.created_at,
      row.updated_at,
      row.id,
    );
  const [made] = await db.batch([
    insert,
    ...eventStatements(db, {
      itemId: row.id,
      type,
      actorId: row.owner_id,
      detail,
      at: row.created_at,
    }),
  ]);
  if ((made?.meta.changes ?? 0) === 0) throw new ItemPurgingError();
}

// /items/:id and below.
