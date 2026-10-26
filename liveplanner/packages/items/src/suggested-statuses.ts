// Suggested statuses (docs/specs/026-plan/plan-board.md "Suggested statuses"): the common statuses offered where a
// board's columns are chosen and the project has no state to offer, so nobody has to invent the usual ones. Done is
// last, as a board's done column usually ends it. Pure.
import { statusKey } from './status-names';

export interface SuggestedStatus {
  name: string;
  // The quiet line under its name: what the status is for.
  hint: string;
}

// The most suggested at once (the spec's "up to five").
export const SUGGESTED_STATUSES_MAX = 5;

// In the order a board runs (blueprints/DEFAULTS.md D53).
export const SUGGESTED_STATUSES: readonly SuggestedStatus[] = [
  { name: 'Backlog', hint: 'Ideas and work for later' },
  { name: 'To Do', hint: 'Ready to start' },
  { name: 'In Progress', hint: 'Being worked on' },
  { name: 'In Review', hint: 'Waiting for a check' },
  { name: 'Done', hint: 'Finished' },
];

// Where suggestion `name` goes among columns named `names` (left to right), so suggestions keep the order a board runs
// whatever order they are pressed in: before the first column that is a later suggestion (Done stays last), else at
// the end. A name that is no suggestion goes at the end.
export function suggestionIndex(names: readonly string[], name: string): number {
  const rank = (n: string) =>
    SUGGESTED_STATUSES.findIndex((s) => statusKey(s.name) === statusKey(n));
  const own = rank(name);
  if (own < 0) return names.length;
  const at = names.findIndex((n) => rank(n) > own);
  return at < 0 ? names.length : at;
}

// The suggestions whose name (as names compare) none of `taken` has: the board's columns (or those Setup Board has
// chosen) and the project's statuses. In order, at most SUGGESTED_STATUSES_MAX. O(taken + suggestions).
export function suggestedStatuses(taken: Iterable<string>): SuggestedStatus[] {
  const keys = new Set<string>();
  for (const name of taken) keys.add(statusKey(name));
  return SUGGESTED_STATUSES.filter((s) => !keys.has(statusKey(s.name))).slice(
    0,
    SUGGESTED_STATUSES_MAX,
  );
}
