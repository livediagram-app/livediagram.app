// The Trash (docs/specs/013-workspace/trash.md): the cloud Trash over
// /api/trash (personal + every joined team's) and the Offline Mode local
// Trash in IndexedDB, behind one set of calls. Restore and purge dispatch on
// the offline index like every other diagram call (lib/api-client.ts).

import type { LiveDoc, DocumentResponse, TrashedDocument } from '@livediagram/api-schema';
import { isOfflineId } from '../offline/offline-store';
import {
  offlineListTrash,
  offlinePurgeDocument,
  offlinePurgeExpiredTrash,
  offlineRestoreDocument,
} from '../offline/offline-trash';
import { unmarkDocumentDeleted } from '../document-tombstones';
import { API_BASE, apiDelete, apiFetch, apiHeaders, expectOk } from './core';

export type TrashListing = {
  // The api's rows, or null when the cloud Trash couldn't be reached: the
  // view still shows this browser's Trash rather than failing whole.
  cloud: TrashedDocument[] | null;
  // This browser only (Offline Mode).
  local: TrashedDocument[];
};

export async function apiListTrash(ownerId: string, now = Date.now()): Promise<TrashListing> {
  // The local Trash keeps its 30 days by being swept whenever it is read.
  await offlinePurgeExpiredTrash(now).catch(() => 0);
  const local = await offlineListTrash().catch(() => [] as TrashedDocument[]);
  try {
    const res = await apiFetch(`${API_BASE}/trash`, { headers: await apiHeaders(ownerId) });
    const { trash } = await expectOk<{ trash: TrashedDocument[] }>(res, 'list trash');
    return { cloud: trash, local };
  } catch (err) {
    console.warn('[trash] cloud list failed', err);
    return { cloud: null, local };
  }
}

// Restore one diagram to where it was. Returns the diagram (null for an
// offline one, which the caller re-lists), and lets this page write it again.
export async function apiRestoreDocument(ownerId: string, id: string): Promise<LiveDoc | null> {
  if (await isOfflineId(id)) {
    if (!(await offlineRestoreDocument(id))) throw new Error('not in the local Trash');
    unmarkDocumentDeleted(id);
    return null;
  }
  const res = await apiFetch(`${API_BASE}/trash/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    headers: await apiHeaders(ownerId),
  });
  const { document: liveDoc } = await expectOk<DocumentResponse>(res, 'restore document');
  unmarkDocumentDeleted(id);
  return liveDoc;
}

// Delete one trashed diagram for good.
export async function apiPurgeDocument(ownerId: string, id: string): Promise<void> {
  if (await isOfflineId(id)) {
    await offlinePurgeDocument(id);
    return;
  }
  await apiDelete(`${API_BASE}/trash/${encodeURIComponent(id)}`, ownerId, {
    action: 'purge document',
    allow404: false,
  });
}

// Empty one Trash: the personal one, a team's, or this browser's. Returns how
// many diagrams went.
export async function apiEmptyTrash(
  ownerId: string,
  scope: { kind: 'personal' } | { kind: 'team'; teamId: string } | { kind: 'local' },
): Promise<number> {
  if (scope.kind === 'local') {
    const rows = await offlineListTrash();
    for (const row of rows) await offlinePurgeDocument(row.id);
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
