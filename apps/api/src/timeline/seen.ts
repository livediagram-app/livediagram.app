// The unread mark's visit rule (docs/specs/013-workspace/timeline.md §2.5), shared by the Timeline
// page and Explorer Home (docs/specs/013-workspace/explorer-home.md "Unread"), which both move it.
//
// How long one "visit" lasts. Without a window the mark moves on EVERY read, so a second request
// inside the same visit reports nothing new and the New markers vanish before the reader has looked
// at them: a client can easily fetch twice on mount (React's development double-effect does exactly
// that), and tabbing away and straight back would wipe them too. A window makes the semantics what a
// person would expect: "since I was last here", not "since my last HTTP request".
export const SEEN_WINDOW_MS = 60_000;

/** Whether this read starts a new visit, so the mark moves: no mark yet, or one older than the
 *  window. */
export function isNewVisit(lastSeenAt: number | null | undefined, now: number): boolean {
  return !lastSeenAt || now - lastSeenAt > SEEN_WINDOW_MS;
}
