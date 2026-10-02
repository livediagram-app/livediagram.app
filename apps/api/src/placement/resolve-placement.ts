// Placement on create (docs/specs/013-workspace/folders.md "Placement on create", blueprint
// docs/specs/013-workspace/blueprints/document-placement.md): decides where a new document is
// filed before anything is written. The judgements are pure; the reads they need arrive through
// `PlacementLookups`, so the whole decision is testable without a database.

import type {
  CreationIntent,
  DocumentPlacement,
  PlacementRejection,
} from '@livediagram/api-schema';
import { defaultFolder } from './default-folder';
import type {
  DefaultSkip,
  FolderStep,
  PlacementCaller,
  PlacementFolder,
  PlacementLookups,
  PlacementOutcome,
} from './placement-types';

type Judgement = 'ok' | PlacementRejection;

function placementId(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** The placement a create body asks for; null when either field is malformed (`placement_invalid`). */
export function parsePlacement(body: {
  teamId?: unknown;
  folderId?: unknown;
}): DocumentPlacement | null {
  const teamId = placementId(body.teamId);
  const folderId = placementId(body.folderId);
  if (teamId === undefined || folderId === undefined) return null;
  return { teamId, folderId };
}

/** May this caller file into a team? Only a verified account that has joined it. */
export function judgeTeam(verifiedUserId: string | null, joined: boolean): Judgement {
  return verifiedUserId !== null && joined ? 'ok' : 'team_forbidden';
}

/**
 * Does this folder belong to the space being filed into? A folder the caller cannot see (missing,
 * someone else's personal folder, a folder of a team they haven't joined) is `folder_not_found`,
 * so the answer never reveals it exists; one they can see in the other space is a mismatch.
 */
export function judgeFolder(
  folder: PlacementFolder | null,
  space: { teamId: string | null },
  caller: PlacementCaller,
  joinedFolderTeam: boolean,
): Judgement {
  if (!folder) return 'folder_not_found';
  const ownPersonal = folder.teamId === null && folder.ownerId === caller.ownerId;
  if (folder.teamId === space.teamId) {
    return folder.teamId !== null || ownPersonal ? 'ok' : 'folder_not_found';
  }
  const visible = folder.teamId === null ? ownPersonal : joinedFolderTeam;
  return visible ? 'folder_scope_mismatch' : 'folder_not_found';
}

const explicitFolder: FolderStep = async ({ requested, caller, lookups }) => {
  if (requested.folderId === null) return null;
  const folder = await lookups.getFolder(requested.folderId);
  // Visibility of a team folder outside the requested space needs the caller's membership of it.
  const elsewhereTeam = folder?.teamId && folder.teamId !== requested.teamId ? folder.teamId : null;
  const joinedFolderTeam =
    elsewhereTeam !== null && caller.verifiedUserId !== null
      ? await lookups.isJoinedMember(elsewhereTeam, caller.verifiedUserId)
      : false;
  const judgement = judgeFolder(folder, requested, caller, joinedFolderTeam);
  if (judgement !== 'ok') return { ok: false, rejection: judgement };
  return { ok: true, placement: requested, via: 'explicit' };
};

/** Folder steps in order, first answer wins; the space's root answers when none does. */
const FOLDER_STEPS: readonly FolderStep[] = [explicitFolder, defaultFolder];

function spaceRoot(requested: DocumentPlacement, skipped: DefaultSkip[]): PlacementOutcome {
  const placement = { teamId: requested.teamId, folderId: null };
  return { ok: true, placement, via: 'root', skipped };
}

/** Resolves a create's placement: the space first, then the folder steps, the creation intent
 *  choosing among the caller's default folders. Writes nothing. */
export async function resolvePlacement(
  requested: DocumentPlacement,
  caller: PlacementCaller,
  lookups: PlacementLookups,
  intent: CreationIntent | null,
): Promise<PlacementOutcome> {
  if (requested.teamId !== null) {
    const joined =
      caller.verifiedUserId !== null &&
      (await lookups.isJoinedMember(requested.teamId, caller.verifiedUserId));
    const judgement = judgeTeam(caller.verifiedUserId, joined);
    if (judgement !== 'ok') return { ok: false, rejection: judgement };
  }
  const skipped: DefaultSkip[] = [];
  for (const step of FOLDER_STEPS) {
    const answer = await step({ requested, intent, caller, lookups, skipped });
    if (answer) return answer.ok ? { ...answer, skipped } : answer;
  }
  return spaceRoot(requested, skipped);
}
