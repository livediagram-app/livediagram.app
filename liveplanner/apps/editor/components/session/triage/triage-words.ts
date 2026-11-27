// Bug Triage's close tray words (docs/specs/026-plan/session-tabs.md "Bug Triage", "Running it"): the reasons it
// offers as chips and the reason a picked duplicate fills in. Pure.

// The reasons a Close offers as chips; any other words may be typed.
export const REASON_CHIPS = [
  'Won’t Fix',
  'Can’t Reproduce',
  'Duplicate',
  'Works as Intended',
  'Not a Bug',
] as const;

// The reason a picked duplicate fills in when none is typed yet.
export const duplicateReason = (ref: string) => `Duplicate of ${ref}`;
