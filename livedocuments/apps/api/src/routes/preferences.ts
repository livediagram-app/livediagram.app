// /api/preferences — a person's settings (docs/specs/007-editor/user-preferences.md), kept by the
// liveworkspace accounts Worker (person/settings.ts). Hybrid identity: the account id when signed in,
// the guest's id otherwise (each from its Bearer token), matching the rest of the api.
//
//   GET → { prefs }: `all` and this app's scope as one flat set. `prefs: null` says they aren't kept
//         here (no accounts Worker on this deployment, or an owner id it has no place for): the
//         editor keeps them in the browser.
//   PUT { prefs } → 204: a patch. Each key named takes its value whole, a key set to null is
//         deleted, keys not named stay. 404 `preferences_not_stored` where GET answers null.
//
// The values are opaque beyond the size limit: a malformed client reflects malformed prefs back to
// itself.

import { SettingsError } from '@liveworkspace/auth-client';
import { readPreferences, writePreferences } from '../person/settings';
import { accountsOwnerOf } from '../person/owner';
import { accountCredentials } from '../auth/accounts';
import { badRequest, json, missingAuth, noContent, notFound } from '../responses';
import type { RouteContext } from './context';

// The accounts Worker's own limit on one scope (16 KB of JSON); a patch is never more than both.
export const PREFERENCES_PATCH_MAX = 16 * 1024;

export async function handlePreferences(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, resolveOwner } = ctx;
  if (!(segments[1] === 'preferences' && segments.length === 2)) return notFound();
  if (request.method !== 'GET' && request.method !== 'PUT') return notFound();
  const ownerId = resolveOwner();
  if (!ownerId) return missingAuth();
  const stored = accountCredentials(env) !== null && accountsOwnerOf(ownerId) !== null;
  if (request.method === 'GET') {
    if (!stored) return json({ prefs: null });
    try {
      return json({ prefs: await readPreferences(env, ownerId) });
    } catch (error) {
      console.warn('[preferences] read_failed', { error: String(error) });
      return json({ error: 'preferences_unavailable' }, { status: 503 });
    }
  }
  if (request.method === 'PUT') {
    if (!stored) return json({ error: 'preferences_not_stored' }, { status: 404 });
    const text = await request.text();
    if (text.length > PREFERENCES_PATCH_MAX) {
      return badRequest('preferences payload too large (16 KB max)');
    }
    // The `| null` stays because JSON.parse yields null for the body "null", refused below.
    let body: { prefs?: unknown } | null;
    try {
      body = JSON.parse(text) as { prefs?: unknown } | null;
    } catch {
      return badRequest('invalid JSON');
    }
    if (
      !body ||
      typeof body.prefs !== 'object' ||
      body.prefs === null ||
      Array.isArray(body.prefs)
    ) {
      return badRequest('prefs must be an object');
    }
    try {
      await writePreferences(env, ownerId, body.prefs as Record<string, unknown>);
    } catch (error) {
      if (error instanceof SettingsError) {
        return json({ error: error.code }, { status: error.status === 413 ? 413 : 400 });
      }
      console.warn('[preferences] write_failed', { error: String(error) });
      return json({ error: 'preferences_unavailable' }, { status: 503 });
    }
    return noContent();
  }
  return notFound();
}
