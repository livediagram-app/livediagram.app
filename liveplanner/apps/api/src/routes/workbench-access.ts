// A project as its owner may reach it, for the workbench mint and redemption
// (docs/specs/013-workspace/blueprints/workbench-embeds.md, mint step 5 and redemption step 4): the owner's own
// access (personal ownership or team membership), never a share code, whatever the request carries (WB3).
// Redemption has no caller identity of its own, so this cannot ride the request context's gates.

import type { WorkbenchRole } from '@liveplanner/api-schema';
import { resolveProjectGrant } from '../auth/project-access';
import { getProjectMeta, getFolder, getMembership, getTrashedProjectMeta } from '../db';
import { projectTrashed, notFound } from '../responses';
import type { Env } from '../types';

type OwnerProjectAccess = { projectId: string; role: WorkbenchRole };

export async function ownerProjectAccess(
  env: Env,
  projectId: string,
  ownerId: string,
): Promise<OwnerProjectAccess | Response> {
  const live = await getProjectMeta(env, projectId);
  if (!live) {
    const trashed = await getTrashedProjectMeta(env, projectId);
    if (!trashed) return notFound();
    const could = await resolveProjectGrant(
      env,
      projectId,
      ownerId,
      null,
      trashed.ownerId,
      null,
      trashed.teamId,
      ownerId,
    );
    return could ? projectTrashed() : notFound();
  }
  const grant = await resolveProjectGrant(
    env,
    projectId,
    ownerId,
    null,
    live.ownerId,
    null,
    live.teamId,
    ownerId,
  );
  if (!grant) return notFound();
  return { projectId, role: grant.role };
}

// A folder a workspace ticket may start on (WB52): one of the owner's personal folders, or a folder of a team they
// are a joined member of. Anything else reads as absent.
export async function ownerReachesFolder(
  env: Env,
  ownerId: string,
  folderId: string,
): Promise<boolean> {
  const folder = await getFolder(env, folderId);
  if (!folder) return false;
  if (folder.teamId === null) return folder.ownerId === ownerId;
  const membership = await getMembership(env, folder.teamId, ownerId);
  return membership?.status === 'joined';
}
