// The default-folder step of placement on create (docs/specs/013-workspace/default-folders.md,
// blueprint docs/specs/013-workspace/blueprints/default-folders.md): at the root of My documents, a
// create with an intent lands in the person's default for it. A dangling default is skipped, never
// a refusal, and the next key, then the root, answers instead.

import { defaultKeysFor } from '@livediagram/api-schema';
import type {
  DefaultSkipReason,
  FolderStep,
  PlacementCaller,
  PlacementFolder,
} from './placement-types';

/** May a default point at this folder for this caller? Their own personal folder, or a folder of
 *  a team they have joined (`joinedTeam` is false without a verified id). */
export function judgeDefaultFolder(
  folder: PlacementFolder | null,
  caller: PlacementCaller,
  joinedTeam: boolean,
): 'ok' | DefaultSkipReason {
  if (!folder) return 'folder_missing';
  if (folder.teamId === null) {
    return folder.ownerId === caller.ownerId ? 'ok' : 'folder_not_visible';
  }
  return joinedTeam ? 'ok' : 'team_not_joined';
}

/** Membership of the folder's team, read only for a team folder and a verified caller. */
export async function joinedFolderTeam(
  folder: PlacementFolder | null,
  caller: PlacementCaller,
  isJoinedMember: (teamId: string, userId: string) => Promise<boolean>,
): Promise<boolean> {
  if (!folder?.teamId || caller.verifiedUserId === null) return false;
  return isJoinedMember(folder.teamId, caller.verifiedUserId);
}

export const defaultFolder: FolderStep = async ({
  requested,
  intent,
  caller,
  lookups,
  skipped,
}) => {
  // The root of My documents is not an explicit place; a team or a folder is.
  if (intent === null || requested.teamId !== null || requested.folderId !== null) return null;
  const defaults = await lookups.getPlacementDefaults(caller.ownerId);
  for (const key of defaultKeysFor(intent)) {
    const folderId = defaults.get(key);
    if (folderId === undefined) continue;
    const folder = await lookups.getFolder(folderId);
    if (!folder) {
      skipped.push({ key, reason: 'folder_missing' });
      continue;
    }
    const joined = await joinedFolderTeam(folder, caller, lookups.isJoinedMember);
    const judgement = judgeDefaultFolder(folder, caller, joined);
    if (judgement !== 'ok') {
      skipped.push({ key, reason: judgement });
      continue;
    }
    return { ok: true, placement: { teamId: folder.teamId, folderId }, via: 'default', key };
  }
  return null;
};
