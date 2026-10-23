// collab_actions + collab_threads — the collaboration index (docs/specs/013-workspace/inbox.md
// §2): a SQL-filterable projection of the actions and comment threads
// that live inside element JSON in each document's tabs. Plus `owner_aliases` (the
// identities an owner used to be, §2.2).
//
// The rows are written by each document's Durable Object, through its collab seam
// (document-room/document-outbox.ts `onTabCollabChanged`), keyed by document and tab and carrying the tab's
// name, so the read below needs nothing of a document's content. The read is the Inbox's one query per kind.

import type { ActivityAction, ActivityReadResult, ActivityThread } from '@livedocuments/api-schema';
import { VISIBLE_DOCUMENTS_CTES } from './document-visibility';
import type { Env } from '../types';

// ---------- Read ------------------------------------------------------

// The scoping every Activity read shares (docs/specs/013-workspace/inbox.md §4). `me` is the
// reader plus every identity they used to be; `visible` is the three
// sets the Explorer's Recent merges — own, joined-team, shared-with-you
// (live share only) — with how each is reached and, for a share, the
// code the client needs to open it. Scoping by library FIRST is the
// security boundary: an id inside a blob can never surface a document
// the reader can no longer open. A share also carries the tab it is
// scoped to (docs/specs/013-workspace/tab-scoped-share-links.md): the code picked has exactly that scope,
// and the reads keep only that tab's rows.
//
// Binds: ?1 = ownerId, ?2 = now (share-link expiry), ?3 = limit. `visible` (and `my_teams`)
// come from the one shared definition (db/document-visibility.ts), which Explorer Home reads too.
const SCOPE_CTES = `
  WITH me(id) AS (
    SELECT ?1
    UNION
    SELECT alias_id FROM owner_aliases WHERE owner_id = ?1
  ),
  my_members(id) AS (
    SELECT id FROM team_members WHERE user_id = ?1
  ),
  ${VISIBLE_DOCUMENTS_CTES}`;

type PlaceRow = {
  tab_id: string;
  element_id: string;
  element_label: string;
  document_id: string;
  document_name: string;
  document_team_id: string | null;
  via: 'own' | 'team' | 'shared';
  share_code: string | null;
  tab_name: string;
};

type ActionRow = PlaceRow & {
  action_id: string;
  name: string;
  description: string;
  assignee_user_id: string | null;
  assignee_name: string | null;
  assigner_id: string;
  assigner_name: string | null;
  created_at: number;
  updated_at: number;
  assigned_to_me: number;
  created_by_me: number;
};

type ThreadRow = PlaceRow & {
  comment_count: number;
  latest_text: string;
  latest_author_name: string;
  latest_author_color: string;
  first_at: number;
  latest_at: number;
  you_commented: number;
  on_your_document: number;
  mentions_you: number;
};

const ACTIONS_SQL = `${SCOPE_CTES}
  SELECT ca.tab_id, ca.element_id, ca.element_label, ca.action_id, ca.name, ca.description,
         ca.assignee_user_id, ca.assignee_name, ca.assigner_id, ca.assigner_name,
         ca.created_at, ca.updated_at,
         v.id AS document_id, v.name AS document_name, v.team_id AS document_team_id,
         v.via, v.share_code, ca.tab_name,
         CASE WHEN ca.assignee_user_id IN (SELECT id FROM me)
                OR ca.assignee_member_id IN (SELECT id FROM my_members) THEN 1 ELSE 0 END AS assigned_to_me,
         CASE WHEN ca.assigner_id IN (SELECT id FROM me) THEN 1 ELSE 0 END AS created_by_me
    FROM collab_actions ca
    JOIN visible v ON v.id = ca.document_id
   WHERE ca.status = 'open'
     AND (v.scope_tab_id IS NULL OR v.scope_tab_id = ca.tab_id)
     AND (ca.assignee_user_id IN (SELECT id FROM me)
          OR ca.assigner_id IN (SELECT id FROM me)
          OR ca.assignee_member_id IN (SELECT id FROM my_members))
   ORDER BY ca.updated_at DESC
   LIMIT ?3`;

// Exported for the query-plan guard in home-plans.test.ts.
export const THREADS_SQL = `${SCOPE_CTES}
  SELECT ct.tab_id, ct.element_id, ct.element_label, ct.comment_count,
         ct.latest_text, ct.latest_author_name, ct.latest_author_color, ct.first_at, ct.latest_at,
         v.id AS document_id, v.name AS document_name, v.team_id AS document_team_id,
         v.via, v.share_code, ct.tab_name,
         CASE WHEN EXISTS (SELECT 1 FROM json_each(ct.participant_ids) je
                            WHERE je.value IN (SELECT id FROM me)) THEN 1 ELSE 0 END AS you_commented,
         CASE WHEN v.owner_id = ?1 THEN 1 ELSE 0 END AS on_your_document,
         CASE WHEN EXISTS (SELECT 1 FROM json_each(ct.mentioned_ids) jm
                            WHERE jm.value IN (SELECT id FROM me)
                               OR jm.value IN (SELECT id FROM my_members)) THEN 1 ELSE 0 END
           AS mentions_you
    -- From the reader's documents to their tabs' threads, in that order (CROSS JOIN fixes it): led by
    -- the open-threads index instead, the read walked every open thread in the database.
    FROM visible v
    CROSS JOIN collab_threads ct ON ct.document_id = v.id
   WHERE ct.resolved = 0
     AND (v.scope_tab_id IS NULL OR v.scope_tab_id = ct.tab_id)
     AND (v.owner_id = ?1
          OR EXISTS (SELECT 1 FROM json_each(ct.participant_ids) je
                      WHERE je.value IN (SELECT id FROM me))
          OR EXISTS (SELECT 1 FROM json_each(ct.mentioned_ids) jm
                      WHERE jm.value IN (SELECT id FROM me)
                         OR jm.value IN (SELECT id FROM my_members)))
   ORDER BY ct.latest_at DESC
   LIMIT ?3`;

// A document the reader reaches two ways (own and shared, say) lists once per way; keep the one the reader
// reaches most directly. A 'shared' row whose link has lapsed has nowhere to go and is dropped, the way
// Shared with You drops it.
const VIA_RANK = { own: 0, team: 1, shared: 2 } as const;
function dedupePlaces<R extends PlaceRow>(rows: R[]): R[] {
  const best = new Map<string, R>();
  for (const row of rows) {
    if (row.via === 'shared' && !row.share_code) continue;
    // An action row's own id is part of what makes it one row (docs/specs/012-collaboration/assigned-actions.md).
    const actionId = (row as { action_id?: string }).action_id;
    const key = `${row.tab_id}:${row.element_id}${actionId ? `:${actionId}` : ''}`;
    const cur = best.get(key);
    if (!cur || VIA_RANK[row.via] < VIA_RANK[cur.via]) best.set(key, row);
  }
  return [...best.values()];
}

function placeOf(row: PlaceRow) {
  return {
    documentId: row.document_id,
    documentName: row.document_name,
    teamId: row.document_team_id,
    via: row.via,
    shareCode: row.via === 'shared' ? row.share_code : null,
    tabId: row.tab_id,
    tabName: row.tab_name,
    elementId: row.element_id,
    elementLabel: row.element_label,
  };
}

export async function readActivity(
  env: Env,
  ownerId: string,
  opts: { limit: number },
): Promise<ActivityReadResult> {
  const now = Date.now();
  const [actionsRes, threadsRes] = await env.DB.batch([
    env.DB.prepare(ACTIONS_SQL).bind(ownerId, now, opts.limit),
    env.DB.prepare(THREADS_SQL).bind(ownerId, now, opts.limit),
  ]);
  const actions: ActivityAction[] = dedupePlaces((actionsRes?.results ?? []) as ActionRow[]).map(
    (r) => ({
      ...placeOf(r),
      id: r.action_id,
      name: r.name,
      description: r.description,
      assignee: { userId: r.assignee_user_id, name: r.assignee_name },
      assigner: { id: r.assigner_id, name: r.assigner_name },
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      assignedToMe: r.assigned_to_me === 1,
      createdByMe: r.created_by_me === 1,
    }),
  );
  const threads: ActivityThread[] = dedupePlaces((threadsRes?.results ?? []) as ThreadRow[]).map(
    (r) => ({
      ...placeOf(r),
      commentCount: r.comment_count,
      latest: {
        text: r.latest_text,
        authorName: r.latest_author_name,
        authorColor: r.latest_author_color,
        at: r.latest_at,
      },
      firstAt: r.first_at,
      youCommented: r.you_commented === 1,
      onYourDocument: r.on_your_document === 1,
      mentionsYou: r.mentions_you === 1,
    }),
  );
  return { actions, threads };
}

// ---------- Aliases ---------------------------------------------------

// Record that `ownerId` used to be `aliasId`, carrying over anything
// `aliasId` had itself been so a chain of migrations collapses onto the
// final identity. Idempotent.
export async function recordOwnerAlias(env: Env, ownerId: string, aliasId: string): Promise<void> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO owner_aliases (owner_id, alias_id, created_at)
       SELECT ?1, alias_id, created_at FROM owner_aliases WHERE owner_id = ?2`,
    ).bind(ownerId, aliasId),
    env.DB.prepare('DELETE FROM owner_aliases WHERE owner_id = ?').bind(aliasId),
    env.DB.prepare(
      'INSERT OR IGNORE INTO owner_aliases (owner_id, alias_id, created_at) VALUES (?, ?, ?)',
    ).bind(ownerId, aliasId, now),
  ]);
}

// Account deletion: no identity row outlives the account. The index rows
// themselves cascade with the documents.
export async function deleteCollabIndexForOwner(env: Env, ownerId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM owner_aliases WHERE owner_id = ? OR alias_id = ?')
    .bind(ownerId, ownerId)
    .run();
}
