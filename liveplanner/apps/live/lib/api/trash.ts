// The Trash (docs/specs/013-workspace/trash.md): the cloud Trash over
// /api/trash (personal + every joined team's) and the Offline Mode local
// Trash in IndexedDB, behind one set of calls. Restore and purge dispatch on
// the offline index like every other project call (lib/api-client.ts).

import type { Project, ProjectResponse, TrashedProject } from '@liveplanner/api-schema';
import { isOfflineId } from '../offline/offline-store';
import {
  offlineListTrash,
  offlinePurgeProject,
  offlinePurgeExpiredTrash,
  offlineRestoreProject,
} from '../offline/offline-trash';
import { unmarkProjectDeleted } from '../project-tombstones';
import { API_BASE, apiDelete, apiFetch, apiHeaders, expectOk } from './core';

export type TrashListing = {
  // The api's rows, or null when the cloud Trash couldn't be reached: the
  // view still shows this browser's Trash rather than failing whole.
  cloud: TrashedProject[] | null;
  // This Browser only (Offline Mode).
  local: TrashedProject[];
};

export async function apiListTrash(ownerId: string, now = Date.now()): Promise<TrashListing> {
  // The local Trash keeps its 30 days by being swept whenever it is read.
  await offlinePurgeExpiredTrash(now).catch(() => 0);
  const local = await offlineListTrash().catch(() => [] as TrashedProject[]);
  try {
    const res = await apiFetch(`${API_BASE}/trash`, { headers: await apiHeaders(ownerId) });
    const { trash } = await expectOk<{ trash: TrashedProject[] }>(res, 'list trash');
    return { cloud: trash, local };
  } catch (err) {
    console.warn('[trash] cloud list failed', err);
    return { cloud: null, local };
  }
}

// Restore one project to where it was. Returns the project (null for an
// offline one, which the caller re-lists), and lets this page write it again.
export async function apiRestoreProject(ownerId: string, id: string): Promise<Project | null> {
  if (await isOfflineId(id)) {
    if (!(await offlineRestoreProject(id))) throw new Error('not in the local Trash');
    unmarkProjectDeleted(id);
    return null;
  }
  const res = await apiFetch(`${API_BASE}/trash/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    headers: await apiHeaders(ownerId),
  });
  const { project: liveDoc } = await expectOk<ProjectResponse>(res, 'restore project');
  unmarkProjectDeleted(id);
  return liveDoc;
}

// Delete one trashed project for good.
export async function apiPurgeProject(ownerId: string, id: string): Promise<void> {
  if (await isOfflineId(id)) {
    await offlinePurgeProject(id);
    return;
  }
  await apiDelete(`${API_BASE}/trash/${encodeURIComponent(id)}`, ownerId, {
    action: 'purge project',
    allow404: false,
  });
}

// Empty one Trash: the personal one, a team's, or this browser's. Returns how
// many projects went.
export async function apiEmptyTrash(
  ownerId: string,
  scope: { kind: 'personal' } | { kind: 'team'; teamId: string } | { kind: 'local' },
): Promise<number> {
  if (scope.kind === 'local') {
    const rows = await offlineListTrash();
    for (const row of rows) await offlinePurgeProject(row.id);
    return rows.length;
  }
  const query = scope.kind === 'team' ? `?team=${encodeURIComponent(scope.teamId)}` : '';
  const res = await apiFetch(`${API_BASE}/trash${query}`, {
    method: 'DELETE',
    headers: await apiHeaders(ownerId),
  });
  const { purged } = await expectOk<{ purged: number }>(res, 'empty trash');
  return purged;
}
