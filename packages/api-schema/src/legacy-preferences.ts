// Preference keys renamed when the container became a document
// (docs/specs/007-editor/user-preferences.md). Stored rows are migrated in D1; this upgrades
// a copy that can still arrive from elsewhere (a browser's localStorage cache, a row written
// by an old client during the deploy). An opt-out must never be lost on the way.
const RENAMED: Readonly<Record<string, string>> = { notifyDiagramJoin: 'notifyDocumentJoin' };

export function upgradeLegacyPreferences<T extends Record<string, unknown>>(prefs: T): T {
  if (!Object.keys(RENAMED).some((legacy) => legacy in prefs)) return prefs;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(prefs)) {
    const current = RENAMED[key];
    if (current === undefined) out[key] = value;
    else if (!(current in prefs)) out[current] = value;
  }
  return out as T;
}
