// Preference keys renamed (docs/specs/007-editor/user-preferences.md): `notifyDiagramJoin` when the
// container became a project (stored rows migrated in D1). This upgrades a copy that
// can still arrive from elsewhere (a browser's localStorage cache, a row written by an old client
// during the deploy). An opt-out must never be lost on the way.
const RENAMED: Readonly<Record<string, string>> = {
  notifyDiagramJoin: 'notifyProjectJoin',
  // Facilitate mode became Workshop mode: a lost seen-guard would offer the tour again.
};

// Preference keys whose feature is gone (docs/specs/007-editor/user-preferences.md "Retired keys"):
// dropped on read, so the next write stores the blob without them.
const RETIRED: ReadonlySet<string> = new Set([
  // The Activity panel (docs/specs/012-collaboration/README.md "Removed: the Activity panel").
  'activityPanelEnabled',
  'activityRevertHoverPreview',
  // The Settings › Experimental switches for Pages and Plan modes: every mode is always
  // offered now (docs/specs/007-editor/editor-modes.md). Pages mode was Illustrate mode, and
  // Infographic mode before that.
  'illustrateModeEnabled',
  'infographicModeEnabled',
  'planModeEnabled',
  // Pages mode's tour, its logo guides and where its Contents sat: the mode is gone.
  'illustrateTourSeen',
  'illustrateTourKinds',
  'pagesTourSeen',
  'pagesTourKinds',
  'logoGuides',
  'logoGuidesHidden',
  'logoGuideStrength',
  'contentsPlacement',
  // "Always save new projects in <place> and skip this step": the New Project wizard has no Location step to skip
  // (docs/specs/007-editor/new-project-route.md "One-step wizard").
  'skipLocationStep',
  // The Workshop and Avatar tours' seen-guards (the Workshop tour was the Facilitate tour) and the presenter
  // settings, gone with Workshop mode's facilitation features (docs/specs/012-collaboration/session-tools.md).
  'facilitateTourSeen',
  'workshopTourSeen',
  'avatarTourSeen',
  'presentation',
]);

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
  return out as T;
}
