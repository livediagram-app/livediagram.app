import { isPowerUserMode } from './power-user-mode';
import type { UserPreferences } from './user-preferences';

// A tour of several tracks offers each one once (docs/specs/007-editor/user-preferences.md "Tours"): the Plan tour's
// Boards and Sheets tracks. A synced list holds the tracks answered (taken, skipped
// or declined). The tour's older single flag (`planTourSeen`) counts every track as seen only
// while Power user mode is on, the one place it is still written: an answer given to the single tour before it
// split stands for no track in particular, so each track is offered once more.

/** Whether `track` has been answered, or the tour is off for a power user. */
export function tourTrackSeen<T>(
  prefs: UserPreferences | null | undefined,
  answered: readonly T[] | undefined,
  allSeen: boolean | undefined,
  track: T,
): boolean {
  if ((answered ?? []).includes(track)) return true;
  return allSeen === true && !!prefs && isPowerUserMode(prefs);
}

/** The answered list with `tracks` added, each once, in the order answered. */
export function withTracksAnswered<T>(
  answered: readonly T[] | undefined,
  tracks: readonly T[],
): T[] {
  return [...new Set([...(answered ?? []), ...tracks])];
}
