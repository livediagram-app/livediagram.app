// User preferences (docs/specs/007-editor/user-preferences.md).
//
// Kept with the person's liveworkspace account, so a signed-in user's choices follow them across
// devices, and the ones every app shares (ALL_SETTING_KEYS in @liveworkspace/settings) across apps
// too. A guest's are kept under their guest id, so a localStorage clear still recovers them as long
// as the same browser id is in play. A deployment without liveworkspace accounts keeps none: the
// api answers `preferences_not_stored`, and they stay in this browser.
//
// The shape is opaque to the api-client by design: UserPreferences lives in
// apps/live/lib/user-preferences.ts as the authoritative type, and we marshal it as a plain Record
// so adding a flag never needs an api-schema change.
import { API_BASE, apiHeaders, apiFetch } from './core';

// A change to the stored preferences: each key takes its value whole, null deletes it, and keys
// left out stay as they are.
export type PreferencesPatch = Record<string, unknown>;

const NOT_STORED = 'preferences_not_stored';

async function errorOf(res: Response): Promise<string | null> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === 'string' ? body.error : null;
}

// The stored preferences; 'not_stored' when this deployment keeps none; null when they could not
// be read (offline, the api or the accounts Worker unreachable), and the caller keeps the cache.
export async function apiGetPreferences(
  ownerId: string,
): Promise<Record<string, unknown> | 'not_stored' | null> {
  try {
    const res = await apiFetch(`${API_BASE}/preferences`, {
      headers: await apiHeaders(ownerId),
    });
    if (res.status === 404 && (await errorOf(res)) === NOT_STORED) return 'not_stored';
    if (!res.ok) return null;
    const body = (await res.json()) as { prefs?: unknown };
    if (!body.prefs || typeof body.prefs !== 'object' || Array.isArray(body.prefs)) return null;
    return body.prefs as Record<string, unknown>;
  } catch {
    return null;
  }
}

// 'saved' once the api confirmed the change; 'not_stored' when this deployment keeps none;
// 'refused' for a refusal or a network failure, after which lib/preferences-sync keeps this
// device's copy until a save lands. Never throws.
export async function apiPutPreferences(
  ownerId: string,
  patch: PreferencesPatch,
): Promise<'saved' | 'refused' | 'not_stored'> {
  try {
    const res = await apiFetch(`${API_BASE}/preferences`, {
      method: 'PUT',
      headers: await apiHeaders(ownerId, { body: true }),
      body: JSON.stringify({ prefs: patch }),
    });
    if (res.ok) return 'saved';
    if (res.status === 404 && (await errorOf(res)) === NOT_STORED) return 'not_stored';
    // No toast for a settings-sync failure (more annoying than useful): the toggle has already
    // taken effect locally, and the caller logs and retries on the next load.
    console.warn(`[preferences] save-refused status=${res.status}`);
    return 'refused';
  } catch {
    return 'refused';
  }
}
