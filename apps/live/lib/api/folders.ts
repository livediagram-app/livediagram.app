// Folder calls (docs/specs/013-workspace/folders.md): list / create / update / delete, plus moving
// a diagram into (or out of) a folder.
import type { Folder } from '@livediagram/api-schema';
import { dedupeInFlight } from '../dedupe';
import { isOfflineId, offlineSetDiagramFolder } from '../offline/offline-store';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  expectOkVoid,
  type FolderResponse,
  type FoldersResponse,
  apiFetch,
} from './core';

// Same dedupe rationale as apiListDiagrams. useFolders runs once
// per page surface; concurrent mounts on multi-panel pages (e.g.
// /new shows the floating Explorer AND the welcome flow, both
// gated on the same ownerId) would otherwise fire duplicate
// GET /folders calls.
async function _apiListFolders(ownerId: string): Promise<Folder[]> {
  const res = await apiFetch(`${API_BASE}/folders`, { headers: await apiHeaders(ownerId) });
  const { folders } = await expectOk<FoldersResponse>(res, 'list folders');
  return folders;
}
export const apiListFolders = dedupeInFlight(_apiListFolders, (ownerId) => ownerId);

export async function apiCreateFolder(
  ownerId: string,
  input: { id: string; name: string; parentId?: string | null; teamId?: string | null },
): Promise<Folder> {
  const res = await apiFetch(`${API_BASE}/folders`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({
      id: input.id,
      name: input.name,
      parentId: input.parentId ?? null,
      // Team scope (docs/specs/013-workspace/team-shared-diagrams.md): non-null creates a folder in that
      // team's shared library instead of the personal tree.
      teamId: input.teamId ?? null,
    }),
  });
  const { folder } = await expectOk<FolderResponse>(res, 'create folder');
  return folder;
}

export async function apiUpdateFolder(
  ownerId: string,
  id: string,
  patch: { name?: string; parentId?: string | null },
): Promise<Folder> {
  const res = await apiFetch(`${API_BASE}/folders/${id}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(patch),
  });
  const { folder } = await expectOk<FolderResponse>(res, 'update folder');
  return folder;
}

export async function apiDeleteFolder(ownerId: string, id: string): Promise<void> {
  // Folder events are keyed under the 'account' source type (docs/specs/013-workspace/timeline.md §4.5).
  return apiDelete(`${API_BASE}/folders/${id}`, ownerId, {
    action: 'delete folder',
    purge: { sourceType: 'account', sourceId: id },
  });
}

// Placement write (docs/specs/013-workspace/folders.md + docs/specs/013-workspace/team-shared-diagrams.md). `teamId` undefined = keep the
// diagram's current scope (the server defaults to it); null = the
// owner's personal tree; a team id = that team's shared library.
export async function apiSetDiagramFolder(
  ownerId: string,
  diagramId: string,
  folderId: string | null,
  teamId?: string | null,
): Promise<void> {
  // Offline Mode (docs/specs/006-diagram/offline-mode.md): the placement lives on the IndexedDB record.
  // A team destination is impossible for an offline diagram (the shared
  // library is server-side); the picker doesn't offer one, and throwing
  // here keeps a stray call from reaching the server.
  if (await isOfflineId(diagramId)) {
    if (teamId) throw new Error('offline diagrams cannot join a team');
    return offlineSetDiagramFolder(diagramId, folderId, Date.now());
  }
  const res = await apiFetch(`${API_BASE}/diagrams/${diagramId}/folder`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(teamId === undefined ? { folderId } : { folderId, teamId }),
  });
  await expectOkVoid(res, 'set folder');
}
