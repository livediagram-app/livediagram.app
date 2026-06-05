// /api/folders — owner-scoped folder tree (spec/15).

import {
  createFolder,
  deleteFolder,
  folderMoveWouldCycle,
  getFolder,
  listFoldersByOwner,
  updateFolder,
} from '../db';
import { badRequest, forbidden, json, noContent, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';

export async function handleFolders(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'folders') return notFound();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;

  // /api/folders — list / create
  if (segments.length === 2) {
    if (request.method === 'GET') {
      const folders = await listFoldersByOwner(env, owner);
      return json({ folders });
    }
    if (request.method === 'POST') {
      const body = (await request.json()) as {
        id?: string;
        name?: string;
        parentId?: string | null;
      };
      if (!body.id || !body.name) return badRequest('missing id/name');
      const parentId = body.parentId ?? null;
      // Parent must exist and belong to the same owner before we
      // accept it — otherwise the tree could grow into another
      // user's folders.
      if (parentId) {
        const parent = await getFolder(env, parentId);
        if (!parent || parent.ownerId !== owner) return notFound();
      }
      const folder = await createFolder(env, {
        id: body.id,
        ownerId: owner,
        parentId,
        name: body.name,
      });
      return json({ folder }, { status: 201 });
    }
  }

  // /api/folders/<id> — update / delete
  if (segments.length === 3) {
    const id = segments[2]!;
    const existing = await getFolder(env, id);
    if (!existing) return notFound();
    if (existing.ownerId !== owner) return forbidden();
    if (request.method === 'PUT') {
      const body = (await request.json()) as {
        name?: string;
        parentId?: string | null;
      };
      // Cycle check on reparent: refusing here keeps the tree
      // walk in `listFoldersByOwner` consumers bounded.
      if (body.parentId !== undefined && body.parentId !== null) {
        const newParent = await getFolder(env, body.parentId);
        if (!newParent || newParent.ownerId !== owner) return notFound();
        if (await folderMoveWouldCycle(env, id, body.parentId)) {
          return json({ error: 'cycle' }, { status: 409 });
        }
      }
      await updateFolder(env, id, { name: body.name, parentId: body.parentId });
      const updated = await getFolder(env, id);
      return json({ folder: updated });
    }
    if (request.method === 'DELETE') {
      await deleteFolder(env, id);
      return noContent();
    }
  }
  return notFound();
}
