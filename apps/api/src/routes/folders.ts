// /api/folders — folder tree CRUD. Personal folders are owner-scoped
// (docs/specs/013-workspace/folders.md); team folders (docs/specs/013-workspace/team-shared-documents.md) carry a team_id and authorise by
// JOINED membership instead: any joined member may create / rename /
// move / delete them. The two scopes never mix — a team folder's
// parent must be a folder of the same team, a personal folder's
// parent must belong to the same owner.

import {
  createFolder,
  deleteFolder,
  getFolder,
  getMembership,
  listFoldersByOwner,
  moveFolder,
  renameFolder,
} from '../db';
import type { FolderDTO } from '../types';
import { badRequest, conflict, forbidden, json, noContent, notFound } from '../responses';
import { requireOwner, type RouteContext, readBody } from './context';
import { recordFolderCreated, recordFolderDeleted } from '../timeline';
import { readFolderName, readParentId } from './folder-body';
import { markTimelineEventsDeletedBySource } from '../db/timeline';

// Joined-member check for team-scoped folder verbs. Membership is
// keyed by Clerk user id — carried by a session JWT or an API token
// (both server-verified, docs/specs/015-api/public-api-and-tokens.md §3.4) — so the guest path can never
// manage team folders (consistent with docs/specs/013-workspace/teams.md's Clerk-only teams).
async function canManageTeamFolder(ctx: RouteContext, teamId: string): Promise<boolean> {
  if (!ctx.verifiedUserId) return false;
  const membership = await getMembership(ctx.env, teamId, ctx.verifiedUserId);
  return membership?.status === 'joined';
}

// Scope-aware authorisation for an existing folder: ownership for
// personal folders, joined membership for team folders.
async function canManageFolder(ctx: RouteContext, folder: FolderDTO, owner: string) {
  if (folder.teamId) return canManageTeamFolder(ctx, folder.teamId);
  return folder.ownerId === owner;
}

export async function handleFolders(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'folders') return notFound();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;

  // /api/folders — list / create
  if (segments.length === 2) {
    if (request.method === 'GET') {
      // Personal tree only; team folders ship via GET
      // /api/teams/:id/library (docs/specs/013-workspace/team-shared-documents.md).
      const folders = await listFoldersByOwner(env, owner);
      return json({ folders });
    }
    if (request.method === 'POST') {
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read as Record<string, unknown>;
      const newId = body.id;
      if (typeof newId !== 'string' || !newId) return badRequest('missing id/name');
      const name = readFolderName(body.name);
      if (name === undefined) return badRequest('missing id/name');
      if (name instanceof Response) return name;
      const parentId = readParentId(body.parentId);
      if (parentId instanceof Response) return parentId;
      if (body.teamId != null && typeof body.teamId !== 'string')
        return badRequest('invalid teamId');
      const teamId = (body.teamId as string | null | undefined) ?? null;
      if (teamId && !(await canManageTeamFolder(ctx, teamId))) return forbidden();
      // Parent must exist and live in the same scope before we accept
      // it — otherwise the tree could grow into another user's (or
      // another team's) folders.
      if (parentId) {
        const parent = await getFolder(env, parentId);
        if (!parent) return notFound();
        if (teamId ? parent.teamId !== teamId : parent.teamId !== null || parent.ownerId !== owner)
          return notFound();
      }
      const folder = await createFolder(env, {
        id: newId,
        ownerId: owner,
        parentId: parentId ?? null,
        name,
        teamId,
      });
      ctx.waitUntil?.(recordFolderCreated(env, { id: folder.id, name: folder.name }, owner));
      return json({ folder }, { status: 201 });
    }
  }

  // /api/folders/<id> — update / delete
  if (segments.length === 3) {
    const id = segments[2]!;
    const existing = await getFolder(env, id);
    if (!existing) return notFound();
    if (!(await canManageFolder(ctx, existing, owner))) return forbidden();
    if (request.method === 'PUT') {
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read as Record<string, unknown>;
      // Validate the whole body before writing any of it, so a bad parentId never leaves a
      // half-applied rename behind.
      const name = readFolderName(body.name);
      if (name instanceof Response) return name;
      const parentId = readParentId(body.parentId);
      if (parentId instanceof Response) return parentId;
      // The new parent must stay inside the folder's own scope.
      if (parentId) {
        const newParent = await getFolder(env, parentId);
        if (!newParent) return notFound();
        if (
          existing.teamId
            ? newParent.teamId !== existing.teamId
            : newParent.teamId !== null || newParent.ownerId !== owner
        )
          return notFound();
      }
      // The cycle check lives inside the move's own UPDATE (db/folders.ts moveFolder), so two
      // crossing moves cannot both pass it; nothing changed means it refused.
      if (parentId !== undefined && !(await moveFolder(env, id, parentId))) {
        return conflict('cycle');
      }
      if (name !== undefined) await renameFolder(env, id, name);
      const updated = await getFolder(env, id);
      return json({ folder: updated });
    }
    if (request.method === 'DELETE') {
      // Read the name before the row goes; afterwards there is nothing
      // left to name it by.
      const doomed = await getFolder(env, id);
      const { parentId } = await deleteFolder(env, id);
      // Where the contents went (docs/specs/013-workspace/folders.md "Deleting a folder").
      console.info(
        `folders: deleted scope=${existing.teamId ? 'team' : 'personal'} moved_up=${parentId ? 'parent' : 'root'}`,
      );
      if (doomed) {
        // Cascade first, then the tombstone, exactly as a document delete
        // does (docs/specs/013-workspace/timeline.md §3.5): the folder's own earlier cards go, and
        // the one row that answers "what happened to it?" stays.
        ctx.waitUntil?.(
          markTimelineEventsDeletedBySource(env, 'account', id)
            .then(() => recordFolderDeleted(env, { id, name: doomed.name }, owner))
            .catch((err) => console.error('timeline folder delete failed', err)),
        );
      }
      return noContent();
    }
  }
  return notFound();
}
