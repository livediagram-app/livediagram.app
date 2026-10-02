// /api/placement-defaults: a person's default folders (docs/specs/013-workspace/default-folders.md,
// blueprint docs/specs/013-workspace/blueprints/default-folders.md "Interfaces and contracts").
//
// GET    /api/placement-defaults       -> { defaults: { key, folderId }[] }
// PUT    /api/placement-defaults/:key  -> 204, body { folderId }
// DELETE /api/placement-defaults/:key  -> 204
//
// Hybrid identity like the rest of the api, so guests have defaults too. A default points only at
// the caller's own personal folder or a folder of a team they have joined, membership read by the
// verified account id; anything else is `folder_not_found`, revealing nothing. Writes ride the
// per-owner write rate limit in index.ts.

import {
  isPlacementDefaultKey,
  type PlacementDefaultKey,
  type PlacementDefaultRejection,
} from '@livediagram/api-schema';
import { clearPlacementDefault, listPlacementDefaults, setPlacementDefault } from '../db';
import { joinedFolderTeam, judgeDefaultFolder } from '../placement/default-folder';
import {
  logDefaultCleared,
  logDefaultRejected,
  logDefaultSet,
  placementScope,
} from '../placement/placement-log';
import { placementLookups } from '../placement/placement-lookups';
import { json, noContent, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';

const REJECTION_STATUS: Record<PlacementDefaultRejection | 'folder_not_found', number> = {
  default_key_invalid: 400,
  default_folder_invalid: 400,
  folder_not_found: 404,
};

function rejected(reason: PlacementDefaultRejection | 'folder_not_found'): Response {
  logDefaultRejected(reason);
  return json({ error: reason }, { status: REJECTION_STATUS[reason] });
}

/** The key a path segment names, raw (`mode:draw`) or percent-encoded (`mode%3Adraw`). */
function keyOf(segment: string): PlacementDefaultKey | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }
  return isPlacementDefaultKey(decoded) ? decoded : null;
}

/** The `folderId` of a PUT body, or null when the body is not `{ folderId: <non-empty string> }`. */
async function folderIdOf(request: Request): Promise<string | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const { folderId } = body as { folderId?: unknown };
  return typeof folderId === 'string' && folderId !== '' ? folderId : null;
}

async function setDefault(ctx: RouteContext, owner: string, key: PlacementDefaultKey) {
  const folderId = await folderIdOf(ctx.request);
  if (folderId === null) return rejected('default_folder_invalid');
  const lookups = placementLookups(ctx.env);
  const caller = { ownerId: owner, verifiedUserId: ctx.verifiedUserId };
  const folder = await lookups.getFolder(folderId);
  const joined = await joinedFolderTeam(folder, caller, lookups.isJoinedMember);
  if (!folder || judgeDefaultFolder(folder, caller, joined) !== 'ok') {
    return rejected('folder_not_found');
  }
  await setPlacementDefault(ctx.env, owner, key, folderId);
  logDefaultSet(key, placementScope(folder.teamId));
  return noContent();
}

export async function handlePlacementDefaults(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'placement-defaults') return notFound();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;

  if (segments.length === 2) {
    if (request.method !== 'GET') return notFound();
    return json({ defaults: await listPlacementDefaults(env, owner) });
  }

  const segment = segments[2];
  if (segments.length !== 3 || !segment) return notFound();
  if (request.method !== 'PUT' && request.method !== 'DELETE') return notFound();
  const key = keyOf(segment);
  if (!key) return rejected('default_key_invalid');
  if (request.method === 'PUT') return setDefault(ctx, owner, key);
  await clearPlacementDefault(env, owner, key);
  logDefaultCleared(key);
  return noContent();
}
