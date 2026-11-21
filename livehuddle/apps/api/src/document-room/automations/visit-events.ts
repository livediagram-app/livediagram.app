// The visit triggers' events (docs/specs/013-workspace/automations.md "Triggers of its own"; blueprint automations.md
// "Event call sites"): Someone Arrived, and Everyone Left's two edges, from the visits the room records
// (room-attendance.ts noteAttendance). Nothing is read unless a rule that is on hears a kind: `visitHearing` is three
// Set lookups, and only a heard kind probes the tab or reads its stretch. A rule's run opens no socket, so it is never
// a visitor.
import {
  SOMEONE_ARRIVED_EVENT,
  TAB_EMPTIED_EVENT,
  TAB_FILLED_EVENT,
  VISIT_COUNT_DATA,
  VISIT_EMPTY_DATA,
  VISIT_MINUTES_DATA,
  VISIT_PEOPLE_DATA,
  VISIT_PEOPLE_MAX,
} from '@livehuddle/document/automations';
import { ATTENDANCE_REJOIN_GRACE_MS, ATTENDANCE_TAB_MAX } from '@livehuddle/api-schema';
import type { ItemEngine } from '@liveworkspace/automations/room';
import { hearsEvent, queueEvent, roleOfLevel } from '@liveworkspace/automations/room';
import type { AttendanceSql } from '../../db/tab-attendance';
import type { SessionAttachment } from '../../room-session';

/** Which of the visit kinds a rule that is on hears now. */
export type VisitHearing = { arrived: boolean; filled: boolean; emptied: boolean };

export function visitHearing(engine: ItemEngine): VisitHearing {
  const host = { AUTOMATIONS: engine };
  return {
    arrived: hearsEvent(host, SOMEONE_ARRIVED_EVENT),
    filled: hearsEvent(host, TAB_FILLED_EVENT),
    emptied: hearsEvent(host, TAB_EMPTIED_EVENT),
  };
}

export const hearsAnyVisit = (h: VisitHearing): boolean => h.arrived || h.filled || h.emptied;

/** Whether anyone is in the tab now: one indexed probe. */
export function tabOccupied(sql: AttendanceSql, tabId: string): boolean {
  return (
    sql
      .exec(
        'SELECT 1 AS present FROM tab_attendance WHERE tab_id = ? AND left_at IS NULL LIMIT 1',
        tabId,
      )
      .toArray().length > 0
  );
}

/** What a tab's last stretch of company was: who, how many, and for how long. */
export type VisitStretch = { people: string; count: number; minutes: number };

type StretchRow = {
  id: number;
  person_key: string;
  name: string;
  joined_at: number;
  left_at: number;
};

/**
 * The stretch that just ended in the tab: its visits newest leaving first (at most ATTENDANCE_TAB_MAX), walked back
 * from the last leaving while each one leaves no earlier than the rejoin grace before the stretch's start. Its people
 * in the order they first came, by person, the first VISIT_PEOPLE_MAX named.
 */
export function stretchOf(sql: AttendanceSql, tabId: string): VisitStretch {
  const rows = sql
    .exec(
      `SELECT id, person_key, name, joined_at, left_at FROM tab_attendance
        WHERE tab_id = ? AND left_at IS NOT NULL ORDER BY left_at DESC, id DESC LIMIT ?`,
      tabId,
      ATTENDANCE_TAB_MAX,
    )
    .toArray() as StretchRow[];
  const last = rows[0];
  if (!last) return { people: '', count: 0, minutes: 0 };
  let start = last.joined_at;
  const kept: StretchRow[] = [];
  for (const row of rows) {
    if (row.left_at < start - ATTENDANCE_REJOIN_GRACE_MS) break;
    kept.push(row);
    start = Math.min(start, row.joined_at);
  }
  kept.sort((a, b) => a.joined_at - b.joined_at || a.id - b.id);
  const names = new Map<string, string>();
  for (const row of kept) if (!names.has(row.person_key)) names.set(row.person_key, row.name);
  return {
    people: [...names.values()].slice(0, VISIT_PEOPLE_MAX).join(', '),
    count: names.size,
    minutes: Math.round((last.left_at - start) / 60_000),
  };
}

/** Someone Arrived: a visit began (`inserted`, never a reconnect inside the grace). The room names nobody by
 *  account, so `by.id` is empty. */
export function queueArrival(
  engine: ItemEngine,
  input: { tab: string; key: string; session: SessionAttachment; wasEmpty: boolean; at: number },
): void {
  const presence = input.session.presence;
  queueEvent(
    { AUTOMATIONS: engine },
    {
      id: `arrived:${input.tab}:${input.key}:${input.at}`,
      kind: SOMEONE_ARRIVED_EVENT,
      at: input.at,
      tab: input.tab,
      by: { id: '', name: presence?.name ?? 'Someone', color: presence?.color ?? '#94a3b8' },
      role: roleOfLevel(input.session.verifiedRole),
      data: { [VISIT_EMPTY_DATA]: input.wasEmpty },
    },
  );
}

/** Everyone Left's first edge: someone came into a tab nobody was in, so a quiet stretch there is called off. */
export function queueFilled(engine: ItemEngine, tab: string, at: number): void {
  queueEvent(
    { AUTOMATIONS: engine },
    { id: `filled:${tab}:${at}`, kind: TAB_FILLED_EVENT, at, tab },
  );
}

/** Everyone Left's second edge: the last one left the tab, so its quiet stretch starts (or starts again). */
export function queueEmptied(
  engine: ItemEngine,
  sql: AttendanceSql,
  tab: string,
  at: number,
): void {
  const stretch = stretchOf(sql, tab);
  queueEvent(
    { AUTOMATIONS: engine },
    {
      id: `emptied:${tab}:${at}`,
      kind: TAB_EMPTIED_EVENT,
      at,
      tab,
      data: {
        [VISIT_PEOPLE_DATA]: stretch.people,
        [VISIT_COUNT_DATA]: stretch.count,
        [VISIT_MINUTES_DATA]: stretch.minutes,
      },
    },
  );
}
