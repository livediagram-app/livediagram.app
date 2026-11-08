// Preference keys whose feature is gone (docs/specs/007-editor/user-preferences.md "Retired keys"): dropped on read,
// so the next write stores the blob without them (the sync sends a null for each key the server held). Nothing is
// written on load.
const RETIRED: ReadonlySet<string> = new Set([
  // Power user mode, its Minimal chrome and its one-time offer (docs/specs/007-editor/power-user-mode.md): retired.
  // Whatever its preset wrote stays; only these go.
  'powerUserMode',
  'powerUserBaseline',
  'minimalChrome',
  'powerUserOfferShown',
]);

// Every track of the Plan tour (apps/editor/lib/plan-tour.ts PLAN_TOUR_TRACKS; its tests hold the two together).
const PLAN_TOUR_TRACKS: readonly string[] = [
  'boards',
  'card-types',
  'board-setup',
  'sheets',
  'dashboards',
];

export function upgradeLegacyPreferences<T extends Record<string, unknown>>(prefs: T): T {
  const keys = Object.keys(prefs);
  if (!keys.some((key) => RETIRED.has(key))) return prefs;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(prefs)) {
    if (!RETIRED.has(key)) out[key] = value;
  }
  // The mode's preset marked the Plan tour seen with its single flag, which counted every track only while the mode
  // was on (docs/specs/026-plan/plan-tour.md). Kept as seen: every track joins the answered list.
  if (prefs.powerUserMode === true && prefs.planTourSeen === true) {
    const answered = Array.isArray(prefs.planTourTracks) ? (prefs.planTourTracks as unknown[]) : [];
    out.planTourTracks = [...new Set([...answered, ...PLAN_TOUR_TRACKS])];
  }
  return out as T;
}
