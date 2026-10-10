// User preferences (docs/specs/007-editor/user-preferences.md).
//
// Per-user editor preference flags persisted server-side so a signed-
// in user's choices follow them across devices. Guests get a copy
// keyed by their X-Owner-Id, so a localStorage clear still recovers
// the flags as long as the same browser participant id is in play.
//
// The shape is opaque to the api-client by design: docs/specs/007-editor/user-preferences.md's
// UserPreferences lives in apps/live/lib/user-preferences.ts as the
// authoritative type, and we marshal it as a plain Record so adding
// a flag never needs an api-schema change.
import { API_BASE, apiHeaders, apiFetch } from './core';

export async function apiGetPreferences(ownerId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await apiFetch(`${API_BASE}/preferences`, {
      headers: await apiHeaders(ownerId),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { prefs?: unknown };
    if (!body.prefs || typeof body.prefs !== 'object' || Array.isArray(body.prefs)) return null;
    return body.prefs as Record<string, unknown>;
  } catch {
    // Network failure (offline, api worker unreachable in a pure-
    // guest self-host without /api configured) returns null. The
    // caller falls back to the localStorage cache, matching the
    // pre-D1 behaviour exactly.
    return null;
  }
}

// True once the api confirmed the save (a 2xx). Never throws: a refusal or a network failure
// answers false, and lib/preferences-sync keeps this device's copy until a save lands.
export async function apiPutPreferences(
  ownerId: string,
  prefs: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/preferences`, {
      method: 'PUT',
      headers: await apiHeaders(ownerId, { body: true }),
      body: JSON.stringify({ prefs }),
    });
    // No toast for a settings-sync failure (more annoying than useful): the toggle has already
    // taken effect locally, and the caller logs and retries on the next load.
    if (!res.ok) console.warn(`[preferences] save-refused status=${res.status}`);
    return res.ok;
  } catch {
    return false;
  }
}
