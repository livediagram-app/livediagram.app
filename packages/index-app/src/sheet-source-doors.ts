// Sheet sources from an app's side (liveworkspace/docs/specs/004-index/sheet-sources.md "The door"): a source app
// (liveplanner) lists its sheets and reads one range of one, and a reader app (livedocuments) is told a watched sheet
// changed. Each takes the index's key alone (internal.ts checks it first); a door without its handler is a 404.
//
//   GET  /api/internal/items/:id/sheets           → { sheets }
//   POST /api/internal/items/:id/sheet-range      {sheetId, range | a1, cols?, watcher?} → the read
//   POST /api/internal/items/:id/source-changed   {app, itemId, sheetIds} → 202

import {
  readSheetRangeAsk,
  readSourceChange,
  type SheetListing,
  type SheetRangeAsk,
  type SheetRangeDoorRead,
  type SourceChange,
} from '@liveworkspace/index-client';
import { bodyOf, json, notFound, validId } from './internal-doors';

export type SheetListResult = { status: 'ok'; sheets: SheetListing[] } | { status: 'not_found' };
export type SheetRangeResult =
  | { status: 'ok'; read: SheetRangeDoorRead }
  | { status: 'not_found' }
  | { status: 'range_gone' }
  | { status: 'invalid_range' };

export type SheetSourceHandlers = {
  // A source app's sheets, for a picker.
  listSheets?: (itemId: string) => Promise<SheetListResult>;
  // What one range holds now, and (`watcher`, a reader item's id) a watch on its sheet. Reads only that range.
  sheetRange?: (
    itemId: string,
    ask: SheetRangeAsk,
    watcher: string | null,
  ) => Promise<SheetRangeResult>;
  // A reader app: a sheet its item draws from changed. Tells the item's open sessions; stores nothing.
  sourceChanged?: (itemId: string, change: SourceChange) => Promise<unknown>;
};

const SHEET_DOORS = new Set(['sheets', 'sheet-range', 'source-changed']);

// Whether `rest` (after `/api/internal/items/`) names one of these doors.
export const isSheetSourceDoor = (rest: readonly string[]): boolean =>
  rest.length === 2 && SHEET_DOORS.has(rest[1]!);

export async function answerSheetSourceDoor(
  request: Request,
  id: string,
  door: string,
  handlers: SheetSourceHandlers,
): Promise<Response> {
  if (door === 'sheets' && request.method === 'GET' && handlers.listSheets) {
    const result = await handlers.listSheets(id);
    return result.status === 'ok' ? json({ sheets: result.sheets }) : notFound();
  }
  if (door === 'sheet-range' && request.method === 'POST' && handlers.sheetRange) {
    const body = await bodyOf(request);
    const ask = readSheetRangeAsk(body);
    if (!ask) return json({ error: 'invalid_range' }, 400);
    const watcher = validId(body?.['watcher']) ? body['watcher'] : null;
    const result = await handlers.sheetRange(id, ask, watcher);
    if (result.status === 'ok') return json(result.read);
    if (result.status === 'range_gone') return json({ error: 'range_gone' }, 409);
    if (result.status === 'invalid_range') return json({ error: 'invalid_range' }, 400);
    return notFound();
  }
  if (door === 'source-changed' && request.method === 'POST' && handlers.sourceChanged) {
    const change = readSourceChange(await bodyOf(request));
    if (!change) return json({ error: 'bad_request' }, 400);
    try {
      await handlers.sourceChanged(id, change);
    } catch (err) {
      // The next change, or the next open, catches the readers up.
      console.warn('[internal] source changed failed', { error: String(err) });
    }
    return json({ ok: true }, 202);
  }
  return notFound();
}
