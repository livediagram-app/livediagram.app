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
import { offlineGetRecord, offlinePutRecord, serializeOfflineWrite } from './offline-store';

async function record(documentId: string) {
  const rec = await offlineGetRecord(documentId);
  if (!rec || rec.trashedAt !== undefined) throw new ApiError('sheet write', 404, 'not_found');
  return rec;
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
    const rec = await record(documentId);
    const sheets = rec.sheets ?? [];
    const id = create.id ?? makeSheetId();
    const stored = sheets.find((s) => s.id === id);
    // A restore (the editor's undo) of a sheet still here keeps it, as the api does.
    if (stored && create.restore && stored.tabId === create.tabId) return stored;
    if (stored) throw new ApiError('sheet create', 409, 'sheet_exists');
    const lower = create.title.toLowerCase();
    if (sheets.some((s) => s.tabId === create.tabId && s.title.toLowerCase() === lower))
      throw new ApiError('sheet create', 409, 'sheet_title_taken');
    if (sheets.length >= DOCUMENT_SHEETS_MAX)
      throw new ApiError('sheet create', 413, 'sheets_full');
    const now = Date.now();
    const source = create.copyOf ? sheets.find((s) => s.id === create.copyOf) : undefined;
    if (create.copyOf && !source) throw new ApiError('sheet create', 404, 'sheet_not_found');
    const sheet: SheetJson = {
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
    const check = validateSheetCreate(sheetFromJson(sheet));
    if (!check.ok)
      throw new ApiError('sheet create', check.error === 'sheet_full' ? 413 : 400, check.error);
    await offlinePutRecord({ ...rec, sheets: [...sheets, sheet] });
    debugLog('[sheets] sheets.offline.write', { kind: 'create' });
    return sheet;
  });
}

export async function offlineWriteSheet(
  documentId: string,
  sheetId: string,
  request: SheetWriteRequest,
  by: SheetPerson,
): Promise<SheetWriteResponse> {
  return serializeOfflineWrite(async () => {
    const rec = await record(documentId);
    const sheets = rec.sheets ?? [];
    const at = sheets.findIndex((s) => s.id === sheetId);
    if (at < 0) throw new ApiError('sheet write', 404, 'sheet_not_found');
    const sheet = sheetFromJson(sheets[at]!);
    const write = request.write;
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
    const landed = applySheetWrite(
      sheet,
      write.kind === 'title' ? { ...write, title: write.title.trim() } : write,
      {
        now: Date.now(),
        by,
      },
    );
    const next = sheetToJson(landed.sheet);
    await offlinePutRecord({ ...rec, sheets: sheets.map((s, i) => (i === at ? next : s)) });
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
  return serializeOfflineWrite(async () => {
    const rec = await record(documentId);
    const sheets = rec.sheets ?? [];
    if (!sheets.some((s) => s.id === sheetId))
      throw new ApiError('sheet delete', 404, 'sheet_not_found');
    await offlinePutRecord({ ...rec, sheets: sheets.filter((s) => s.id !== sheetId) });
  });
}
