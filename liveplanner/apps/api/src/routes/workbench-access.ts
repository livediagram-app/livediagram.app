// A plan as its owner may reach it, for the workbench mint and redemption
// (docs/specs/013-workspace/blueprints/workbench-embeds.md, mint step 5 and redemption step 4): the owner's own
// access, never a share code, whatever the request carries (WB3). That access is the index's: a grant asked for
// the owner with this app's key (index-service.ts, delegated). A plan in the Trash gets none and reads as absent.

import type { WorkbenchRole } from '@liveplanner/api-schema';
import { LIST_LIMIT_MAX } from '@liveworkspace/index-client';
import { indexFor, requestGrant } from '../index-service';
import { json, notFound } from '../responses';
import type { Env } from '../types';

type OwnerProjectAccess = { projectId: string; role: WorkbenchRole };

// `teams`: the owner's joined teams as the caller knows them (the minting token's); a redemption, which has no
// token, reaches the owner's own plans only.
export async function ownerProjectAccess(
  env: Env,
  projectId: string,
  ownerId: string,
  teams: readonly string[] = [],
): Promise<OwnerProjectAccess | Response> {
  const outcome = await requestGrant(env, { kind: 'delegate', personId: ownerId, teams }, projectId, null);
  if (outcome.ok) return { projectId, role: outcome.grant.level };
  if (outcome.status >= 500) return json({ error: outcome.error }, { status: outcome.status });
  return notFound();
}

// A folder a workspace ticket may start on (WB52): one of the owner's personal folders, or a folder of a team they
// are a joined member of. Anything else reads as absent.
export async function ownerReachesFolder(
  env: Env,
  ownerId: string,
  folderId: string,
  teams: readonly string[] = [],
): Promise<boolean> {
  const client = indexFor(env, { kind: 'delegate', personId: ownerId, teams });
  if (!client) return false;
  let cursor: string | undefined;
  try {
    for (let page = 0; page < 5; page++) {
      const { folders, nextCursor } = await client.listFolders({
        limit: LIST_LIMIT_MAX,
        ...(cursor ? { cursor } : {}),
      });
      if (folders.some((f) => f.id === folderId)) return true;
      if (!nextCursor) return false;
      cursor = nextCursor;
    }
  } catch (err) {
    console.warn('[workbench] folder lookup failed', { error: String(err) });
  }
  return false;
}
