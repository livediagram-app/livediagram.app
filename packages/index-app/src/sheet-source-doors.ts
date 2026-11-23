// Sheet sources from an app's side (liveworkspace/docs/specs/004-index/sheet-sources.md "The door"): a source app
// (liveplanner) lists its sheets and reads one range of one, and a reader app (livedocuments) is told a watched sheet
// changed. Each takes the index's key alone (internal.ts checks it first); a door without its handler is a 404.
//
//   GET  /api/internal/items/:id/sheets           → { sheets }
//   POST /api/internal/items/:id/sheet-range      {sheetId, range | a1, cols?, watcher?} → the read
//   POST /api/internal/items/:id/source-changed   {app, itemId, sheetIds} → 202
//   GET  /api/internal/items/:id/plan-data        → {boards, metrics, filters} (live-data.md)
//   POST /api/internal/items/:id/plan-data        {kind: board | metric, …, watcher?} → the read

import {
  readPlanDataAsk,
  readSheetRangeAsk,
  readSourceChange,
  type PlanDataAsk,
  type PlanDataDoorListing,
  type PlanDataDoorRead,
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

export type PlanDataListResult =
  { status: 'ok'; listing: PlanDataDoorListing } | { status: 'not_found' };
export type PlanDataResult = { status: 'ok'; read: PlanDataDoorRead } | { status: 'not_found' };

export type SheetSourceHandlers = {
  // A source app's sheets, for a picker.
  listSheets?: (itemId: string) => Promise<SheetListResult>;
  // What one range holds now, and (`watcher`, a reader item's id) a watch on its sheet. Reads only that range.
  sheetRange?: (
    itemId: string,
    ask: SheetRangeAsk,
    watcher: string | null,
  ) => Promise<SheetRangeResult>;
  // Live data (live-data.md): a source app's boards, metrics and filter values; one board's counts or one metric's rows
  // now, and (`watcher`) a watch on the plan's cards. Reads only the counts.
  planDataList?: (itemId: string) => Promise<PlanDataListResult>;
  planData?: (itemId: string, ask: PlanDataAsk, watcher: string | null) => Promise<PlanDataResult>;
  // A reader app: a sheet its item draws from changed. Tells the item's open sessions; stores nothing.
  sourceChanged?: (itemId: string, change: SourceChange) => Promise<unknown>;
};

const SHEET_DOORS = new Set(['sheets', 'sheet-range', 'source-changed', 'plan-data']);

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
  if (door === 'plan-data' && request.method === 'GET' && handlers.planDataList) {
    const result = await handlers.planDataList(id);
    return result.status === 'ok' ? json(result.listing) : notFound();
  }
  if (door === 'plan-data' && request.method === 'POST' && handlers.planData) {
    const body = await bodyOf(request);
    const ask = readPlanDataAsk(body);
    if (!ask) return json({ error: 'invalid_source' }, 400);
    const watcher = validId(body?.['watcher']) ? body['watcher'] : null;
    const result = await handlers.planData(id, ask, watcher);
    return result.status === 'ok' ? json(result.read) : notFound();
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

// The frame a reader item's room sends every open session when a Sheet its charts read changed: ids only, never
// values. Each session reads the range again with its own access, so nobody learns a value they could not read.
export type SourceChangedFrame = { kind: 'source-changed' } & SourceChange;

// The reader app's room side of the `source-changed` door, one copy for every reader app (livedocuments, livediagram,
// livedesign): bind the room to its item, then tell every session. Nothing is stored.
export function tellSourceChanged(
  room: { bind: (itemId: string) => void; broadcast: (frame: SourceChangedFrame) => void },
  itemId: string,
  change: SourceChange,
): void {
  room.bind(itemId);
  room.broadcast({
    kind: 'source-changed',
    app: change.app,
    itemId: change.itemId,
    sheetIds: change.sheetIds,
  });
}
