// Preference keys renamed (docs/specs/007-editor/user-preferences.md): `notifyDiagramJoin` when the
// container became a document (stored rows migrated in D1). This upgrades a copy that
// can still arrive from elsewhere (a browser's localStorage cache, a row written by an old client
// during the deploy). An opt-out must never be lost on the way.
const RENAMED: Readonly<Record<string, string>> = {
  notifyDiagramJoin: 'notifyDocumentJoin',
};

// Preference keys whose feature is gone (docs/specs/007-editor/user-preferences.md "Retired keys"):
// dropped on read, so the next write stores the blob without them.
const RETIRED: ReadonlySet<string> = new Set([
  // The Activity panel (docs/specs/012-collaboration/README.md "Removed: the Activity panel").
  'activityPanelEnabled',
  'activityRevertHoverPreview',
  // Illustrate mode's Settings › Experimental switch: the mode is always offered now
  // (docs/specs/007-editor/editor-modes.md). `infographicModeEnabled` is its older name.
  'illustrateModeEnabled',
  'infographicModeEnabled',
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
