// /api/preferences — per-user editor preference flags (spec/20).

import { badRequest, json, missingAuth, noContent, notFound } from '../responses';
import type { RouteContext } from './context';

// Per-user editor preference flags (spec/20). Stored as a single
// JSON blob per owner so adding a flag never needs a migration.
// Hybrid identity: Clerk userId when signed in, X-Owner-Id
// otherwise, matching the rest of the api. The blob is opaque
// to the worker beyond a small size cap, so a malformed client
// reflects malformed prefs back to itself; no per-field
// validation here.
export async function handlePreferences(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, resolveOwner } = ctx;
  if (!(segments[1] === 'preferences' && segments.length === 2)) return notFound();
  const ownerId = resolveOwner();
  if (!ownerId) return missingAuth();
  if (request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT prefs FROM user_preferences WHERE owner_id = ?1 LIMIT 1',
    )
      .bind(ownerId)
      .first<{ prefs: string }>();
    let prefs: Record<string, unknown> = {};
    if (row?.prefs) {
      try {
        const parsed: unknown = JSON.parse(row.prefs);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          prefs = parsed as Record<string, unknown>;
        }
      } catch {
        // Corrupt row: treat as empty, the client will overwrite
        // on its next toggle.
      }
    }
    return json({ prefs });
  }
  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > 4096) {
      return badRequest('preferences payload too large (4 KB max)');
    }
    let body: { prefs?: unknown } | null = null;
    try {
      body = JSON.parse(text) as { prefs?: unknown };
    } catch {
      return badRequest('invalid JSON');
    }
    if (!body || typeof body.prefs !== 'object' || body.prefs === null) {
      return badRequest('prefs must be an object');
    }
    const serialised = JSON.stringify(body.prefs);
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO user_preferences (owner_id, prefs, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT (owner_id) DO UPDATE SET prefs = excluded.prefs, updated_at = excluded.updated_at',
    )
      .bind(ownerId, serialised, now)
      .run();
    return noContent();
  }
  return notFound();
}
