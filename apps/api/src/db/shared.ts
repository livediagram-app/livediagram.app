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
// Returns whether this was a FIRST visit (no prior row). The share route
// uses it to fire the "someone joined your diagram" notification (docs/specs/014-identity/profile-and-email-notifications.md)
// and the Diagram·Joined telemetry count (docs/specs/017-telemetry/telemetry.md) once per (visitor,
// diagram) rather than per reload. Decided by an INSERT OR IGNORE's row
// count, so two concurrent first opens can't both read as first; a repeat
// visit then refreshes role + last_seen.
export async function recordSharedAccess(
  env: Env,
  ownerId: string,
  documentId: string,
  role: ShareRole,
  // The link's tab scope (docs/specs/013-workspace/tab-scoped-share-links.md); null = All tabs. Last visit
  // wins, like role.
  tabId: string | null,
): Promise<boolean> {
  const now = Date.now();
  const inserted = await env.DB.prepare(
    'INSERT OR IGNORE INTO shared_with (owner_id, document_id, role, last_seen, tab_id) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(ownerId, documentId, role, now, tabId)
    .run();
  if (inserted.meta.changes === 1) return true;
  await env.DB.prepare(
    'UPDATE shared_with SET role = ?, tab_id = ?, last_seen = ? WHERE owner_id = ? AND document_id = ?',
  )
    .bind(role, tabId, now, ownerId, documentId)
    .run();
  return false;
}

// Whether this owner has ever opened the diagram through a share link
// (a shared_with row exists). Used by the notify-action route (docs/specs/012-collaboration/assigned-actions.md)
// as the "shared-with" leg of its caller-can-access-the-diagram check.
export async function hasSharedAccess(
  env: Env,
  ownerId: string,
  documentId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT 1 AS one FROM shared_with WHERE owner_id = ? AND document_id = ? LIMIT 1',
  )
    .bind(ownerId, documentId)
    .first<{ one: number }>();
  return row !== null;
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
//
// The code also matches the visitor's recorded tab scope
// (docs/specs/013-workspace/tab-scoped-share-links.md), so a visitor shown one tab is never handed an
// All-tabs code, and vice versa.
export async function listSharedWith(env: Env, ownerId: string): Promise<SharedWithItem[]> {
  const res = await env.DB.prepare(
    `SELECT d.id, d.name, d.saved_at, s.role, s.tab_id,
            (SELECT code
               FROM share_links
              WHERE share_links.document_id = d.id
                AND share_links.role = s.role
                AND share_links.tab_id IS s.tab_id
                AND (share_links.expires_at IS NULL OR share_links.expires_at > ?)
              ORDER BY share_links.created_at ASC
              LIMIT 1) AS share_code,
            p.name  AS owner_name,
            p.color AS owner_color
       FROM shared_with s
       JOIN documents d ON d.id = s.document_id
       LEFT JOIN participants p ON p.id = d.owner_id
      WHERE s.owner_id = ?
        AND d.shareable = 1
        AND d.trashed_at IS NULL
      ORDER BY s.last_seen DESC`,
  )
    .bind(Date.now(), ownerId)
    .all<{
      id: string;
      name: string;
      saved_at: number;
      role: ShareRole;
      tab_id: string | null;
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
      tabId: r.tab_id ?? null,
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
  documentId: string,
): Promise<void> {
  await env.DB.prepare('DELETE FROM shared_with WHERE owner_id = ? AND document_id = ?')
    .bind(ownerId, documentId)
    .run();
}
