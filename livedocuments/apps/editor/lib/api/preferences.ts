// User preferences (docs/specs/007-editor/user-preferences.md).
//
// A person's settings follow them across devices and apps: the api keeps them in the liveworkspace
// accounts database, those every app shares in its `all` scope and livedocuments' own in its scope,
// and hands the editor one flat set. Guests have them too, under their guest id. Where the api keeps
// none (a deployment without liveworkspace accounts) they stay in this browser.
//
// The shape is opaque to the api-client by design: UserPreferences lives in
// apps/editor/lib/user-preferences.ts as the authoritative type, and is marshalled as a plain Record
// so adding a flag never needs an api-schema change.
import { API_BASE, apiHeaders, apiFetch } from './core';

// The server's preferences, `'local'` when it keeps none (they live in this browser), or null when
// they could not be read (offline, the api unreachable): the caller sticks with its cache.
export async function apiGetPreferences(
  ownerId: string,
): Promise<Record<string, unknown> | 'local' | null> {
  try {
    const res = await apiFetch(`${API_BASE}/preferences`, {
      headers: await apiHeaders(ownerId),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { prefs?: unknown };
    if (body.prefs === null) return 'local';
    if (!body.prefs || typeof body.prefs !== 'object' || Array.isArray(body.prefs)) return null;
    return body.prefs as Record<string, unknown>;
  } catch {
    return null;
  }
}

export type PreferencesSaveResult = 'saved' | 'failed' | 'local';

// Sends a patch: each key named takes its value whole, a key set to null is deleted, keys not named
// stay. 'saved' once the api confirmed it; 'local' when it keeps no preferences; 'failed' for a
// refusal or a network failure, after which lib/preferences-sync keeps this device's copy until a
// save lands. Never throws.
export async function apiPutPreferences(
  ownerId: string,
  patch: Record<string, unknown>,
): Promise<PreferencesSaveResult> {
  try {
    const res = await apiFetch(`${API_BASE}/preferences`, {
      method: 'PUT',
      headers: await apiHeaders(ownerId, { body: true }),
      body: JSON.stringify({ prefs: patch }),
    });
    if (res.ok) return 'saved';
    // No toast for a settings-sync failure (more annoying than useful): the toggle has already
    // taken effect locally, and the caller logs and retries on the next load.
    if (res.status === 404) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (body?.error === 'preferences_not_stored') return 'local';
    }
    console.warn(`[preferences] save-refused status=${res.status}`);
    return 'failed';
  } catch {
    return 'failed';
  }
}
