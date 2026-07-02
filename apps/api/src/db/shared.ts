// shared_with — "shared with you" tracking (migration 0010).

import type { SharedWithItem } from '@livediagram/api-schema';
import type { Env, ShareRole } from '../types';

// Record a visitor's access to a shared diagram. Idempotent on
// (owner_id, diagram_id): repeat visits just bump last_seen + role.
// Caller is expected to only invoke this when the visitor's resolved
// owner differs from the diagram's owner (an owner opening their own
// diagram via a share link shouldn't show up in their own
// "Shared with you" list).
//
// Returns whether this was a FIRST visit (no prior row), which the share
// route uses to fire the "someone joined your diagram" notification
// (spec/65) once per person rather than per reload. The existence check +
// upsert aren't atomic, but a rare double / missed notification on a true
// race is harmless for a best-effort email.
export async function recordSharedAccess(
  env: Env,
  ownerId: string,
  diagramId: string,
  role: ShareRole,
): Promise<boolean> {
  const existing = await env.DB.prepare(
    'SELECT 1 AS one FROM shared_with WHERE owner_id = ? AND diagram_id = ? LIMIT 1',
  )
    .bind(ownerId, diagramId)
    .first<{ one: number }>();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO shared_with (owner_id, diagram_id, role, last_seen) VALUES (?, ?, ?, ?)
       ON CONFLICT (owner_id, diagram_id) DO UPDATE SET role = excluded.role, last_seen = excluded.last_seen`,
  )
    .bind(ownerId, diagramId, role, now)
    .run();
  return existing === null;
}

// List diagrams shared with this owner, newest interaction first.
// Joins through `diagrams` for the name + owner-side savedAt; also
// surfaces a still-live `shareCode` for each row so the client can
// build a `/live/diagram/<id>?s=<code>` URL the visitor can actually
// open. Without the code the Shared list link would land on the
// owner-only `/api/diagrams/:id` path and 404 every time.
//
// The shareCode is sourced via a correlated subquery against
// share_links matching the same role the visitor was granted —
// preferring the oldest still-alive code (matches the "primary
// code" convention used everywhere else). Expired links are
// excluded with the same predicate getShareLink enforces, so the
// list never hands back a code that would 404 on click while a
// newer live link exists. Rows whose share has been entirely
// revoked since the visit (no live code left at the matching role,
// or shareable flipped off) are filtered out so the visitor
// doesn't see a list item they can't act on.
export async function listSharedWith(env: Env, ownerId: string): Promise<SharedWithItem[]> {
  const res = await env.DB.prepare(
    `SELECT d.id, d.name, d.saved_at, s.role,
            (SELECT code
               FROM share_links
              WHERE share_links.diagram_id = d.id
                AND share_links.role = s.role
                AND (share_links.expires_at IS NULL OR share_links.expires_at > ?)
              ORDER BY share_links.created_at ASC
              LIMIT 1) AS share_code,
            p.name  AS owner_name,
            p.color AS owner_color
       FROM shared_with s
       JOIN diagrams d ON d.id = s.diagram_id
       LEFT JOIN participants p ON p.id = d.owner_id
      WHERE s.owner_id = ?
        AND d.shareable = 1
      ORDER BY s.last_seen DESC`,
  )
    .bind(Date.now(), ownerId)
    .all<{
      id: string;
      name: string;
      saved_at: number;
      role: ShareRole;
      share_code: string | null;
      owner_name: string | null;
      owner_color: string | null;
    }>();
  return (res.results ?? [])
    .filter((r) => r.share_code !== null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      savedAt: r.saved_at,
      role: r.role,
      shareCode: r.share_code as string,
      ownerName: r.owner_name,
      ownerColor: r.owner_color,
    }));
}

// Drop a single "shared with you" reference — used when the visitor
// dismisses a row from their Shared list (they don't want it
// showing up any more) or when the diagram's been duplicated into
// the visitor's own files (#9) so the shared reference is no longer
// useful.
export async function dropSharedAccess(
  env: Env,
  ownerId: string,
  diagramId: string,
): Promise<void> {
  await env.DB.prepare('DELETE FROM shared_with WHERE owner_id = ? AND diagram_id = ?')
    .bind(ownerId, diagramId)
    .run();
}
