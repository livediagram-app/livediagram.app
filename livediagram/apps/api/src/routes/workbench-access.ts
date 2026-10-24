// A canvas as its owner may reach it, for the workbench mint and redemption
// (docs/specs/013-workspace/blueprints/workbench-embeds.md, mint step 5 and redemption step 4): the owner's own
// access, never a share code, whatever the request carries (WB3). That access is the index's: a grant asked for the
// owner with this app's key (index-service.ts, delegated). A canvas in the Trash answers 410 `document_trashed` (its
// grant says so); one the owner cannot reach, 404.

import type { WorkbenchRole } from '@livediagram/api-schema';
import { INDEX_APP, indexFor, requestGrant } from '../index-service';
import { documentTrashed, json, notFound } from '../responses';
import type { Env } from '../types';

type OwnerDocumentAccess = { documentId: string; role: WorkbenchRole };

// `teams`: the owner's joined teams as the caller knows them (the minting token's); a redemption, which has no
// token, reaches the owner's own canvases only.
export async function ownerDocumentAccess(
  env: Env,
  documentId: string,
  ownerId: string,
  teams: readonly string[] = [],
): Promise<OwnerDocumentAccess | Response> {
  const outcome = await requestGrant(
    env,
    { kind: 'delegate', personId: ownerId, teams: [...teams] },
    documentId,
    null,
  );
  if (outcome.ok)
    return outcome.grant.trashed ? documentTrashed() : { documentId, role: outcome.grant.level };
  if (outcome.status >= 500) return json({ error: outcome.error }, { status: outcome.status });
  return notFound();
}

// A folder a workspace ticket may start on (WB52): one of the owner's personal folders, or a folder of a team they
// are a joined member of. Anything else reads as absent. One index request: its folder previews leave out a folder
// the person cannot reach.
export async function ownerReachesFolder(
  env: Env,
  ownerId: string,
  folderId: string,
  teams: readonly string[] = [],
): Promise<boolean> {
  const client = indexFor(env, { kind: 'delegate', personId: ownerId, teams: [...teams] });
  if (!client) return false;
  try {
    const { previews } = await client.folderPreviews([folderId], { app: INDEX_APP });
    return previews.some((p) => p.folderId === folderId);
  } catch (err) {
    console.warn('[workbench] folder lookup failed', { error: String(err) });
    return false;
  }
}
