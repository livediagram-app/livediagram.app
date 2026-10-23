// A design as its owner may reach it, for the workbench mint and redemption
// (docs/specs/013-workspace/blueprints/workbench-embeds.md, mint step 5 and redemption step 4): the owner's own
// access (personal ownership or team membership), never a share code, whatever the request carries (WB3).
// Redemption has no caller identity of its own, so this cannot ride the request context's gates.

import type { WorkbenchRole } from '@livedesign/api-schema';
import { resolveDesignGrant } from '../auth/design-access';
import { getDesignMeta, getFolder, getMembership, getTrashedDesignMeta } from '../db';
import { designTrashed, notFound } from '../responses';
import type { Env } from '../types';

type OwnerDesignAccess = { designId: string; role: WorkbenchRole };

export async function ownerDesignAccess(
  env: Env,
  designId: string,
  ownerId: string,
): Promise<OwnerDesignAccess | Response> {
  const live = await getDesignMeta(env, designId);
  if (!live) {
    const trashed = await getTrashedDesignMeta(env, designId);
    if (!trashed) return notFound();
    const could = await resolveDesignGrant(
      env,
      designId,
      ownerId,
      null,
      trashed.ownerId,
      null,
      trashed.teamId,
      ownerId,
    );
    return could ? designTrashed() : notFound();
  }
  const grant = await resolveDesignGrant(
    env,
    designId,
    ownerId,
    null,
    live.ownerId,
    null,
    live.teamId,
    ownerId,
  );
  if (!grant) return notFound();
  return { designId, role: grant.role };
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
