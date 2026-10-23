// /api/preferences: the editor's preferences (docs/specs/007-editor/user-preferences.md), kept by the
// liveworkspace accounts Worker (accounts/settings.ts), never in livedesign's own database.
//
//   GET → { prefs }: the owner's preferences as one flat set, shared and livedesign's own joined. One
//         accounts read.
//   PUT { prefs } → 204: a patch. Each key named takes its value whole (an object replaces the stored one
//         rather than merging into it), null deletes it, and keys left out stay as they are. So two apps,
//         or two tabs, changing different keys both land.
//
// Hybrid identity like the rest of the api: the account when signed in, else the guest's X-Owner-Id. A
// deployment with no accounts Worker (a self-host with no sign-in) keeps no preferences: both answer
// 404 `preferences_not_stored`, and the editor keeps them in the browser.

import { badRequest, json, missingAuth, noContent, notFound } from '../responses';
import {
  isSettingKey,
  readPreferences,
  SettingsError,
  writePreferences,
} from '../accounts/settings';
import type { RouteContext } from './context';

// The most a PUT body may hold, in characters. The editor keeps the whole set under 4 KB
// (apps/live/lib/preferences-sync.ts); a patch is never bigger than the set plus a null for each key it
// deletes. The accounts Worker caps each scope at 16 KB besides.
export const PREFERENCES_PUT_MAX = 8192;

const NOT_STORED = { error: 'preferences_not_stored' } as const;

export async function handlePreferences(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, resolveOwner } = ctx;
  if (!(segments[1] === 'preferences' && segments.length === 2)) return notFound();
  const ownerId = resolveOwner();
  if (!ownerId) return missingAuth();
  if (request.method === 'GET') {
    let prefs: Record<string, unknown> | null;
    try {
      prefs = await readPreferences(env, ownerId);
    } catch (err) {
      console.warn('[preferences] read_failed', err instanceof Error ? err.message : 'unknown');
      return json({ error: 'preferences_unavailable' }, { status: 503 });
    }
    if (prefs === null) return json(NOT_STORED, { status: 404 });
    return json({ prefs });
  }
  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > PREFERENCES_PUT_MAX) {
      return badRequest('preferences payload too large (8 KB max)');
    }
    let body: { prefs?: unknown } | null;
    try {
      body = JSON.parse(text) as { prefs?: unknown } | null;
    } catch {
      return badRequest('invalid JSON');
    }
    const prefs = body?.prefs;
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
      return badRequest('prefs must be an object');
    }
    const patch = prefs as Record<string, unknown>;
    if (!Object.keys(patch).every(isSettingKey)) return badRequest('invalid preference name');
    try {
      if (!(await writePreferences(env, ownerId, patch))) return json(NOT_STORED, { status: 404 });
    } catch (err) {
      if (err instanceof SettingsError) {
        console.warn('[preferences] write_refused', { status: err.status, code: err.code });
        return json({ error: err.code }, { status: err.status });
      }
      console.warn('[preferences] write_failed', err instanceof Error ? err.message : 'unknown');
      return json({ error: 'preferences_unavailable' }, { status: 503 });
    }
    return noContent();
  }
  return notFound();
}
