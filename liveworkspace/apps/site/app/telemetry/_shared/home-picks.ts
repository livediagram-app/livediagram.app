// Home·Selected's two halves, for every app's Home charts (docs/specs/008-telemetry/telemetry.md "The Explorer on
// liveworkspace.app"): the first-run Home's starts, and the picks from Home's lists. Jump Back In became Most Used and
// Recent, and in November 2026 its picks took the new names (Work Tracker 727): `MostUsed`, `Recent` and `SeeMore`,
// where they were `JumpBackIn.MostUsed`, `.Recent` and `.SeeMore`. One chart reads both names, so its history runs
// on unbroken across the rename.

/** A start taken from the first-run Home. */
export const HOME_START_TYPES = [
  'Welcome.Blank',
  'Welcome.Template',
  'Welcome.AllTemplates',
  'Welcome.Search',
  'Welcome.StartBlank',
  'Welcome.SignIn',
] as const;

/** An item opened from Most Used or Recent, or See More followed: the names sent now, then the old ones. */
export const HOME_PICK_TYPES = [
  'MostUsed',
  'Recent',
  'SeeMore',
  'JumpBackIn.MostUsed',
  'JumpBackIn.Recent',
  'JumpBackIn.SeeMore',
] as const;
