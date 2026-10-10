// The sheet store's client (docs/specs/029-sheets/sheet-store.md, blueprint sheet-store.md "Editor slice"). Each
// call sends an offline document to its local store (../offline/offline-sheets, loaded only then: it carries the
// engine) and a cloud document to the api. A session on a tab-scoped link names its tab on every call. Types only
// from the engine, so this module costs the main bundle nothing.

import type {
  SheetCreateRequest,
  SheetResponse,
  SheetsResponse,
  SheetWriteRequest,
  SheetWriteResponse,
} from '@livediagram/api-schema';
import type { SheetJson, SheetPerson } from '@livediagram/sheets';
import { isOfflineId } from '../offline/offline-store';
import { API_BASE, apiFetch, apiHeaders, expectOk, expectOkVoid } from './core';

export type SheetsScope = {
  ownerId: string;
  documentId: string;
  shareCode: string | null;
  // The tab a tab-scoped link confines this session to; null for the whole document.
  tabId: string | null;
};

function sheetsUrl(scope: SheetsScope, rest = '', query: Record<string, string> = {}): string {
  const q = new URLSearchParams({
    ...(scope.tabId ? { tabId: scope.tabId } : {}),
    ...query,
  }).toString();
  return `${API_BASE}/documents/${encodeURIComponent(scope.documentId)}/sheets${rest}${q ? `?${q}` : ''}`;
}

const offline = () => import('../offline/offline-sheets');

// A tab's sheets (or named ones, up to 50 a call), cells included.
export async function fetchSheets(
  scope: SheetsScope,
  which: { tabId: string } | { ids: readonly string[] },
): Promise<SheetJson[]> {
  if (await isOfflineId(scope.documentId))
    return (await offline()).offlineFetchSheets(scope.documentId, which);
  if ('ids' in which) {
    const out: SheetJson[] = [];
    for (let i = 0; i < which.ids.length; i += 50) {
      const res = await apiFetch(
        sheetsUrl(scope, '', { ids: which.ids.slice(i, i + 50).join(',') }),
        {
          headers: await apiHeaders(scope.ownerId, { share: scope.shareCode }),
        },
      );
      out.push(...(await expectOk<SheetsResponse>(res, 'sheets')).sheets);
    }
    return out;
  }
  const res = await apiFetch(sheetsUrl(scope, '', scope.tabId ? {} : { tabId: which.tabId }), {
    headers: await apiHeaders(scope.ownerId, { share: scope.shareCode }),
  });
  return (await expectOk<SheetsResponse>(res, 'sheets')).sheets;
}

// Every sheet of a document (Take offline, Duplicate, the Drive file).
export async function fetchAllSheets(scope: SheetsScope): Promise<SheetJson[]> {
  if (await isOfflineId(scope.documentId))
    return (await offline()).offlineFetchSheets(scope.documentId, null);
  const res = await apiFetch(sheetsUrl(scope), {
    headers: await apiHeaders(scope.ownerId, { share: scope.shareCode }),
  });
  return (await expectOk<SheetsResponse>(res, 'sheets')).sheets;
}

// A sheet as a create body (Sync to cloud, Duplicate): the whole sheet, ids kept.
export function sheetAsCreate(sheet: SheetJson): SheetCreateRequest {
  return {
    id: sheet.id,
    tabId: sheet.tabId,
    title: sheet.title,
    layout: sheet.layout,
    cells: sheet.cells,
  };
}

export async function createSheet(
  scope: SheetsScope,
  create: SheetCreateRequest,
  by: SheetPerson,
): Promise<SheetJson> {
  if (await isOfflineId(scope.documentId))
    return (await offline()).offlineCreateSheet(scope.documentId, create, by);
  const res = await apiFetch(sheetsUrl(scope), {
    method: 'POST',
    headers: await apiHeaders(scope.ownerId, { share: scope.shareCode, body: true }),
    body: JSON.stringify(create),
  });
  return (await expectOk<SheetResponse>(res, 'sheet create')).sheet;
}

export async function writeSheet(
  scope: SheetsScope,
  sheetId: string,
  request: SheetWriteRequest,
  by: SheetPerson,
): Promise<SheetWriteResponse> {
  if (await isOfflineId(scope.documentId))
    return (await offline()).offlineWriteSheet(scope.documentId, sheetId, request, by);
  const res = await apiFetch(sheetsUrl(scope, `/${encodeURIComponent(sheetId)}/writes`), {
    method: 'POST',
    headers: await apiHeaders(scope.ownerId, { share: scope.shareCode, body: true }),
    body: JSON.stringify(request),
  });
  return expectOk<SheetWriteResponse>(res, 'sheet write');
}

// `whenUnreferenced`: the editor deleting a Sheet with its element; the api deletes the sheet once nothing in the
// document references it (sheet-store.md "Deleting a sheet").
export async function deleteSheet(
  scope: SheetsScope,
  sheetId: string,
  opts: { whenUnreferenced?: boolean } = {},
): Promise<void> {
  if (await isOfflineId(scope.documentId))
    return (await offline()).offlineDeleteSheet(scope.documentId, sheetId);
  const query: Record<string, string> = opts.whenUnreferenced ? { whenUnreferenced: 'true' } : {};
  const res = await apiFetch(sheetsUrl(scope, `/${encodeURIComponent(sheetId)}`, query), {
    method: 'DELETE',
    headers: await apiHeaders(scope.ownerId, { share: scope.shareCode }),
  });
  return expectOkVoid(res, 'sheet delete');
}
