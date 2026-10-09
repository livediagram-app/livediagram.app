// The sheet routes' shared parts (sheet-routes.ts, sheet-write-route.ts): who the caller is and which tab they are
// confined to, the refusals, the writer, and the room relay (docs/specs/029-sheets/sheet-store.md "Who may do
// what", "Live for everyone").
import type { SheetError, SheetsRoomOp } from '@livediagram/api-schema';
import { getDocument } from '../db';
import { json } from '../responses';
import { relaySheets } from '../room-client';
import {
  deniedOnTab,
  gateEdit,
  gateParticipate,
  gateGrant,
  gateRead,
  missingDocument,
  requireOwner,
  type RouteContext,
} from './context';
import { forbidden } from '../responses';

export type SheetCaller = {
  documentId: string;
  owner: string;
  // The one tab a tab-scoped grant reaches, or null for the whole document.
  scopeTab: string | null;
  // The document's owner and team, for a second gate on the same caller (sheetCallerEdits).
  ownerId: string;
  teamId: string | null;
};

// Whether a caller already admitted at participate also holds edit (docs/specs/013-workspace/share-roles.md): one
// more gate, on the document the first one read, asked only for a write that changes a Sheet's shape.
export function sheetCallerEdits(ctx: RouteContext, caller: SheetCaller): Promise<boolean> {
  return gateEdit(
    ctx,
    caller.documentId,
    caller.ownerId,
    caller.teamId,
    caller.scopeTab ?? undefined,
  );
}

// A relay larger than this asks clients to fetch the sheet instead (blueprint sheet-store.md, D5).
export const SHEET_RELAY_BYTES_MAX = 262_144;
export const SHEET_WRITE_RETRIES = 3;

const GATES = { read: gateRead, participate: gateParticipate, edit: gateEdit } as const;

export function sheetRejected(error: SheetError, status = 400, at?: string): Response {
  console.info('[sheets] sheets.rejected', { error });
  return json({ error, ...(at ? { at } : {}) }, { status });
}

export const sheetNotFound = () => sheetRejected('sheet_not_found', 404);

export const sheetBusy = () => {
  console.warn('[sheets] sheets.write.busy');
  return sheetRejected('sheet_busy', 409);
};

// The caller and their reach: the whole document, or (a tab-scoped grant) the sheets of one tab, which the request
// names as `?tabId=`.
export async function sheetCaller(
  ctx: RouteContext,
  documentId: string,
  level: 'read' | 'participate' | 'edit',
): Promise<SheetCaller | Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getDocument(ctx.env, documentId);
  if (!doc) return missingDocument(ctx, documentId);
  const gate = GATES[level];
  if (await gate(ctx, documentId, doc.ownerId, doc.teamId))
    return { documentId, owner, scopeTab: null, ownerId: doc.ownerId, teamId: doc.teamId };
  const tabId = ctx.url.searchParams.get('tabId');
  if (!tabId) {
    const grant = await gateGrant(ctx, documentId, doc.ownerId, doc.teamId);
    return grant && grant.tabScope === null ? forbidden() : deniedOnTab(ctx, doc);
  }
  if (!(await gate(ctx, documentId, doc.ownerId, doc.teamId, tabId))) return deniedOnTab(ctx, doc);
  return { documentId, owner, scopeTab: tabId, ownerId: doc.ownerId, teamId: doc.teamId };
}

export function relaySheet(ctx: RouteContext, documentId: string, op: SheetsRoomOp): void {
  const size = JSON.stringify(op).length;
  const sent: SheetsRoomOp =
    size > SHEET_RELAY_BYTES_MAX
      ? {
          kind: 'sheets',
          sheetId: op.sheetId,
          tabId: op.tabId,
          rev: op.rev,
          refetch: true,
          ...(op.wid ? { wid: op.wid } : {}),
        }
      : op;
  ctx.waitUntil?.(relaySheets(ctx.env, documentId, sent));
}
