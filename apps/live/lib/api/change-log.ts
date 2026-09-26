// Change log (per-diagram audit) — see docs/specs/012-collaboration/activity-and-audit.md
import { CHANGE_LOG_TAB_NOT_SAVED, type ChangeLogEntry } from '@livediagram/api-schema';
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
  readErrorCode,
  type ChangeLogAppendResponse,
  type ChangeLogListResponse,
  apiFetch,
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
  // Offline Mode (docs/specs/006-diagram/offline-mode.md): the log lives in the diagram's IndexedDB record.
  if (await isOfflineId(id)) return offlineListChangeLog(id);
  const res = await apiFetch(`${API_BASE}/diagrams/${id}/log`, {
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
  const post = async () =>
    apiFetch(`${API_BASE}/diagrams/${diagramId}/log`, {
      method: 'POST',
      headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
      body: JSON.stringify(entry),
    });
  let res = await post();
  // The first edit on a brand-new tab is logged before the debounced
  // autosave has created the tab, so the server answers 409 tab_not_saved.
  // Wait for the save and try again, quietly: only a tab that still hasn't
  // arrived after the last retry reaches expectOk and reports.
  for (let i = 0; i < APPEND_TAB_RETRIES && (await isTabNotSaved(res)); i++) {
    await new Promise((resolve) => setTimeout(resolve, APPEND_TAB_RETRY_MS));
    res = await post();
  }
  const { entry: stored } = await expectOk<ChangeLogAppendResponse>(res, 'append change log');
  return stored;
}

// Comfortably past useAutosave's 600ms debounce plus a save round trip.
const APPEND_TAB_RETRY_MS = 1500;
const APPEND_TAB_RETRIES = 3;

async function isTabNotSaved(res: Response): Promise<boolean> {
  return res.status === 409 && (await readErrorCode(res)) === CHANGE_LOG_TAB_NOT_SAVED;
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
