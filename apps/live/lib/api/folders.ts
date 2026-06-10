// Folder calls (spec/15): list / create / update / delete, plus moving
// a diagram into (or out of) a folder.
import type { Folder } from '@livediagram/api-schema';
import { dedupeInFlight } from '../dedupe';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  expectOkVoid,
  type FolderResponse,
  type FoldersResponse,
} from './core';

// Same dedupe rationale as apiListDiagrams. useFolders runs once
// per page surface; concurrent mounts on multi-panel pages (e.g.
// /new shows the floating Explorer AND the welcome flow, both
// gated on the same ownerId) would otherwise fire duplicate
// GET /folders calls.
async function _apiListFolders(ownerId: string): Promise<Folder[]> {
  const res = await fetch(`${API_BASE}/folders`, { headers: await apiHeaders(ownerId) });
  const { folders } = await expectOk<FoldersResponse>(res, 'list folders');
  return folders;
}
export const apiListFolders = dedupeInFlight(_apiListFolders, (ownerId) => ownerId);

export async function apiCreateFolder(
  ownerId: string,
  input: { id: string; name: string; parentId?: string | null; teamId?: string | null },
): Promise<Folder> {
  const res = await fetch(`${API_BASE}/folders`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({
      id: input.id,
      name: input.name,
      parentId: input.parentId ?? null,
      // Team scope (spec/35): non-null creates a folder in that
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
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(patch),
  });
  const { folder } = await expectOk<FolderResponse>(res, 'update folder');
  return folder;
}

export async function apiDeleteFolder(ownerId: string, id: string): Promise<void> {
  return apiDelete(`${API_BASE}/folders/${id}`, ownerId, { action: 'delete folder' });
}

// Placement write (spec/15 + spec/35). `teamId` undefined = keep the
// diagram's current scope (the server defaults to it); null = the
// owner's personal tree; a team id = that team's shared library.
export async function apiSetDiagramFolder(
  ownerId: string,
  diagramId: string,
  folderId: string | null,
  teamId?: string | null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/folder`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(teamId === undefined ? { folderId } : { folderId, teamId }),
  });
  await expectOkVoid(res, 'set folder');
}
