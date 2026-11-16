// The Library's API (`/api/media/app/library/*`, liveworkspace/docs/specs/006-media/libraries.md "The API"): every
// route a POST whose body carries the actor the app vouches for. The service checks each action against that actor:
// Personal is its owner's alone; a team's library is every member's to see, place from and save to, and its admins'
// alone to tidy.

import {
  LIBRARY_ITEMS_PER_SCOPE_MAX,
  LIBRARY_ITEM_BYTES_MAX,
  LIBRARY_LEGACY_APPS,
  LIBRARY_ITEM_ELEMENTS_MAX,
  LIBRARY_PREVIEW_BYTES_MAX,
  canTidyScope,
  canUseScope,
  elementKinds,
  fitsKinds,
  isLibrarySide,
  libraryImageIds,
  normaliseLibraryFolder,
  normaliseLibraryTitle,
  parseLegacyItemId,
  parseLibraryActor,
  teamMediaOwner,
  withLibraryImageIds,
  type LibraryActor,
  type LibraryLegacyRef,
  type LibraryScope,
  type MediaApp,
} from '@liveworkspace/media';
import type { Env } from '../env';
import { badRequest, json, notFound } from '../http';
import {
  isAccountOwner,
  legacyCopyRows,
  legacyFolderOf,
  legacyKey,
  readAppLegacy,
  readLegacy,
} from './legacy';
import { copyPictures } from './pictures';
import {
  copiedLegacy,
  deleteRows,
  getRow,
  getRowByLegacy,
  insertRows,
  listRows,
  markCopiedStatement,
  renameFolderRows,
  renameRow,
  rowElements,
  rowImages,
  rowToSummary,
  scopeIdOf,
  type LibraryRow,
} from './store';

type Body = Record<string, unknown> & { actor: LibraryActor };

const adminOnly = () => json({ error: 'admin_only' }, { status: 403 });
const libraryFull = () =>
  json({ error: 'library_full', limit: LIBRARY_ITEMS_PER_SCOPE_MAX }, { status: 409 });
const galleryFull = () => json({ error: 'gallery_full' }, { status: 403 });
const encoder = new TextEncoder();

const SCOPES = new Set<LibraryScope>(['personal', 'team']);

export async function handleLibrary(
  env: Env,
  bucket: R2Bucket,
  app: MediaApp,
  route: string,
  raw: unknown,
): Promise<Response> {
  const actor = parseLibraryActor((raw as { actor?: unknown } | undefined)?.actor);
  if (!actor) return badRequest('invalid_body');
  const body = { ...(raw as Record<string, unknown>), actor } as Body;
  switch (route) {
    case 'list':
      return list(env, app, body);
    case 'save':
      return save(env, bucket, app, body);
    case 'place':
      return place(env, bucket, app, body);
    case 'rename':
      return rename(env, app, body);
    case 'rename-folder':
      return renameFolder(env, app, body);
    case 'delete':
      return remove(env, app, body);
  }
  return notFound();
}

async function list(env: Env, app: MediaApp, body: Body): Promise<Response> {
  const { actor } = body;
  const kinds = Array.isArray(body.kinds)
    ? new Set(body.kinds.filter((k): k is string => typeof k === 'string'))
    : null;
  const copied = await copiedLegacy(env, actor.owner);
  const [rows, legacy] = await Promise.all([
    listRows(env, actor),
    readLegacy(env, app, actor.owner, copied),
  ]);
  const all = [...rows.map(rowToSummary), ...legacy.items];
  const items = kinds ? all.filter((item) => fitsKinds(item.kinds, kinds)) : all;
  const own = `${app}~`;
  return json({
    items,
    teams: actor.teams,
    hidden: all.length - items.length,
    legacy: {
      unavailable: legacy.unavailable,
      copied: [...copied].filter((k) => k.startsWith(own)).map((k) => k.slice(own.length)),
      writable: isAccountOwner(actor.owner),
    },
  });
}

// The scope a body names, as `{ scope, scopeId }` for this actor, or null.
function scopeOf(body: Body): { scope: LibraryScope; scopeId: string } | null {
  const scope = body.scope as LibraryScope;
  if (!SCOPES.has(scope)) return null;
  const teamId = typeof body.teamId === 'string' ? body.teamId : null;
  if (scope === 'team' && !teamId) return null;
  return { scope, scopeId: scopeIdOf(body.actor, scope, teamId) };
}

async function save(env: Env, bucket: R2Bucket, app: MediaApp, body: Body): Promise<Response> {
  const { actor } = body;
  const target = scopeOf(body);
  if (!target) return badRequest('invalid_scope');
  // A team the actor isn't in answers as missing.
  if (!canUseScope(actor, target.scope, target.scopeId)) return notFound();
  const title = normaliseLibraryTitle(body.title);
  const folder = normaliseLibraryFolder(body.folder);
  if (!title) return badRequest('invalid_title');
  if (folder === null) return badRequest('invalid_folder');
  if (!isLibrarySide(body.width) || !isLibrarySide(body.height)) return badRequest('invalid_size');
  const raw = body.elements;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > LIBRARY_ITEM_ELEMENTS_MAX) {
    return badRequest('invalid_elements');
  }
  let elements: unknown[] = raw;
  if (encoder.encode(JSON.stringify(elements)).length > LIBRARY_ITEM_BYTES_MAX) {
    return json({ error: 'item_too_large', limitBytes: LIBRARY_ITEM_BYTES_MAX }, { status: 413 });
  }
  const preview =
    typeof body.preview === 'string' &&
    encoder.encode(body.preview).length <= LIBRARY_PREVIEW_BYTES_MAX
      ? body.preview
      : null;
  // Saved to a team: the saver's own pictures are copied into the team's gallery, and the item names the copies.
  if (target.scope === 'team') {
    const copied = await copyPictures(
      env,
      bucket,
      app,
      libraryImageIds(elements),
      actor.owner,
      teamMediaOwner(target.scopeId),
    );
    if ('full' in copied) return galleryFull();
    elements = withLibraryImageIds(elements, copied.copies);
  }
  const row = {
    id: crypto.randomUUID(),
    scope: target.scope,
    scope_id: target.scopeId,
    folder,
    title,
    width: body.width,
    height: body.height,
    kinds: JSON.stringify(elementKinds(elements)),
    elements: JSON.stringify(elements),
    images: JSON.stringify(libraryImageIds(elements)),
    preview,
    app,
    created_by: actor.owner,
    legacy_ref: null,
  };
  if (!(await insertRows(env, [row]))) return libraryFull();
  console.info('[library] saved', { app, scope: target.scope, elements: elements.length });
  const stored = await getRow(env, row.id);
  return json({ item: rowToSummary(stored!) }, { status: 201 });
}

// A shape library read in place, from its app's door: null when it is gone, or the door failed.
async function readLegacyLibrary(
  env: Env,
  owner: string,
  ref: Pick<LibraryLegacyRef, 'app' | 'libraryId'>,
) {
  if (!isAccountOwner(owner)) return null;
  const libraries = await readAppLegacy(env, ref.app, owner);
  return libraries?.find((l) => l.id === ref.libraryId) ?? null;
}

async function place(env: Env, bucket: R2Bucket, app: MediaApp, body: Body): Promise<Response> {
  const { actor } = body;
  const id = typeof body.id === 'string' ? body.id : '';
  const ref = parseLegacyItemId(id);
  if (ref) {
    const library = await readLegacyLibrary(env, actor.owner, ref);
    const item = library?.items.find((i) => i.id === ref.itemId);
    if (!item) return notFound();
    return json({ elements: item.elements, width: item.width, height: item.height });
  }
  const row = await getRow(env, id);
  if (!row || !canUseScope(actor, row.scope, row.scope_id)) return notFound();
  let elements = rowElements(row);
  // Placed from a team: its pictures are copied into the placer's gallery, so the canvas serves them by its own rule.
  if (row.scope === 'team') {
    const copied = await copyPictures(
      env,
      bucket,
      app,
      rowImages(row),
      teamMediaOwner(row.scope_id),
      actor.owner,
    );
    if ('full' in copied) return galleryFull();
    elements = withLibraryImageIds(elements, copied.copies);
  }
  return json({ elements, width: row.width, height: row.height });
}

// The item an id names for a tidy: a stored row, or a shape library's item copied into the Library first (the first
// write copies the whole library). Null when there is none the actor can see.
async function tidyTarget(env: Env, body: Body): Promise<LibraryRow | null | 'full'> {
  const { actor } = body;
  const id = typeof body.id === 'string' ? body.id : '';
  const ref = parseLegacyItemId(id);
  if (!ref) {
    const row = await getRow(env, id);
    return row && canUseScope(actor, row.scope, row.scope_id) ? row : null;
  }
  const legacyRef = `${ref.app}~${ref.libraryId}~${ref.itemId}`;
  const copied = await getRowByLegacy(env, actor.owner, legacyRef);
  if (copied) return copied;
  const library = await readLegacyLibrary(env, actor.owner, ref);
  if (!library) return null;
  const done = await copyLegacy(env, actor.owner, ref.app, library);
  if (!done) return 'full';
  return getRowByLegacy(env, actor.owner, legacyRef);
}

async function copyLegacy(
  env: Env,
  owner: string,
  app: MediaApp,
  library: Parameters<typeof legacyCopyRows>[2],
): Promise<boolean> {
  const rows = legacyCopyRows(app, owner, library);
  const ok = await insertRows(env, rows, [
    markCopiedStatement(env, owner, legacyKey(app, library.id)),
  ]);
  if (ok)
    console.info('[library] copied a shape library on first write', { app, items: rows.length });
  return ok;
}

async function rename(env: Env, app: MediaApp, body: Body): Promise<Response> {
  const title = normaliseLibraryTitle(body.title);
  if (!title) return badRequest('invalid_title');
  const row = await tidyTarget(env, body);
  if (row === 'full') return libraryFull();
  if (!row) return notFound();
  if (!canTidyScope(body.actor, row.scope, row.scope_id)) return adminOnly();
  const renamed = await renameRow(env, row.id, title);
  console.info('[library] renamed', { app, scope: row.scope });
  return json({ item: rowToSummary(renamed!) });
}

async function remove(env: Env, app: MediaApp, body: Body): Promise<Response> {
  const row = await tidyTarget(env, body);
  if (row === 'full') return libraryFull();
  if (!row) return notFound();
  if (!canTidyScope(body.actor, row.scope, row.scope_id)) return adminOnly();
  await deleteRows(env, [row.id]);
  console.info('[library] deleted', { app, scope: row.scope });
  return json({ ok: true });
}

async function renameFolder(env: Env, app: MediaApp, body: Body): Promise<Response> {
  const { actor } = body;
  const target = scopeOf(body);
  if (!target) return badRequest('invalid_scope');
  if (!canUseScope(actor, target.scope, target.scopeId)) return notFound();
  if (!canTidyScope(actor, target.scope, target.scopeId)) return adminOnly();
  const from = normaliseLibraryFolder(body.from);
  const to = normaliseLibraryFolder(body.to);
  if (from === null || to === null || to === '') return badRequest('invalid_folder');
  // A Personal folder may hold shape libraries read in place: each is copied in first, so the rename takes them too.
  if (target.scope === 'personal' && isAccountOwner(actor.owner)) {
    const copied = await copiedLegacy(env, actor.owner);
    for (const legacyApp of LIBRARY_LEGACY_APPS) {
      const libraries = await readAppLegacy(env, legacyApp, actor.owner);
      for (const library of libraries ?? []) {
        if (copied.has(legacyKey(legacyApp, library.id))) continue;
        if (legacyFolderOf(library.name) !== from) continue;
        if (!(await copyLegacy(env, actor.owner, legacyApp, library))) return libraryFull();
      }
    }
  }
  const renamed = await renameFolderRows(env, target.scope, target.scopeId, from, to);
  console.info('[library] renamed a folder', { app, scope: target.scope, items: renamed });
  return json({ renamed });
}
