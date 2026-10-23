// User preferences (docs/specs/007-editor/user-preferences.md).
//
// A person's editor preferences, kept by liveworkspace with their account (or under a guest's id)
// so their choices follow them across devices, and the shared ones across apps. With nowhere to
// keep them (a guest-only self-host) the api says so, and they stay in this browser alone.
//
// The shape is opaque to the api-client by design: docs/specs/007-editor/user-preferences.md's
// UserPreferences lives in apps/editor/lib/user-preferences.ts as the
// authoritative type, and we marshal it as a plain Record so adding
// a flag never needs an api-schema change.
import { API_BASE, apiHeaders, apiFetch } from './core';

// This deployment keeps no preferences for this person: GET answered `{ prefs: null }`, or a PUT 409.
export const PREFERENCES_LOCAL_ONLY = 'local-only';

// The stored preferences, PREFERENCES_LOCAL_ONLY, or null when they could not be read (offline,
// the api out of reach): the caller keeps to its cache either way.
export async function apiGetPreferences(
  ownerId: string,
): Promise<Record<string, unknown> | typeof PREFERENCES_LOCAL_ONLY | null> {
  try {
    const res = await apiFetch(`${API_BASE}/preferences`, {
      headers: await apiHeaders(ownerId),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { prefs?: unknown };
    if (body.prefs === null) return PREFERENCES_LOCAL_ONLY;
    if (!body.prefs || typeof body.prefs !== 'object' || Array.isArray(body.prefs)) return null;
    return body.prefs as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Sends a patch: each key named takes its new value whole, null deletes it, and keys left out stay
// as the server has them. True once the api confirmed it (a 2xx), PREFERENCES_LOCAL_ONLY when the
// api keeps none for this person, false otherwise. Never throws: lib/preferences-sync keeps this
// device's copy until a save lands.
export async function apiPutPreferences(
  ownerId: string,
  patch: Record<string, unknown>,
): Promise<boolean | typeof PREFERENCES_LOCAL_ONLY> {
  try {
    const res = await apiFetch(`${API_BASE}/preferences`, {
      method: 'PUT',
      headers: await apiHeaders(ownerId, { body: true }),
      body: JSON.stringify({ prefs: patch }),
    });
    if (res.status === 409) return PREFERENCES_LOCAL_ONLY;
    // No toast for a settings-sync failure (more annoying than useful): the toggle has already
    // taken effect locally, and the caller logs and retries on the next load.
    if (!res.ok) console.warn(`[preferences] save-refused status=${res.status}`);
    return res.ok;
  } catch {
    return false;
  }
}
