// /api/preferences — a person's editor preferences (docs/specs/007-editor/user-preferences.md), kept
// by liveworkspace with the account, or under the guest's id (liveworkspace/settings.ts).
//
// GET answers them as one flat set: `{ prefs }`, read once per editor load. With nowhere to keep them
// (a guest-only deployment, or an id liveworkspace can't hold) it answers `{ prefs: null }`, and the
// editor keeps them in the browser alone.
//
// PUT `{ prefs }` is a patch: each key it names takes its new value whole (an object replaces the
// stored one), null deletes the key, and keys it leaves out stay as they are. So two apps, or two
// tabs, changing different settings never undo each other. The values are opaque here beyond the
// size cap: a malformed client reflects malformed prefs back to itself.

import { SettingsError } from '@liveworkspace/auth-client';
import { readPreferences, writePreferences } from '../liveworkspace/settings';
import { badRequest, json, missingAuth, noContent, notFound } from '../responses';
import type { RouteContext } from './context';

// The most a PUT body may carry, in characters. The editor keeps its whole blob under 4 KB
// (apps/editor/lib/preferences-sync.ts PREFERENCES_BODY_MAX); a patch is never more than that blob
// plus a null for each key it drops, so twice that is room to spare. liveworkspace holds each scope
// to 16 KB on its own side.
export const PREFERENCES_PATCH_MAX = 8192;

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
      // liveworkspace out of reach: the editor keeps its cached copy and asks again next load.
      console.warn('[preferences] read_failed', String(err));
      return json({ error: 'preferences_unavailable' }, { status: 503 });
    }
    if (!prefs) console.info('[preferences] local_only');
    return json({ prefs });
  }
  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > PREFERENCES_PATCH_MAX) {
      return badRequest('preferences payload too large (8 KB max)');
    }
    // No initialiser: the catch returns, so control only reaches past the block when the
    // assignment succeeded. JSON.parse legitimately yields null for the body "null", which the
    // check below rejects.
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
      const kept = await writePreferences(env, ownerId, body.prefs as Record<string, unknown>);
      // Nowhere to keep them: say so, so the editor stops sending.
      if (!kept) return json({ error: 'preferences_local_only' }, { status: 409 });
    } catch (err) {
      if (err instanceof SettingsError) {
        console.warn('[preferences] refused', { status: err.status, code: err.code });
        return json({ error: err.code }, { status: err.status === 413 ? 413 : 400 });
      }
      throw err;
    }
    return noContent();
  }
  return notFound();
}
