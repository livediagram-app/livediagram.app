// /api/folders — folder tree CRUD. Personal folders are owner-scoped
// (spec/15); team folders (spec/35) carry a team_id and authorise by
// JOINED membership instead: any joined member may create / rename /
// move / delete them. The two scopes never mix — a team folder's
// parent must be a folder of the same team, a personal folder's
// parent must belong to the same owner.

import {
  createFolder,
  deleteFolder,
  folderMoveWouldCycle,
  getFolder,
  getMembership,
  listFoldersByOwner,
  updateFolder,
} from '../db';
import type { FolderDTO } from '../types';
import { badRequest, forbidden, json, noContent, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';

// Joined-member check for team-scoped folder verbs. Membership is
// keyed by Clerk user id, so the guest path can never manage team
// folders (consistent with spec/32's Clerk-only teams).
async function canManageTeamFolder(ctx: RouteContext, teamId: string): Promise<boolean> {
  if (!ctx.clerkUserId) return false;
  const membership = await getMembership(ctx.env, teamId, ctx.clerkUserId);
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
      // /api/teams/:id/library (spec/35).
      const folders = await listFoldersByOwner(env, owner);
      return json({ folders });
    }
    if (request.method === 'POST') {
      const body = (await request.json()) as {
        id?: string;
        name?: string;
        parentId?: string | null;
        teamId?: string | null;
      };
      if (!body.id || !body.name) return badRequest('missing id/name');
      const parentId = body.parentId ?? null;
      const teamId = body.teamId ?? null;
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
        id: body.id,
        ownerId: owner,
        parentId,
        name: body.name,
        teamId,
      });
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
      const body = (await request.json()) as {
        name?: string;
        parentId?: string | null;
      };
      // Cycle check on reparent: refusing here keeps the tree
      // walk in the list consumers bounded. The new parent must
      // stay inside the folder's own scope.
      if (body.parentId !== undefined && body.parentId !== null) {
        const newParent = await getFolder(env, body.parentId);
        if (!newParent) return notFound();
        if (
          existing.teamId
            ? newParent.teamId !== existing.teamId
            : newParent.teamId !== null || newParent.ownerId !== owner
        )
          return notFound();
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
