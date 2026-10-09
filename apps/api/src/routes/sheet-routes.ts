// The sheet store's endpoints (docs/specs/029-sheets/sheet-store.md, blueprint sheet-store.md "Interfaces and
// contracts"): list, create (blank, filled or a copy) and delete under /api/documents/:id/sheets, and each sheet's
// writes (sheet-write-route.ts). People and agents use the same doors; every change reaches the room as an
// ordered `sheets` op.

import type { SheetCreateRequest, SheetResponse, SheetsResponse } from '@livediagram/api-schema';
import {
  DOCUMENT_CELLS_MAX,
  DOCUMENT_SHEETS_MAX,
  SHEET_CELLS_MAX,
  SHEET_TITLE_MAX,
  SHEET_WRITE_CELLS_MAX,
  emptyLayout,
  isSheetId,
  makeSheetId,
  sheetFromJson,
  validateSheetCreate,
  type SheetCellJson,
  type SheetJson,
  type SheetLayout,
  type SheetPerson,
} from '@livediagram/sheets';
import {
  copySheetStatements,
  deleteSheetStatement,
  documentSheetTotals,
  getTab,
  insertSheetStatements,
  listSheetHeads,
  listSheets,
  readSheetHead,
} from '../db';
import { json, methodNotAllowed, noContent } from '../responses';
import { readBody, type RouteContext } from './context';
import { writer } from './item-route-kit';
import {
  relaySheet,
  sheetCaller,
  sheetNotFound,
  sheetRejected,
  type SheetCaller,
} from './sheet-route-kit';
import { writeSheet } from './sheet-write-route';

const IDS_PER_GET_MAX = 50;

async function list(ctx: RouteContext, documentId: string): Promise<Response> {
  const caller = await sheetCaller(ctx, documentId, 'read');
  if (caller instanceof Response) return caller;
  const tabId = ctx.url.searchParams.get('tabId') ?? undefined;
  const idsParam = ctx.url.searchParams.get('ids');
  const ids = idsParam ? idsParam.split(',').filter(Boolean) : undefined;
  if (ids && (ids.length > IDS_PER_GET_MAX || !ids.every(isSheetId)))
    return sheetRejected('write_invalid');
  let sheets = await listSheets(ctx.env, documentId, ids ? { ids } : tabId ? { tabId } : {});
  if (caller.scopeTab) sheets = sheets.filter((s) => s.tabId === caller.scopeTab);
  const body: SheetsResponse = { sheets };
  return json(body);
}

function titleTaken(
  heads: { id: string; title: string }[],
  title: string,
  except?: string,
): boolean {
  const lower = title.toLowerCase();
  return heads.some((h) => h.id !== except && h.title.toLowerCase() === lower);
}

type ReadCreate = { create: SheetCreateRequest } | { error: Response };

function readCreate(raw: unknown, maxCells = SHEET_WRITE_CELLS_MAX): ReadCreate {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return { error: sheetRejected('write_invalid') };
  const b = raw as Record<string, unknown>;
  if (typeof b.tabId !== 'string' || !b.tabId) return { error: sheetRejected('write_invalid') };
  if (typeof b.title !== 'string' || !b.title.trim() || b.title.trim().length > SHEET_TITLE_MAX)
    return { error: sheetRejected('title_invalid') };
  if (b.id !== undefined && !isSheetId(b.id)) return { error: sheetRejected('write_invalid') };
  if (b.copyOf !== undefined && !isSheetId(b.copyOf))
    return { error: sheetRejected('write_invalid') };
  if (b.cells !== undefined && !Array.isArray(b.cells))
    return { error: sheetRejected('write_invalid') };
  if (Array.isArray(b.cells) && b.cells.length > maxCells)
    return { error: sheetRejected('write_too_large', 413) };
  return {
    create: {
      tabId: b.tabId,
      title: b.title.trim(),
      ...(typeof b.id === 'string' ? { id: b.id } : {}),
      ...(typeof b.copyOf === 'string' ? { copyOf: b.copyOf } : {}),
      ...(b.layout !== undefined ? { layout: b.layout as SheetLayout } : {}),
      ...(b.cells !== undefined ? { cells: b.cells as SheetCellJson[] } : {}),
    },
  };
}

// Make a sheet (the route, and a new document's seed). Returns the stored sheet, or a refusal.
async function makeSheet(
  ctx: RouteContext,
  caller: SheetCaller,
  create: SheetCreateRequest,
  by: SheetPerson,
  checkTab = true,
): Promise<SheetJson | Response> {
  const { documentId } = caller;
  if (caller.scopeTab && create.tabId !== caller.scopeTab)
    return sheetRejected('tab_not_found', 404);
  if (checkTab && !(await getTab(ctx.env, documentId, create.tabId)))
    return sheetRejected('tab_not_found', 404);
  const id = create.id ?? makeSheetId();
  if (await readSheetHead(ctx.env, documentId, id)) return sheetRejected('sheet_exists', 409);
  const heads = await listSheetHeads(ctx.env, documentId, create.tabId);
  if (titleTaken(heads, create.title)) return sheetRejected('sheet_title_taken', 409);
  const totals = await documentSheetTotals(ctx.env, documentId);
  if (totals.sheets >= DOCUMENT_SHEETS_MAX) return sheetRejected('sheets_full', 413);
  const now = Date.now();
  if (create.copyOf) {
    const source = await readSheetHead(ctx.env, documentId, create.copyOf);
    if (!source || (caller.scopeTab && source.tabId !== caller.scopeTab)) return sheetNotFound();
    if (totals.cells + source.cellCount > DOCUMENT_CELLS_MAX)
      return sheetRejected('sheets_full', 413);
    await ctx.env.DB.batch(
      copySheetStatements(
        ctx.env,
        documentId,
        create.copyOf,
        { id, tabId: create.tabId, title: create.title, by },
        now,
      ),
    );
  } else {
    const sheet: SheetJson = {
      id,
      tabId: create.tabId,
      title: create.title,
      layout: create.layout ?? emptyLayout(),
      cells: create.cells ?? [],
      rev: 0,
      createdAt: now,
      updatedAt: now,
      updatedBy: by,
    };
    let check;
    try {
      check = validateSheetCreate(sheetFromJson(sheet));
    } catch {
      return sheetRejected('write_invalid');
    }
    if (!check.ok)
      return sheetRejected(check.error, check.error === 'sheet_full' ? 413 : 400, check.at);
    if (totals.cells + sheet.cells.length > DOCUMENT_CELLS_MAX)
      return sheetRejected('sheets_full', 413);
    await ctx.env.DB.batch(insertSheetStatements(ctx.env, documentId, sheet, now));
  }
  const [stored] = await listSheets(ctx.env, documentId, { ids: [id] });
  relaySheet(ctx, documentId, {
    kind: 'sheets',
    sheetId: id,
    tabId: create.tabId,
    rev: stored!.rev,
    created: true,
  });
  console.info('[sheets] sheets.created', {
    documentId,
    copy: !!create.copyOf,
    agent: ctx.token !== null,
  });
  return stored!;
}

async function create(ctx: RouteContext, documentId: string): Promise<Response> {
  const caller = await sheetCaller(ctx, documentId, 'edit');
  if (caller instanceof Response) return caller;
  const read = readCreate(await readBody(ctx));
  if ('error' in read) return read.error;
  const made = await makeSheet(ctx, caller, read.create, await writer(ctx, caller.owner));
  if (made instanceof Response) return made;
  const body: SheetResponse = { sheet: made };
  return json(body, { status: 201 });
}

async function remove(ctx: RouteContext, documentId: string, sheetId: string): Promise<Response> {
  const caller = await sheetCaller(ctx, documentId, 'edit');
  if (caller instanceof Response) return caller;
  const head = await readSheetHead(ctx.env, documentId, sheetId);
  if (!head || (caller.scopeTab && head.tabId !== caller.scopeTab)) return sheetNotFound();
  await ctx.env.DB.batch([deleteSheetStatement(ctx.env, documentId, sheetId)]);
  relaySheet(ctx, documentId, {
    kind: 'sheets',
    sheetId,
    tabId: head.tabId,
    rev: head.rev + 1,
    deleted: true,
  });
  console.info('[sheets] sheets.deleted', { documentId, agent: ctx.token !== null });
  return noContent();
}

// The sheet routes, or null for a path that is not theirs.
export async function handleSheetRoutes(ctx: RouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments[3] !== 'sheets') return null;
  const documentId = segments[2]!;
  const method = request.method;
  if (segments.length === 4) {
    if (method === 'GET') return list(ctx, documentId);
    if (method === 'POST') return create(ctx, documentId);
    return methodNotAllowed();
  }
  const sheetId = segments[4]!;
  if (segments.length === 5)
    return method === 'DELETE' ? remove(ctx, documentId, sheetId) : methodNotAllowed();
  if (segments.length === 6 && segments[5] === 'writes')
    return method === 'POST' ? writeSheet(ctx, documentId, sheetId) : methodNotAllowed();
  return null;
}

// A document create's seed sheets (an offline document's, a duplicate's), read before anything is written.
export function readSeedSheets(raw: unknown): SheetCreateRequest[] | Response {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > DOCUMENT_SHEETS_MAX)
    return sheetRejected('sheets_full', 413);
  const out: SheetCreateRequest[] = [];
  for (const entry of raw) {
    // A seed carries a whole sheet (an offline one, a duplicate's), up to its cap.
    const read = readCreate(entry, SHEET_CELLS_MAX);
    if ('error' in read) return read.error;
    out.push(read.create);
  }
  return out;
}

// Writes a new document's seed sheets. Their tab ids are the new document's (the client made them); no room is
// open yet, so the relay reaches nobody.
export async function seedSheets(
  ctx: RouteContext,
  documentId: string,
  owner: string,
  creates: SheetCreateRequest[],
): Promise<Response | null> {
  const caller: SheetCaller = { documentId, owner, scopeTab: null };
  const by = await writer(ctx, owner);
  for (const c of creates) {
    const made = await makeSheet(ctx, caller, c, by, false);
    if (made instanceof Response) return made;
  }
  return null;
}
