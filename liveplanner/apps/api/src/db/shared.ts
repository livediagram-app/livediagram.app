// shared_with — "shared with you" tracking.

import type { SharedWithItem } from '@liveplanner/api-schema';
import type { Env, ShareRole } from '../types';
import { firstTabCountSql, isEmptyCount } from './content-summary';
import { legacyRoleColumn, levelColumn, storedLevelOf } from '../share-link-row';
import { visitLinkSql } from './visit-link';

// Record a visitor's access to a shared project. Idempotent on
// (owner_id, project_id): repeat visits just bump last_seen + role.
// Caller is expected to only invoke this when the visitor's resolved
// owner differs from the project's owner (an owner opening their own
// project via a share link shouldn't show up in their own
// "Shared with you" list).
//
// Returns whether this was a FIRST visit (no prior row). The share route
// uses it to fire the "someone joined your project" notification (docs/specs/014-identity/profile-and-email-notifications.md)
// and the Project·Joined telemetry count (docs/specs/017-telemetry/telemetry.md) once per (visitor,
// project) rather than per reload. Decided by an INSERT OR IGNORE's row
// count, so two concurrent first opens can't both read as first; a repeat
// visit then refreshes role + last_seen.
export async function recordSharedAccess(
  env: Env,
  ownerId: string,
  projectId: string,
  role: ShareRole,
  // The link's tab scope (docs/specs/013-workspace/tab-scoped-share-links.md); null = All tabs. Last visit
  // wins, like role.
  tabId: string | null,
  // The link the visit came in through (docs/specs/013-workspace/share-roles.md "Share links"): the visit
  // reaches the project through it only while it is live. Last visit wins.
  shareCode: string,
): Promise<boolean> {
  const now = Date.now();
  const inserted = await env.DB.prepare(
    'INSERT OR IGNORE INTO shared_with (owner_id, project_id, role, level, last_seen, tab_id, share_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(ownerId, projectId, legacyRoleColumn(role), levelColumn(role), now, tabId, shareCode)
    .run();
  if (inserted.meta.changes === 1) return true;
  await env.DB.prepare(
    'UPDATE shared_with SET role = ?, level = ?, tab_id = ?, last_seen = ?, share_code = ? WHERE owner_id = ? AND project_id = ?',
  )
    .bind(legacyRoleColumn(role), levelColumn(role), tabId, now, shareCode, ownerId, projectId)
    .run();
  return false;
}

// Whether this owner has ever opened the project through a share link
// (a shared_with row exists). Used by the notify-action route (docs/specs/012-collaboration/assigned-actions.md)
// as the "shared-with" leg of its caller-can-access-the-project check.
// Only a visit whose link is still live counts (visitLinkSql): a revoked, expired or rescoped link, or a
// project no longer shared, is no access.
export async function hasSharedAccess(
  env: Env,
  ownerId: string,
  projectId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS one
       FROM shared_with s
       JOIN projects d ON d.id = s.project_id
      WHERE s.owner_id = ?1 AND s.project_id = ?2 AND d.shareable = 1 AND d.trashed_at IS NULL
        AND ${visitLinkSql('?3')} IS NOT NULL
      LIMIT 1`,
  )
    .bind(ownerId, projectId, Date.now())
    .first<{ one: number }>();
  return row !== null;
}

// The visits a link granted end with it (docs/specs/013-workspace/share-roles.md "Share links"): called as
// links are deleted, so every leg that reads shared_with (activity) forgets them too.
export async function dropVisitsThroughLinks(
  env: Env,
  projectId: string,
  codes: readonly string[],
): Promise<void> {
  if (codes.length === 0) return;
  await env.DB.prepare(
    `DELETE FROM shared_with WHERE project_id = ? AND share_code IN (SELECT value FROM json_each(?))`,
  )
    .bind(projectId, JSON.stringify(codes))
    .run();
}

// List projects shared with this owner, newest interaction first.
// Joins through `diagrams` for the name + owner-side savedAt; also
// surfaces a still-live `shareCode` for each row so the client can
// build a `/live/project/<id>?s=<code>` URL the visitor can actually
// open. Without the code the Shared list link would land on the
// owner-only `/api/projects/:id` path and 404 every time.
//
// The shareCode is the visit's live link (visitLinkSql): the link it came
// in through while that is live and still matches its role and scope, so a
// revoked link ends the visits it granted even while another link of the
// same role lives. Rows with no live link (or shareable flipped off) are
// filtered out so the visitor doesn't see a list item they can't act on.
//
// The scope matches the visitor's recorded tab scope
// (docs/specs/013-workspace/tab-scoped-share-links.md), so a visitor shown one tab is never handed an
// All-tabs code, and vice versa.
export async function listSharedWith(env: Env, ownerId: string): Promise<SharedWithItem[]> {
  const res = await env.DB.prepare(
    `SELECT d.id, d.name, d.saved_at, s.role, s.level, s.tab_id,
            ${visitLinkSql('?1')} AS share_code,
            ${firstTabCountSql('d.id', 's.tab_id')},
            p.name  AS owner_name,
            p.color AS owner_color
       FROM shared_with s
       JOIN projects d ON d.id = s.project_id
       LEFT JOIN participants p ON p.id = d.owner_id
      WHERE s.owner_id = ?2
        AND d.shareable = 1
        AND d.trashed_at IS NULL
      ORDER BY s.last_seen DESC`,
  )
    .bind(Date.now(), ownerId)
    .all<{
      id: string;
      name: string;
      saved_at: number;
      role: string;
      level: string | null;
      tab_id: string | null;
      share_code: string | null;
      owner_name: string | null;
      owner_color: string | null;
      first_tab_count: number | null;
    }>();
  return (res.results ?? [])
    .filter((r) => r.share_code !== null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      savedAt: r.saved_at,
      role: storedLevelOf(r),
      shareCode: r.share_code as string,
      tabId: r.tab_id ?? null,
      ownerName: r.owner_name,
      ownerColor: r.owner_color,
      empty: isEmptyCount(r.first_tab_count),
    }));
}

// Drop a single "shared with you" reference — used when the visitor
// dismisses a row from their Shared list (they don't want it
// showing up any more) or when the project's been duplicated into
// the visitor's own files (#9) so the shared reference is no longer
// useful.
export async function dropSharedAccess(
  env: Env,
  ownerId: string,
  projectId: string,
): Promise<void> {
  await env.DB.prepare('DELETE FROM shared_with WHERE owner_id = ? AND project_id = ?')
    .bind(ownerId, projectId)
    .run();
}
