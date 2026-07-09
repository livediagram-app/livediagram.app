// Change log (per-diagram audit) — see specs/12-activity-and-audit.md
import type { ChangeLogEntry } from '@livediagram/api-schema';
import { dedupeInFlight } from '../dedupe';
import {
  offlineAppendChangeLogEntry,
  offlineDeleteChangeLogEntry,
  offlineDeleteChangeLogForTab,
  offlineListChangeLog,
} from '../offline/offline-change-log';
import { isOfflineId } from '../offline/offline-store';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  type ChangeLogAppendResponse,
  type ChangeLogListResponse,
} from './core';

// Deduped on `${ownerId}|${id}|${shareCode ?? ''}`: fires on editor
// mount alongside apiLoadDiagram; React Strict Mode doubles the
// effect. A share-link visitor and the owner are different code
// paths (different shareCode) so the key includes it to keep them
// independent.
async function _apiListChangeLog(
  ownerId: string,
  id: string,
  shareCode?: string | null,
): Promise<ChangeLogEntry[]> {
  // Offline Mode (spec/76): the log lives in the diagram's IndexedDB record.
  if (await isOfflineId(id)) return offlineListChangeLog(id);
  const res = await fetch(`${API_BASE}/diagrams/${id}/log`, {
    headers: await apiHeaders(ownerId, { share: shareCode ?? null }),
  });
  const { entries } = await expectOk<ChangeLogListResponse>(res, 'list change log');
  return entries;
}
export const apiListChangeLog = dedupeInFlight(
  _apiListChangeLog,
  (ownerId, id, shareCode) => `${ownerId}|${id}|${shareCode ?? ''}`,
);

export async function apiAppendChangeLogEntry(
  ownerId: string,
  diagramId: string,
  entry: ChangeLogEntry,
  shareCode: string | null = null,
): Promise<ChangeLogEntry> {
  if (await isOfflineId(diagramId)) return offlineAppendChangeLogEntry(diagramId, entry);
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/log`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body: JSON.stringify(entry),
  });
  const { entry: stored } = await expectOk<ChangeLogAppendResponse>(res, 'append change log');
  return stored;
}

export async function apiDeleteChangeLogForTab(
  ownerId: string,
  diagramId: string,
  tabId: string,
  shareCode: string | null = null,
): Promise<void> {
  if (await isOfflineId(diagramId)) return offlineDeleteChangeLogForTab(diagramId, tabId);
  return apiDelete(`${API_BASE}/diagrams/${diagramId}/log/tab/${tabId}`, ownerId, {
    action: 'delete change log',
    share: shareCode,
  });
}

export async function apiDeleteChangeLogEntry(
  ownerId: string,
  diagramId: string,
  entryId: string,
  shareCode: string | null = null,
): Promise<void> {
  if (await isOfflineId(diagramId)) return offlineDeleteChangeLogEntry(diagramId, entryId);
  return apiDelete(`${API_BASE}/diagrams/${diagramId}/log/${entryId}`, ownerId, {
    action: 'delete change log entry',
    share: shareCode,
  });
}
