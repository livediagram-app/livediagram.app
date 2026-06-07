// Change log (per-diagram audit) — see specs/12-activity-and-audit.md
import type { ChangeLogEntry } from '@livediagram/api-schema';
import { dedupeInFlight } from '../dedupe';
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
  return apiDelete(`${API_BASE}/diagrams/${diagramId}/log/${entryId}`, ownerId, {
    action: 'delete change log entry',
    share: shareCode,
  });
}
