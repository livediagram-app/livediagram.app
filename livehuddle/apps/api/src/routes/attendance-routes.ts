// A tab's Attendance route (docs/specs/012-collaboration/tab-attendance.md "The wire"): who was in the tab and when,
// for an Editor or a Participant. The room records the visits (document-room/room-attendance.ts); this only reads
// them. A visit names a person by what the roster showed of them, never an id, and their picture goes only to a
// signed-in reader, as the roster's pictures do.

import { collabKeyFor } from '@liveworkspace/api-kit/collab-key';
import { logRefusal } from '@liveworkspace/api-kit/refusal-log';
import {
  ATTENDANCE_RETENTION_DAYS,
  ATTENDANCE_TAB_MAX,
  type AttendanceVisit,
  type TabAttendanceResponse,
} from '@livehuddle/api-schema';
import { documentHasTab, getDocument, listVisits } from '../db';
import { json, methodNotAllowed, notFound } from '../responses';
import {
  deniedParticipate,
  gateParticipate,
  missingDocument,
  requireOwner,
  type DocumentRouteContext,
} from './context';

async function list(ctx: DocumentRouteContext, id: string, tabId: string): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getDocument(ctx.env, id);
  if (!doc) return missingDocument(ctx, id);
  if (!(await gateParticipate(ctx, id, doc.ownerId, doc.teamId, tabId)))
    return deniedParticipate(ctx, doc, tabId);
  if (!(await documentHasTab(ctx.env, id, tabId))) return notFound();
  const [rows, ownKey] = await Promise.all([
    listVisits(ctx.env.DOCUMENT_DB, tabId, Date.now()),
    collabKeyFor(owner),
  ]);
  const pictures = ctx.accountUserId !== null;
  const visits = rows.map(
    (r): AttendanceVisit => ({
      id: r.id,
      name: r.name,
      color: r.color,
      ...(pictures && r.picture ? { picture: r.picture } : {}),
      guest: r.guest === 1,
      self: r.person_key === ownKey,
      joinedAt: r.joined_at,
      leftAt: r.left_at,
    }),
  );
  // Counts only: the log is read by people too.
  console.info('[attendance] listed', { documentId: id, tabId, count: visits.length });
  const res: TabAttendanceResponse = {
    visits,
    retentionDays: ATTENDANCE_RETENTION_DAYS,
    perTabMax: ATTENDANCE_TAB_MAX,
  };
  return json(res);
}

async function attendanceRoute(ctx: DocumentRouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments.length !== 6 || segments[3] !== 'tabs' || segments[5] !== 'attendance') return null;
  return request.method === 'GET' ? list(ctx, segments[2]!, segments[4]!) : methodNotAllowed();
}

/** The Attendance route, or null for a path that is not its. Each refusal is logged once, with its code. */
export async function handleAttendanceRoutes(ctx: DocumentRouteContext): Promise<Response | null> {
  const res = await attendanceRoute(ctx);
  if (res && res.status >= 400)
    await logRefusal('[attendance] refused', res, {
      documentId: ctx.segments[2],
      tabId: ctx.segments[4] ?? null,
    });
  return res;
}
