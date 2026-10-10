// A tab's derived-index writes made only while the tab still holds the revision they were derived
// from (docs/specs/013-workspace/activity-page.md §2.3). A save writes its index in the blob's own
// batch and needs no guard; a reader that derives the index from a blob it read EARLIER (the
// collaboration index backfill) does, or a save landing between its read and its write would be
// reverted to the older blob's rows.
//
// Positional `?` binds, appended after the statement's own: the guard is the statement's last clause.

export type TabRevGuard = { tabId: string; rev: number } | null;

const GUARD = 'EXISTS (SELECT 1 FROM tabs WHERE id = ? AND rev = ?)';

/** What a `... WHERE tab_id = ?` DELETE appends; nothing without a guard, so a save's SQL is as it was. */
export function revGuardAnd(guard: TabRevGuard): string {
  return guard ? ` AND ${GUARD}` : '';
}

/** An INSERT's row source for `n` columns: `VALUES (...)`, or a guarded `SELECT` with one. */
export function revGuardValues(n: number, guard: TabRevGuard): string {
  const slots = Array.from({ length: n }, () => '?').join(', ');
  return guard ? `SELECT ${slots} WHERE ${GUARD}` : `VALUES (${slots})`;
}

/** The guard's binds, appended after the statement's own. */
export function revGuardBinds(guard: TabRevGuard): (string | number)[] {
  return guard ? [guard.tabId, guard.rev] : [];
}
