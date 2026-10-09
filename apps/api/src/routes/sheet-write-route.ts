// One write to a sheet (docs/specs/029-sheets/sheet-store.md "Changing a sheet", blueprint sheet-store.md "Data
// and persistence"): validated by the engine, applied by the engine to what the write needs (the layout, and the
// formulas a deletion shrinks), stored in one batch guarded by the sheet's rev (retried on a lost race), answered
// with the stored state of every cell it touched, and relayed in order.

import type { SheetWriteRequest, SheetWriteResponse } from '@livediagram/api-schema';
import {
  DOCUMENT_CELLS_MAX,
  SHEET_BYTES_MAX,
  SHEET_CELLS_MAX,
  applySheetWrite,
  cellKey,
  cellsFromJson,
  validateWrite,
  type CellChange,
  type Sheet,
  type SheetWrite,
} from '@livediagram/sheets';
import {
  axisDeleteStatement,
  cellWriteStatements,
  documentSheetTotals,
  existingCells,
  headWriteStatement,
  listSheetHeads,
  readCells,
  readFormulaCells,
  readSheetHead,
  recountStatement,
  type SheetHead,
} from '../db';
import { json } from '../responses';
import { readBody, type RouteContext } from './context';
import { writer } from './item-route-kit';
import {
  SHEET_WRITE_RETRIES,
  relaySheet,
  sheetBusy,
  sheetCaller,
  sheetNotFound,
  sheetRejected,
} from './sheet-route-kit';

function readWrite(raw: unknown): SheetWriteRequest | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.write !== 'object' || b.write === null) return null;
  if (b.wid !== undefined && (typeof b.wid !== 'string' || b.wid.length > 64)) return null;
  return {
    write: b.write as SheetWrite,
    ...(typeof b.wid === 'string' ? { wid: b.wid } : {}),
    ...(b.undo === true ? { undo: true } : {}),
  };
}

function deletes(write: SheetWrite): boolean {
  return (
    write.kind === 'layout' &&
    write.changes.some((c) => c.k === 'deleteRows' || c.k === 'deleteCols')
  );
}

// Upper bounds of what a write adds: cells it may create and the bytes it may store.
function growth(cells: readonly CellChange[]): { count: number; bytes: number; keys: string[] } {
  let count = 0;
  let bytes = 0;
  const keys: string[] = [];
  for (const ch of cells) {
    if ((ch.i !== undefined && ch.i !== null) || (ch.f !== undefined && ch.f !== null)) {
      count++;
      keys.push(cellKey(ch.r, ch.c));
    }
    if (ch.i) bytes += JSON.stringify(ch.i).length;
    if (ch.f) bytes += JSON.stringify(ch.f).length;
  }
  return { count, bytes, keys };
}

async function capsProblem(
  ctx: RouteContext,
  documentId: string,
  head: SheetHead,
  cells: readonly CellChange[],
): Promise<Response | null> {
  const g = growth(cells);
  if (g.count === 0) return null;
  let added = g.count;
  let addedBytes = g.bytes;
  const near =
    head.cellCount + g.count > SHEET_CELLS_MAX || head.cellBytes + g.bytes > SHEET_BYTES_MAX;
  const totals = await documentSheetTotals(ctx.env, documentId);
  const docNear = totals.cells + g.count > DOCUMENT_CELLS_MAX;
  if (near || docNear) {
    // Close to a cap: count exactly, as cells the write replaces add nothing new.
    const existing = await existingCells(ctx.env, documentId, head.id, g.keys);
    added -= existing.count;
    addedBytes -= existing.bytes;
  }
  if (head.cellCount + added > SHEET_CELLS_MAX || head.cellBytes + addedBytes > SHEET_BYTES_MAX) {
    console.info('[sheets] sheets.full', { documentId });
    return sheetRejected('sheet_full', 413);
  }
  if (totals.cells + added > DOCUMENT_CELLS_MAX) return sheetRejected('sheets_full', 413);
  return null;
}

export async function writeSheet(
  ctx: RouteContext,
  documentId: string,
  sheetId: string,
): Promise<Response> {
  const caller = await sheetCaller(ctx, documentId, 'edit');
  if (caller instanceof Response) return caller;
  const body = readWrite(await readBody(ctx));
  if (!body) return sheetRejected('write_invalid');
  const by = await writer(ctx, caller.owner);
  for (let attempt = 0; attempt < SHEET_WRITE_RETRIES; attempt++) {
    const head = await readSheetHead(ctx.env, documentId, sheetId);
    if (!head || (caller.scopeTab && head.tabId !== caller.scopeTab)) return sheetNotFound();
    const write = body.write;
    if (write.kind === 'title') {
      const heads = await listSheetHeads(ctx.env, documentId, head.tabId);
      const lower = typeof write.title === 'string' ? write.title.trim().toLowerCase() : '';
      if (heads.some((h) => h.id !== sheetId && h.title.toLowerCase() === lower))
        return sheetRejected('sheet_title_taken', 409);
    }
    // The light sheet the engine applies to: the layout, and the formulas when rows or columns go.
    const light: Sheet = {
      ...head,
      cells: deletes(write)
        ? cellsFromJson(await readFormulaCells(ctx.env, documentId, sheetId))
        : new Map(),
    };
    let landed;
    try {
      const check = validateWrite(light, write);
      if (!check.ok)
        return sheetRejected(check.error, check.error === 'sheet_too_large' ? 413 : 400, check.at);
      landed = applySheetWrite(
        light,
        write.kind === 'title' ? { ...write, title: write.title.trim() } : write,
        {
          now: Date.now(),
          by,
        },
      );
    } catch {
      return sheetRejected('write_invalid');
    }
    const applied = landed.applied;
    const cells = applied.kind === 'title' ? [] : (applied.cells ?? []);
    const caps = await capsProblem(ctx, documentId, head, cells);
    if (caps) return caps;
    const now = Date.now();
    const nextRev = head.rev + 1;
    const nonce = crypto.randomUUID();
    const statements = [
      headWriteStatement(ctx.env, documentId, sheetId, head.rev, nonce, now, by, {
        ...(applied.kind === 'layout' && landed.sheet.layout !== head.layout
          ? { layout: landed.sheet.layout }
          : {}),
        ...(applied.kind === 'title' ? { title: landed.sheet.title } : {}),
      }),
    ];
    if (applied.kind === 'layout')
      for (const ch of applied.changes)
        if (ch.k === 'deleteRows' || ch.k === 'deleteCols')
          statements.push(
            axisDeleteStatement(
              ctx.env,
              documentId,
              sheetId,
              nonce,
              ch.k === 'deleteRows' ? 'r' : 'c',
              ch.ids,
            ),
          );
    statements.push(...cellWriteStatements(ctx.env, documentId, sheetId, nonce, cells));
    statements.push(recountStatement(ctx.env, documentId, sheetId));
    const results = await ctx.env.DB.batch(statements);
    const raised = (results[0]?.results ?? []) as { rev: number }[];
    if (raised.length === 0) {
      console.info('[sheets] sheets.write.retry', { attempt });
      continue;
    }
    const keys = cells.map((ch) => cellKey(ch.r, ch.c));
    const answer: SheetWriteResponse = {
      applied,
      rev: nextRev,
      cells: await readCells(ctx.env, documentId, sheetId, keys),
    };
    relaySheet(ctx, documentId, {
      kind: 'sheets',
      sheetId,
      tabId: head.tabId,
      rev: nextRev,
      applied,
      at: now,
      by,
      ...(body.wid ? { wid: body.wid } : {}),
    });
    return json(answer);
  }
  return sheetBusy();
}
