// Project kits on the index (liveworkspace/docs/specs/004-index/kits.md, its blueprint): `POST /kits` starts a kit
// (or finishes one partly made) for a signed-in person: a folder of their own, an item from a template in each part's
// app through its template door, and every part connected to every other both ways (kit-connections.ts).
// `POST /kits/remove` deletes for good what a run made, and its folder when nothing else is in it.

import {
  kitById,
  kitPartTitle,
  readKitRemoveInput,
  readKitStartInput,
  type Kit,
  type KitPart,
  type KitRun,
} from '@liveworkspace/index-client';
import { callAppForJson, eachLimited } from './app-calls';
import { personalScope, type Person } from './auth';
import { isId } from './codec';
import { APP_CALL_CONCURRENCY, KIT_CREATE_TIMEOUT_MS } from './config';
import { isDelegate } from './connections';
import type { PersonContext } from './context';
import { touchItem } from './drive';
import type { Env } from './env';
import { getFolderRow, type FolderRow } from './folders';
import { badRequest, forbidden, json, noContent, notFound, readObject } from './http';
import { connectKitParts } from './kit-connections';
import { drainTombstonesSoon, purgeRows } from './purge';
import { getItemRow, type ItemRow } from './rows';

export async function handleKits(ctx: PersonContext): Promise<Response> {
  const { request, segments, person } = ctx;
  if (request.method !== 'POST') return notFound();
  // Agents make items through their own apps; a kit is a person's, by their own token.
  if (isDelegate(person)) return forbidden();
  // A guest cannot keep the folder, items and links a kit makes.
  if (person.kind === 'guest') return forbidden('sign_in_required');
  if (segments.length === 1) return startKit(ctx);
  if (segments.length === 2 && segments[1] === 'remove') return removeKit(ctx);
  return notFound();
}

// A folder of the person's own: personal, theirs.
async function ownFolder(env: Env, person: Person, id: string): Promise<FolderRow | null> {
  const row = await getFolderRow(env, id);
  return row && row.scope === personalScope(person.id) ? row : null;
}

// A new folder at the top of the person's My Work, as POST /folders makes one.
async function newFolder(env: Env, person: Person, name: string): Promise<FolderRow> {
  const now = Date.now();
  const row: FolderRow = {
    id: crypto.randomUUID(),
    name,
    parent_id: null,
    owner_id: person.id,
    team_id: null,
    scope: personalScope(person.id),
    created_at: now,
    updated_at: now,
  };
  await env.INDEX_DB.prepare(
    `INSERT INTO folders (id, name, parent_id, owner_id, team_id, scope, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(row.id, row.name, null, row.owner_id, null, row.scope, now, now)
    .run();
  return row;
}

// An item that counts as a run's part: live, the person's own (not a team's), in the run's folder, of the part's app.
const isOwnPart = (
  row: ItemRow | null,
  person: Person,
  folderId: string,
  part: KitPart,
): row is ItemRow =>
  !!row &&
  row.owner_id === person.id &&
  row.team_id === null &&
  row.folder_id === folderId &&
  row.app === part.app &&
  row.trashed_at === null &&
  row.archived_at === null;

// A retry's parts already made, each checked; one that does not check is made again.
async function madeParts(
  env: Env,
  person: Person,
  kit: Kit,
  folderId: string,
  made: Record<string, string>,
): Promise<Map<string, ItemRow>> {
  const out = new Map<string, ItemRow>();
  await Promise.all(
    kit.parts.map(async (part) => {
      const id = made[part.slot];
      if (!id) return;
      const row = await getItemRow(env, id);
      if (isOwnPart(row, person, folderId, part)) out.set(part.slot, row);
    }),
  );
  return out;
}

// One part, through its app's template door: the item the app made, as the index now holds it, or null.
async function makePart(
  env: Env,
  person: Person,
  folderId: string,
  project: string,
  part: KitPart,
): Promise<ItemRow | null> {
  const res = await callAppForJson(
    env,
    part.app,
    '/items/from-template',
    { owner: person.id, folderId, name: kitPartTitle(project, part), template: part.template },
    KIT_CREATE_TIMEOUT_MS,
  );
  const id = res.ok ? res.body.id : undefined;
  const row = isId(id) ? await getItemRow(env, id) : null;
  if (isOwnPart(row, person, folderId, part)) return row;
  console.warn('[kits] part not made', {
    app: part.app,
    error: res.ok ? 'invalid_item' : res.error,
  });
  return null;
}

async function startKit(ctx: PersonContext): Promise<Response> {
  const { env, person } = ctx;
  const input = readKitStartInput(await readObject(ctx.request));
  if (!input) return badRequest();
  const kit = kitById(input.kit);
  const folder = input.folderId
    ? await ownFolder(env, person, input.folderId)
    : await newFolder(env, person, input.name);
  if (!folder) return notFound('folder_not_found');
  touchItem(ctx.drive, folder);

  const made = await madeParts(env, person, kit, folder.id, input.made ?? {});
  const missing = kit.parts.filter((part) => !made.has(part.slot));
  await eachLimited(missing, APP_CALL_CONCURRENCY, async (part) => {
    const row = await makePart(env, person, folder.id, input.name, part);
    if (row) made.set(part.slot, row);
  });
  const rows = kit.parts.flatMap((part) => made.get(part.slot) ?? []);
  const connections =
    rows.length > 1
      ? await connectKitParts(env, person.id, rows, input.level)
      : { made: 0, failed: 0 };
  const run: KitRun = {
    folderId: folder.id,
    parts: kit.parts.map((part) => ({
      slot: part.slot,
      app: part.app,
      itemId: made.get(part.slot)?.id ?? null,
    })),
    connections,
    complete: rows.length === kit.parts.length && connections.failed === 0,
  };
  console.info('[kits] run', {
    kit: kit.id,
    retry: input.folderId !== undefined,
    parts: rows.length,
    of: kit.parts.length,
    connections: connections.made,
    failed: connections.failed,
  });
  return json(run);
}

async function removeKit(ctx: PersonContext): Promise<Response> {
  const { env, person } = ctx;
  const input = readKitRemoveInput(await readObject(ctx.request));
  if (!input) return badRequest();
  const folder = await ownFolder(env, person, input.folderId);
  if (!folder) return notFound('folder_not_found');
  // Only the person's own items in the run's folder; anything else named is left alone.
  const rows = (
    await Promise.all(Object.values(input.made).map((id) => getItemRow(env, id)))
  ).filter(
    (row): row is ItemRow =>
      !!row && row.owner_id === person.id && row.team_id === null && row.folder_id === folder.id,
  );
  if (rows.length > 0) {
    await purgeRows(
      env,
      rows.map((row) => ({ id: row.id, app: row.app })),
      Date.now(),
      { actorId: person.id },
    );
    ctx.waitUntil(
      drainTombstonesSoon(
        env,
        rows.map((row) => row.id),
      ),
    );
  }
  // The folder goes too, once nothing else is in it.
  await env.INDEX_DB.prepare(
    `DELETE FROM folders WHERE id = ?1
       AND NOT EXISTS (SELECT 1 FROM items WHERE folder_id = ?1)
       AND NOT EXISTS (SELECT 1 FROM folders WHERE parent_id = ?1)`,
  )
    .bind(folder.id)
    .run();
  touchItem(ctx.drive, folder);
  console.info('[kits] removed', { items: rows.length });
  return noContent();
}
