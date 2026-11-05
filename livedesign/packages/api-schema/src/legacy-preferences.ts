import type { PageKind } from '@livedesign/design';

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

// Every page kind the Pages tour has a track for (apps/live/lib/pages-tour.ts PAGES_TOUR_KINDS).
const PAGES_TOUR_KINDS: readonly PageKind[] = ['wireframe', 'logo', 'photo'];

export function upgradeLegacyPreferences<T extends Record<string, unknown>>(prefs: T): T {
  const keys = Object.keys(prefs);
  if (!keys.some((key) => RETIRED.has(key))) return prefs;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(prefs)) {
    if (!RETIRED.has(key)) out[key] = value;
  }
  // The mode's preset marked the Pages tour seen with its single flag, which counted every kind only while the mode
  // was on (docs/specs/007-editor/pages-tour.md). Kept as seen: every kind joins the answered list.
  if (prefs.powerUserMode === true && prefs.pagesTourSeen === true) {
    const answered = Array.isArray(prefs.pagesTourKinds) ? (prefs.pagesTourKinds as unknown[]) : [];
    out.pagesTourKinds = [...new Set([...answered, ...PAGES_TOUR_KINDS])];
  }
  return out as T;
}
