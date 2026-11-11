import {
  closeStaleVisits,
  hasAttendanceTable,
  joinVisit,
  leaveVisit,
  touchOpenVisits,
  type AttendanceSql,
} from '../db/tab-attendance';
import type { SessionAttachment } from '../room-session';
import { armUpkeep } from './room-content-state';
import type { DocumentRoom } from './document-room';

// A tab's Attendance, the room's side (docs/specs/012-collaboration/tab-attendance.md; blueprint "Behaviour and
// state"): who was in each tab and when, recorded from the frames the room already handles. A person's visit to a tab
// begins with the first of their connections to show it and ends with the last one leaving it, so several devices are
// one visit; a return within the grace carries the visit on (db/tab-attendance.ts joinVisit). Nothing here runs on a
// cursor or any other frame: only a hello, a tab-focus and a socket closing.

/** The tabs a session shows: its tab and the other pane of a split, a tab-scoped session's scope only. */
export function claimedTabs(session: SessionAttachment | null): string[] {
  const presence = session?.presence;
  if (!presence) return [];
  const scope = session.tabScope ?? null;
  const tabs: string[] = [];
  for (const tab of [presence.tabId, presence.besideTabId]) {
    if (!tab || tabs.includes(tab)) continue;
    if (scope !== null && tab !== scope) continue;
    tabs.push(tab);
  }
  return tabs;
}

// The tabs the same person shows on their other connections: a tab one of them still shows is neither joined nor
// left by this one.
function tabsElsewhere(room: DocumentRoom, ws: WebSocket, key: string): Set<string> {
  const tabs = new Set<string>();
  for (const other of room.state.getWebSockets()) {
    if (other === ws) continue;
    const session = room.readSession(other);
    if (session?.presence?.key !== key) continue;
    for (const tab of claimedTabs(session)) tabs.add(tab);
  }
  return tabs;
}

// Only a tab the document has is recorded, so a frame naming made-up tabs writes nothing.
function documentHasTab(sql: AttendanceSql, tabId: string): boolean {
  return sql.exec('SELECT 1 AS present FROM document_tabs WHERE tab_id = ? LIMIT 1', tabId).toArray()
    .length > 0;
}

/**
 * One session's tabs changed from `before` to `after` (null: it said no hello yet, or it is closing). Joins the tabs
 * it gained and leaves the ones it lost, unless another of the same person's connections shows them. A store failure
 * is logged and never breaks the frame or the close.
 */
export function noteAttendance(
  room: DocumentRoom,
  ws: WebSocket,
  before: SessionAttachment | null,
  after: SessionAttachment | null,
  now = Date.now(),
): void {
  const key = after?.presence?.key ?? before?.presence?.key;
  if (!key) return;
  const was = claimedTabs(before);
  const is = claimedTabs(after);
  const gained = is.filter((tab) => !was.includes(tab));
  const lost = was.filter((tab) => !is.includes(tab));
  if (gained.length === 0 && lost.length === 0) return;
  const sql = room.state.storage.sql;
  // A document never started stores nothing of anyone.
  if (!sql || !room.hasSchema()) return;
  try {
    room.ensureSchema();
    const elsewhere = tabsElsewhere(room, ws, key);
    let wrote = false;
    const presence = after?.presence;
    for (const tab of gained) {
      if (!presence || elsewhere.has(tab) || !documentHasTab(sql, tab)) continue;
      joinVisit(
        sql,
        tab,
        key,
        {
          name: presence.name,
          color: presence.color,
          picture: presence.picture ?? null,
          guest: after.account !== true,
        },
        now,
      );
      wrote = true;
    }
    for (const tab of lost) {
      if (elsewhere.has(tab)) continue;
      leaveVisit(sql, tab, key, now);
      wrote = true;
    }
    if (!wrote) return;
    touchOpenVisits(sql, now);
    armUpkeep(room);
  } catch (error) {
    console.warn('[attendance] not recorded', { error: String(error) });
  }
}

/**
 * The room is starting with nobody connected: every visit still open lost its close (a deploy ends every socket
 * without telling the room), so each ends when the room last saw it (db/tab-attendance.ts closeStaleVisits). A wake
 * from hibernation still has its sockets, and sweeps nothing.
 */
export function sweepStaleAttendance(room: DocumentRoom, now = Date.now()): void {
  if (room.state.getWebSockets().length > 0) return;
  const sql = room.state.storage.sql;
  if (!sql || !room.hasSchema()) return;
  try {
    if (!hasAttendanceTable(sql)) return;
    const closed = closeStaleVisits(sql, now);
    if (closed > 0) console.info('[attendance] swept', { stale: closed });
  } catch (error) {
    console.warn('[attendance] not swept', { error: String(error) });
  }
}
