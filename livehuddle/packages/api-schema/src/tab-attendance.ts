// A tab's Attendance on the wire (docs/specs/012-collaboration/tab-attendance.md): who was in a tab and when, as
// an Editor or a Participant reads it. A visit names a person by what the roster already showed of them (name,
// colour, picture), never by an id.

/** How long a visit is kept after it ends (the spec's "How long it is kept"). */
export const ATTENDANCE_RETENTION_DAYS = 90;
export const ATTENDANCE_RETENTION_MS = ATTENDANCE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
/** Visits kept per tab: a new one past this deletes the oldest. */
export const ATTENDANCE_TAB_MAX = 500;
/** Back in a tab within this of leaving it carries on the same visit (a reconnect, a reload, a quick hop). */
export const ATTENDANCE_REJOIN_GRACE_MS = 2 * 60 * 1000;

/** One person's stretch in one tab. `leftAt` is null while they are still there. */
export type AttendanceVisit = {
  id: number;
  name: string;
  color: string;
  // Their Google picture, sent only to a signed-in reader (as the roster sends pictures).
  picture?: string;
  guest: boolean;
  // The visit is the reader's own.
  self: boolean;
  joinedAt: number;
  leftAt: number | null;
};

/** `GET /api/documents/:id/tabs/:tabId/attendance`: the tab's visits, newest first. */
export type TabAttendanceResponse = {
  visits: AttendanceVisit[];
  retentionDays: number;
  perTabMax: number;
};
