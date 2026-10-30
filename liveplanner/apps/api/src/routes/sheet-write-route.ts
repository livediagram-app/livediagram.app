// One write to a sheet (docs/specs/029-sheets/sheet-store.md "Changing a sheet", blueprint sheet-store.md "Data
// and persistence"): validated by the engine, applied by the engine to what the write needs (the layout, and the
// formulas a deletion shrinks), stored in one batch guarded by the sheet's rev (retried on a lost race), answered
// with the stored state of every cell it touched, and relayed in order.

import type { SheetWriteRequest, SheetWriteResponse } from '@liveplanner/api-schema';
import {
  PROJECT_CELLS_MAX,
  SHEET_BYTES_MAX,
  SHEET_CELLS_MAX,
  applySheetWrite,
  cellKey,
  cellsFromJson,
  shrinkReadersOf,
  validateWrite,
  valuesOnly,
  writesFormats,
  type Cell,
  type CellChange,
  type Sheet,
  type SheetPerson,
  type SheetWrite,
} from '@liveplanner/sheets';
import {
  axisDeleteStatement,
  cellWriteStatements,
  projectSheetTotals,
  existingCells,
  headWriteStatement,
  listSheetHeads,
  readCells,
  readFormulaCells,
  readSheetHead,
  recountStatement,
  projectSavedStatement,
  type SheetHead,
} from '../db';
import { forbidden, json } from '../responses';
import { readBody, type PlanRouteContext } from './context';
import { writer } from './item-route-kit';
import {
  SHEET_WRITE_RETRIES,
  relaySheet,
  sheetBusy,
  sheetCaller,
  sheetCallerEdits,
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
    ...(b.unchecked === true ? { unchecked: true } : {}),
  };
}

// Rows or columns deleted from `head` shrink the ranges into it held by the tab's other sheets, as its own formulas'
// ranges shrink (formulas.md "Other sheets"): each reading sheet's formula cells read once, its rewrites stored and
// relayed as a write of its own. Linear in the tab's formula references; the tab's sheets are read side by side.
async function shrinkReaders(
  ctx: PlanRouteContext,
  projectId: string,
  head: SheetHead,
  changes: Extract<SheetWrite, { kind: 'layout' }>['changes'],
  by: SheetPerson,
): Promise<void> {
  const heads = await listSheetHeads(ctx.env, projectId, head.tabId);
  await Promise.all(
    heads
      .filter((h) => h.id !== head.id)
      .map(async (h) => {
        const cells = cellsFromJson(await readFormulaCells(ctx.env, projectId, h.id));
        const rewrites = shrinkReadersOf(head.id, head.layout, changes, cells);
        if (rewrites.length === 0) return;
        const res = await storeSheetWrite(
          ctx,
          projectId,
          h.id,
          { write: { kind: 'cells', cells: rewrites }, unchecked: true },
          by,
          null,
        );
        if (!res.ok) console.warn('[sheets] sheets.readers.shrink_failed', { status: res.status });
      }),
  );
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
  ctx: PlanRouteContext,
  projectId: string,
  head: SheetHead,
  cells: readonly CellChange[],
): Promise<Response | null> {
  const g = growth(cells);
  if (g.count === 0) return null;
  let added = g.count;
  let addedBytes = g.bytes;
  const near =
    head.cellCount + g.count > SHEET_CELLS_MAX || head.cellBytes + g.bytes > SHEET_BYTES_MAX;
  const totals = await projectSheetTotals(ctx.env, projectId);
  const docNear = totals.cells + g.count > PROJECT_CELLS_MAX;
  if (near || docNear) {
    // Close to a cap: count exactly, as cells the write replaces add nothing new.
    const existing = await existingCells(ctx.env, projectId, head.id, g.keys);
    added -= existing.count;
    addedBytes -= existing.bytes;
  }
  if (head.cellCount + added > SHEET_CELLS_MAX || head.cellBytes + addedBytes > SHEET_BYTES_MAX) {
    console.info('[sheets] sheets.full', { projectId });
    return sheetRejected('sheet_full', 413);
  }
  if (totals.cells + added > PROJECT_CELLS_MAX) return sheetRejected('sheets_full', 413);
  return null;
}

export async function writeSheet(
  ctx: PlanRouteContext,
  projectId: string,
  sheetId: string,
): Promise<Response> {
  // A Participant writes cells; rows, columns and the title are the Sheet's shape, an Editor's
  // (docs/specs/013-workspace/share-roles.md "What a Participant changes").
  const caller = await sheetCaller(ctx, projectId, 'participate');
  if (caller instanceof Response) return caller;
  const read = readWrite(await readBody(ctx));
  if (!read) return sheetRejected('write_invalid');
  if (read.write.kind !== 'cells' && !(await sheetCallerEdits(ctx, caller))) return forbidden();
  // And a cell's value, never its format (docs/specs/029-sheets/sheet.md "Who may do what"): a Participant's
  // write lands as its values, and one of formats alone is refused. Only a write carrying formats asks the gate.
  let body = read;
  if (writesFormats(read.write) && !(await sheetCallerEdits(ctx, caller))) {
    const values = valuesOnly(read.write);
    if (!values) return forbidden();
    body = { ...read, write: values };
  }
  const by = await writer(ctx, caller.owner);
  return storeSheetWrite(ctx, projectId, sheetId, body, by, caller.scopeTab ?? null);
}

// A checked write stored (docs/specs/029-sheets/sheet-store.md "Changing a sheet"): validated and applied by the engine,
// capped, stored in one batch guarded by the sheet's rev (retried on a lost race), answered with the cells it touched
// and relayed. The sheet route's, after its gates, and a form's response row's (forms/sheet-response.ts).
export async function storeSheetWrite(
  ctx: PlanRouteContext,
  projectId: string,
  sheetId: string,
  body: SheetWriteRequest,
  by: SheetPerson,
  scopeTab: string | null,
  // A write planned against the sheet at this rev (a form's response row): applied only to that rev, else answered
  // sheet_busy for the caller to plan again, so a plan never lands on a sheet that changed under it.
  { atRev }: { atRev?: number } = {},
): Promise<Response> {
  for (let attempt = 0; attempt < SHEET_WRITE_RETRIES; attempt++) {
    const head = await readSheetHead(ctx.env, projectId, sheetId);
    if (!head || (scopeTab && head.tabId !== scopeTab)) return sheetNotFound();
    if (atRev !== undefined && head.rev !== atRev) return sheetBusy();
    const write = body.write;
    if (write.kind === 'title') {
      const heads = await listSheetHeads(ctx.env, projectId, head.tabId);
      const lower = typeof write.title === 'string' ? write.title.trim().toLowerCase() : '';
      if (heads.some((h) => h.id !== sheetId && h.title.toLowerCase() === lower))
        return sheetRejected('sheet_title_taken', 409);
    }
    // The light sheet the engine applies to: the layout, and the formulas when rows or columns go.
    const light: Sheet = {
      ...head,
      cells: deletes(write)
        ? cellsFromJson(await readFormulaCells(ctx.env, projectId, sheetId))
        : new Map<string, Cell>(),
    };
    let landed;
    try {
      // Validation rules are checked unless the write is an undo or one stored as it is (data-validation.md).
      const check = validateWrite(light, write, { checkRules: !body.undo && !body.unchecked });
      if (!check.ok)
        return sheetRejected(
          check.error,
          check.error === 'sheet_too_large' ? 413 : 400,
          check.at,
          check.line,
        );
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
    const caps = await capsProblem(ctx, projectId, head, cells);
    if (caps) return caps;
    const now = Date.now();
    const nextRev = head.rev + 1;
    const nonce = crypto.randomUUID();
    const statements = [
      headWriteStatement(ctx.env, projectId, sheetId, head.rev, nonce, now, by, {
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
              projectId,
              sheetId,
              nonce,
              ch.k === 'deleteRows' ? 'r' : 'c',
              ch.ids,
            ),
          );
    statements.push(...cellWriteStatements(ctx.env, projectId, sheetId, nonce, cells));
    statements.push(recountStatement(ctx.env, projectId, sheetId));
    statements.push(projectSavedStatement(ctx.env, projectId, sheetId, nonce, now));
    const results = await ctx.env.PLAN_DB.batch(statements);
    const raised = (results[0]?.results ?? []) as { rev: number }[];
    if (raised.length === 0) {
      console.info('[sheets] sheets.write.retry', { attempt });
      continue;
    }
    const keys = cells.map((ch) => cellKey(ch.r, ch.c));
    const answer: SheetWriteResponse = {
      applied,
      rev: nextRev,
      cells: await readCells(ctx.env, projectId, sheetId, keys),
    };
    relaySheet(ctx, projectId, {
      kind: 'sheets',
      sheetId,
      tabId: head.tabId,
      rev: nextRev,
      applied,
      at: now,
      by,
      ...(body.wid ? { wid: body.wid } : {}),
    });
    if (applied.kind === 'layout' && deletes(write))
      await shrinkReaders(ctx, projectId, head, applied.changes, by);
    return json(answer);
  }
  return sheetBusy();
}
