// An offline document's sheet store (docs/specs/029-sheets/sheet-store.md "Offline documents"): the sheets live in
// the document's own record, and every write is the same pure transition the api applies (@livediagram/sheets
// applySheetWrite), validated the same way, serialised with the record's other writes. Loaded only for an offline
// document (lib/api/sheets.ts), as it carries the engine.

import { debugLog } from '@/lib/debug-log';
import type {
  SheetCreateRequest,
  SheetWriteRequest,
  SheetWriteResponse,
} from '@livediagram/api-schema';
import {
  DOCUMENT_SHEETS_MAX,
  applySheetWrite,
  cellKey,
  cellToJson,
  emptyLayout,
  makeSheetId,
  sheetFromJson,
  sheetToJson,
  validateSheetCreate,
  validateWrite,
  type SheetJson,
  type SheetPerson,
} from '@livediagram/sheets';
import { ApiError } from '../api/core';
import {
  offlineGetRecord,
  offlineUpdateRecord,
  serializeOfflineWrite,
  type OfflineDocumentRecord,
} from './offline-store';

// Rewrite a live record's sheets in one transaction (offlineUpdateRecord): `change` answers the
// new sheet list and what the caller returns, or throws to write nothing.
async function updateSheets<T>(
  documentId: string,
  change: (sheets: SheetJson[]) => { sheets: SheetJson[] | null; answer: T },
): Promise<T> {
  let out = null as { answer: T } | null;
  await offlineUpdateRecord(documentId, (rec: OfflineDocumentRecord | undefined) => {
    if (!rec || rec.trashedAt !== undefined) throw new ApiError('sheet write', 404, 'not_found');
    const next = change(rec.sheets ?? []);
    out = { answer: next.answer };
    return next.sheets ? { ...rec, sheets: next.sheets } : undefined;
  });
  // The change ran (or threw): a resolved update always read the record.
  return out!.answer;
}

export async function offlineFetchSheets(
  documentId: string,
  which: { tabId: string } | { ids: readonly string[] } | null,
): Promise<SheetJson[]> {
  const sheets = (await offlineGetRecord(documentId))?.sheets ?? [];
  if (!which) return sheets;
  if ('tabId' in which) return sheets.filter((s) => s.tabId === which.tabId);
  const ids = new Set(which.ids);
  return sheets.filter((s) => ids.has(s.id));
}

export async function offlineCreateSheet(
  documentId: string,
  create: SheetCreateRequest,
  by: SheetPerson,
): Promise<SheetJson> {
  return serializeOfflineWrite(async () => {
    const { sheet, wrote } = await updateSheets(documentId, (sheets) => {
      const id = create.id ?? makeSheetId();
      const stored = sheets.find((s) => s.id === id);
      // A restore (the editor's undo) of a sheet still here keeps it, as the api does.
      if (stored && create.restore && stored.tabId === create.tabId)
        return { sheets: null, answer: { sheet: stored, wrote: false } };
      if (stored) throw new ApiError('sheet create', 409, 'sheet_exists');
      const lower = create.title.toLowerCase();
      if (sheets.some((s) => s.tabId === create.tabId && s.title.toLowerCase() === lower))
        throw new ApiError('sheet create', 409, 'sheet_title_taken');
      if (sheets.length >= DOCUMENT_SHEETS_MAX)
        throw new ApiError('sheet create', 413, 'sheets_full');
      const now = Date.now();
      const source = create.copyOf ? sheets.find((s) => s.id === create.copyOf) : undefined;
      if (create.copyOf && !source) throw new ApiError('sheet create', 404, 'sheet_not_found');
      const made: SheetJson = {
        id,
        tabId: create.tabId,
        title: create.title,
        layout: source?.layout ?? create.layout ?? emptyLayout(),
        cells: source?.cells ?? create.cells ?? [],
        rev: 0,
        createdAt: now,
        updatedAt: now,
        updatedBy: by,
      };
      const check = validateSheetCreate(sheetFromJson(made));
      if (!check.ok)
        throw new ApiError('sheet create', check.error === 'sheet_full' ? 413 : 400, check.error);
      return { sheets: [...sheets, made], answer: { sheet: made, wrote: true } };
    });
    if (wrote) debugLog('[sheets] sheets.offline.write', { kind: 'create' });
    return sheet;
  });
}

export async function offlineWriteSheet(
  documentId: string,
  sheetId: string,
  request: SheetWriteRequest,
  by: SheetPerson,
): Promise<SheetWriteResponse> {
  const write = request.write;
  return serializeOfflineWrite(async () => {
    const landed = await updateSheets(documentId, (sheets) => {
      const at = sheets.findIndex((s) => s.id === sheetId);
      if (at < 0) throw new ApiError('sheet write', 404, 'sheet_not_found');
      const sheet = sheetFromJson(sheets[at]!);
      if (write.kind === 'title') {
        const lower = write.title.trim().toLowerCase();
        if (
          sheets.some(
            (s) => s.id !== sheetId && s.tabId === sheet.tabId && s.title.toLowerCase() === lower,
          )
        )
          throw new ApiError('sheet write', 409, 'sheet_title_taken');
      }
      const check = validateWrite(sheet, write);
      if (!check.ok)
        throw new ApiError('sheet write', check.error === 'sheet_full' ? 413 : 400, check.error);
      const result = applySheetWrite(
        sheet,
        write.kind === 'title' ? { ...write, title: write.title.trim() } : write,
        {
          now: Date.now(),
          by,
        },
      );
      const next = sheetToJson(result.sheet);
      return { sheets: sheets.map((s, i) => (i === at ? next : s)), answer: result };
    });
    debugLog('[sheets] sheets.offline.write', { kind: write.kind });
    const applied = landed.applied;
    const keys =
      applied.kind === 'title' ? [] : (applied.cells ?? []).map((c) => cellKey(c.r, c.c));
    return {
      applied,
      rev: landed.sheet.rev,
      cells: keys.map((k) => cellToJson(k, landed.sheet.cells.get(k))),
    };
  });
}

// An offline document has no reference index: the editor deletes a sheet with its element only once it has found
// nothing else references it (sheet-references.ts), so a delete when unreferenced deletes at once.
export async function offlineDeleteSheet(documentId: string, sheetId: string): Promise<void> {
  return serializeOfflineWrite(() =>
    updateSheets(documentId, (sheets) => {
      if (!sheets.some((s) => s.id === sheetId))
        throw new ApiError('sheet delete', 404, 'sheet_not_found');
      return { sheets: sheets.filter((s) => s.id !== sheetId), answer: undefined };
    }),
  );
}
