// A tour of several tracks offers each one once (docs/specs/007-editor/user-preferences.md "Getting Started"): the Pages tour's
// page kinds and the element tours. A synced list holds the tracks answered (taken, skipped or declined). The element
// tours' single flag counts every track as seen: Settings writes it when their switch goes off, as the retired Power
// user mode's preset did. The Pages tour's older single flag counts none (lib/pages-tour.ts).

/** Whether `track` has been answered, or every track has. */
export function tourTrackSeen<T>(
  answered: readonly T[] | undefined,
  allSeen: boolean | undefined,
  track: T,
): boolean {
  if ((answered ?? []).includes(track)) return true;
  return allSeen === true;
}

/** The answered list with `tracks` added, each once, in the order answered. */
export function withTracksAnswered<T>(
  answered: readonly T[] | undefined,
  tracks: readonly T[],
): T[] {
  return [...new Set([...(answered ?? []), ...tracks])];
}
