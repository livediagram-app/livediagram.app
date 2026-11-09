// Making an item (items.ts).

import { inTeamNow } from '../fresh-teams';
import {
  isApp,
  TITLE_MAX,
  ITEM_SOURCES,
  APP_KINDS,
  type ItemSource,
} from '@liveworkspace/index-client';
import { type Person, scopeOf } from '../auth';
import { isId } from '../codec';
import { defaultPlacement } from '../default-placement';
import { touchItem } from '../drive';
import { INTENT_MAX } from '../config';
import type { PersonContext } from '../context';
import type { Env } from '../env';
import { readName, getFolderRow } from '../folders';
import { signingKey, mintGrant } from '../grants';
import { readObject, badRequest, forbidden, notFound, fail, conflict, json } from '../http';
import { type ItemRow, type Access, decorate } from '../rows';
import { eventStatements } from '../timeline';
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
  const title = body.title === undefined ? DEFAULT_TITLE : readName(body.title, TITLE_MAX);
  if (!title) return badRequest('invalid_title');
  if (!optionalId(body.teamId)) return badRequest('invalid_team');
  if (!optionalId(body.folderId)) return badRequest('invalid_folder');
  // A client may name the id it minted (an offline item synced up, an API client that made one): 409
  // `item_exists` when it is taken.
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
  try {
    await insertItem(
      env,
      row,
      row.source && row.source !== 'person' ? { source: row.source } : null,
      body.synced === true ? 'synced' : 'created',
    );
  } catch (err) {
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
  console.log('[index] created', {
    app: row.app,
    team: teamId !== null,
    filed: !('folderId' in body) && folderId !== null ? 'default' : 'given',
  });
  return json({ item: await itemFor(env, person, row, access), grant }, { status: 201 });
}

// The row, and its `created` event (`synced` for an offline item put back) in the same batch. The migration's
// handoff makes its items with it too (migration-handoff.ts).
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
       created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    );
  await db.batch([
    insert,
    ...eventStatements(db, {
      itemId: row.id,
      type,
      actorId: row.owner_id,
      detail,
      at: row.created_at,
    }),
  ]);
}

// /items/:id and below.
