// A tour of several tracks offers each one once (docs/specs/007-editor/user-preferences.md "Getting Started"): the Plan tour's
// Boards, Sheets and Dashboards tracks. A synced list holds the tracks answered (taken, skipped or declined).

/** The answered list with `tracks` added, each once, in the order answered. */
export function withTracksAnswered<T>(
  answered: readonly T[] | undefined,
  tracks: readonly T[],
): T[] {
  return [...new Set([...(answered ?? []), ...tracks])];
}
