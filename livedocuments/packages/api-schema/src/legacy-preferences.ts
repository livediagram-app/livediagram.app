import type { PageKind } from '@livedocuments/document';

// Preference keys renamed (docs/specs/007-editor/user-preferences.md): `notifyDiagramJoin` when the
// container became a document (stored rows migrated in D1). This upgrades a copy that
// can still arrive from elsewhere (a browser's localStorage cache, a row written by an old client
// during the deploy). An opt-out must never be lost on the way.
const RENAMED: Readonly<Record<string, string>> = {
  notifyDiagramJoin: 'notifyDocumentJoin',
  // Illustrate mode became Pages mode (docs/specs/007-editor/pages-mode.md "One mode";
  // migration 0097): a lost seen-guard would offer the tour again.
  illustrateTourSeen: 'pagesTourSeen',
  illustrateTourKinds: 'pagesTourKinds',
};

// Preference keys whose feature is gone (docs/specs/007-editor/user-preferences.md "Retired keys"):
// dropped on read, so the next write stores the blob without them.
const RETIRED: ReadonlySet<string> = new Set([
  // The Activity panel (docs/specs/012-collaboration/README.md "Removed: the Activity panel").
  'activityPanelEnabled',
  'activityRevertHoverPreview',
  // The Settings › Experimental switches for Pages and Plan modes: Pages is the one mode now
  // (docs/specs/007-editor/pages-mode.md "One mode"). Pages mode was Illustrate mode, and
  // Infographic mode before that.
  'illustrateModeEnabled',
  'infographicModeEnabled',
  'planModeEnabled',
  // "Always save new documents in <place> and skip this step": the New Document wizard has no Location step to skip
  // (docs/specs/007-editor/new-document-route.md "One-step wizard").
  'skipLocationStep',
  // Power user mode, its Minimal chrome and its one-time offer (docs/specs/007-editor/power-user-mode.md): retired.
  // Whatever its preset wrote stays; only these go. The sync sends a null for each key the server held, on the next
  // write; nothing is written on load.
  'powerUserMode',
  'powerUserBaseline',
  'minimalChrome',
  'powerUserOfferShown',
]);

// Every page kind the Pages tour has a track for (apps/editor/lib/pages-tour.ts PAGES_TOUR_KINDS).
const PAGES_TOUR_KINDS: readonly PageKind[] = ['slide', 'infographic', 'article', 'flashcard'];

export function upgradeLegacyPreferences<T extends Record<string, unknown>>(prefs: T): T {
  const keys = Object.keys(prefs);
  if (!keys.some((key) => key in RENAMED || RETIRED.has(key))) return prefs;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(prefs)) {
    if (RETIRED.has(key)) continue;
    const current = RENAMED[key];
    if (current === undefined) out[key] = value;
    else if (!(current in prefs)) out[current] = value;
  }
  // The mode's preset marked the Pages tour seen with its single flag, which counted every kind only while the mode
  // was on (docs/specs/007-editor/pages-tour.md). Kept as seen: every kind joins the answered list.
  if (prefs.powerUserMode === true && out.pagesTourSeen === true) {
    const answered = Array.isArray(out.pagesTourKinds) ? (out.pagesTourKinds as unknown[]) : [];
    out.pagesTourKinds = [...new Set([...answered, ...PAGES_TOUR_KINDS])];
  }
  return out as T;
}
