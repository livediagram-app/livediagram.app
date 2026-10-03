// collab_actions + collab_threads — the collaboration index (docs/specs/013-workspace/activity-page.md
// §2): a SQL-filterable projection of the actions and comment threads
// that live inside element JSON on `tabs`. Plus `owner_aliases` (the
// identities an owner used to be, §2.2) and `collab_index_state` (which
// owners have been backfilled, §2.3).
//
// Writes are STATEMENTS, not calls: every tab write path already runs a
// D1 batch, and appending the index statements to that batch is what
// keeps the index in the same transaction as the blob it mirrors. The
// read is the Activity page's one query per kind.

import type { Element } from '@livediagram/document';
import type { ActivityAction, ActivityReadResult, ActivityThread } from '@livediagram/api-schema';
import { collabIndexRowsFromElements } from '../collab-index/rows';
import { VISIBLE_DOCUMENTS_CTES } from './document-visibility';
import type { Env } from '../types';

// ---------- Writes ----------------------------------------------------

// The statements one tab save contributes: a full replace of the tab's
// rows. On a tab with nothing to index that is two DELETEs touching
// nothing, which is cheap enough to run on every ~600ms autosave.
export function collabIndexStatements(
  env: Env,
  tabId: string,
  elements: Element[],
): D1PreparedStatement[] {
  const rows = collabIndexRowsFromElements(elements);
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM collab_actions WHERE tab_id = ?').bind(tabId),
    env.DB.prepare('DELETE FROM collab_threads WHERE tab_id = ?').bind(tabId),
  ];
  for (const a of rows.actions) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO collab_actions
           (tab_id, element_id, action_id, element_label, name, description, status,
            assignee_user_id, assignee_member_id, assignee_name, assigner_id, assigner_name,
            team_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        tabId,
        a.elementId,
        a.actionId,
        a.elementLabel,
        a.name,
        a.description,
        a.status,
        a.assigneeUserId,
        a.assigneeMemberId,
        a.assigneeName,
        a.assignerId,
        a.assignerName,
        a.teamId,
        a.createdAt,
        a.updatedAt,
      ),
    );
  }
  for (const t of rows.threads) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO collab_threads
           (tab_id, element_id, element_label, resolved, comment_count, participant_ids,
            mentioned_ids, latest_text, latest_author_name, latest_author_color, first_at,
            latest_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        tabId,
        t.elementId,
        t.elementLabel,
        t.resolved ? 1 : 0,
        t.commentCount,
        JSON.stringify(t.participantIds),
        JSON.stringify(t.mentionedIds),
        t.latestText,
        t.latestAuthorName,
        t.latestAuthorColor,
        t.firstAt,
        t.latestAt,
      ),
    );
  }
  return stmts;
}

// A duplicated document copies its tab rows in SQL without parsing them
// (copyDocument), so the index rows are copied the same way, under the
// fresh tab id.
export function collabIndexCopyStatements(
  env: Env,
  fromTabId: string,
  toTabId: string,
): D1PreparedStatement[] {
  return [
    env.DB.prepare(
      `INSERT INTO collab_actions
         (tab_id, element_id, action_id, element_label, name, description, status,
          assignee_user_id, assignee_member_id, assignee_name, assigner_id, assigner_name,
          team_id, created_at, updated_at)
       SELECT ?1, element_id, action_id, element_label, name, description, status,
              assignee_user_id, assignee_member_id, assignee_name, assigner_id, assigner_name,
              team_id, created_at, updated_at
         FROM collab_actions WHERE tab_id = ?2`,
    ).bind(toTabId, fromTabId),
    env.DB.prepare(
      `INSERT INTO collab_threads
         (tab_id, element_id, element_label, resolved, comment_count, participant_ids,
          mentioned_ids, latest_text, latest_author_name, latest_author_color, first_at,
          latest_at)
       SELECT ?1, element_id, element_label, resolved, comment_count, participant_ids,
              mentioned_ids, latest_text, latest_author_name, latest_author_color, first_at,
              latest_at
         FROM collab_threads WHERE tab_id = ?2`,
    ).bind(toTabId, fromTabId),
  ];
}

// ---------- Read ------------------------------------------------------

// The scoping every Activity read shares (docs/specs/013-workspace/activity-page.md §4). `me` is the
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
         v.via, v.share_code, t.name AS tab_name,
         CASE WHEN ca.assignee_user_id IN (SELECT id FROM me)
                OR ca.assignee_member_id IN (SELECT id FROM my_members) THEN 1 ELSE 0 END AS assigned_to_me,
         CASE WHEN ca.assigner_id IN (SELECT id FROM me) THEN 1 ELSE 0 END AS created_by_me
    FROM collab_actions ca
    JOIN document_tabs dt ON dt.tab_id = ca.tab_id
    JOIN visible v ON v.id = dt.document_id
    JOIN tabs t ON t.id = ca.tab_id
   WHERE ca.status = 'open'
     AND (v.scope_tab_id IS NULL OR v.scope_tab_id = ca.tab_id)
     AND (ca.assignee_user_id IN (SELECT id FROM me)
          OR ca.assigner_id IN (SELECT id FROM me)
          OR ca.assignee_member_id IN (SELECT id FROM my_members))
   ORDER BY ca.updated_at DESC
   LIMIT ?3`;

const THREADS_SQL = `${SCOPE_CTES}
  SELECT ct.tab_id, ct.element_id, ct.element_label, ct.comment_count,
         ct.latest_text, ct.latest_author_name, ct.latest_author_color, ct.first_at, ct.latest_at,
         v.id AS document_id, v.name AS document_name, v.team_id AS document_team_id,
         v.via, v.share_code, t.name AS tab_name,
         CASE WHEN EXISTS (SELECT 1 FROM json_each(ct.participant_ids) je
                            WHERE je.value IN (SELECT id FROM me)) THEN 1 ELSE 0 END AS you_commented,
         CASE WHEN v.owner_id = ?1 THEN 1 ELSE 0 END AS on_your_document,
         CASE WHEN EXISTS (SELECT 1 FROM json_each(ct.mentioned_ids) jm
                            WHERE jm.value IN (SELECT id FROM me)
                               OR jm.value IN (SELECT id FROM my_members)) THEN 1 ELSE 0 END
           AS mentions_you
    FROM collab_threads ct
    JOIN document_tabs dt ON dt.tab_id = ct.tab_id
    JOIN visible v ON v.id = dt.document_id
    JOIN tabs t ON t.id = ct.tab_id
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

// A tab linked into two visible documents (docs/specs/006-document/tab-document-many-to-many.md) lists once per
// document; keep the one the reader reaches most directly. A 'shared'
// row whose link has lapsed has nowhere to go and is dropped, the way
// Shared with You drops it.
const VIA_RANK = { own: 0, team: 1, shared: 2 } as const;
function dedupePlaces<R extends PlaceRow>(rows: R[]): R[] {
  const best = new Map<string, R>();
  for (const row of rows) {
    if (row.via === 'shared' && !row.share_code) continue;
    // An action row is one of possibly many on its element (an Action panel,
    // docs/specs/012-collaboration/action-panel.md), so its own id is part of what makes it one row.
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

// ---------- Backfill state + aliases ----------------------------------

export async function getCollabIndexState(
  env: Env,
  ownerId: string,
): Promise<{ backfilledAt: number } | null> {
  const row = await env.DB.prepare(
    'SELECT backfilled_at FROM collab_index_state WHERE owner_id = ?',
  )
    .bind(ownerId)
    .first<{ backfilled_at: number }>();
  return row ? { backfilledAt: row.backfilled_at } : null;
}

export async function markCollabIndexBackfilled(env: Env, ownerId: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO collab_index_state (owner_id, backfilled_at) VALUES (?, ?)
     ON CONFLICT (owner_id) DO UPDATE SET backfilled_at = excluded.backfilled_at`,
  )
    .bind(ownerId, Date.now())
    .run();
}

// The tabs the backfill has to parse: every tab of every document the
// reader can see whose JSON even mentions a thread or an action. The
// LIKE pre-filter runs in SQLite so the (usually large) majority of tabs
// with neither never leave the database. Newest first, capped.
export async function listCollabTabsToBackfill(
  env: Env,
  ownerId: string,
  limit: number,
): Promise<{ id: string; data: string }[]> {
  const res = await env.DB.prepare(
    `SELECT DISTINCT t.id, t.data, t.updated_at
       FROM tabs t
       JOIN document_tabs dt ON dt.tab_id = t.id
       JOIN documents d ON d.id = dt.document_id
       LEFT JOIN shared_with s ON s.document_id = d.id AND s.owner_id = ?1
      WHERE (d.owner_id = ?1
             OR d.team_id IN (SELECT team_id FROM team_members WHERE user_id = ?1 AND status = 'joined')
             OR s.owner_id IS NOT NULL)
        AND (t.data LIKE '%"commentThread":%' OR t.data LIKE '%"action":%')
      ORDER BY t.updated_at DESC
      LIMIT ?2`,
  )
    .bind(ownerId, limit)
    .all<{ id: string; data: string }>();
  return (res.results ?? []).map((r) => ({ id: r.id, data: r.data }));
}

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
    // The backfill stamp follows the owner too, so the seed does not run
    // a second time against the new id (INSERT OR IGNORE keeps an
    // existing stamp on the target, then the source row goes).
    env.DB.prepare(
      `INSERT OR IGNORE INTO collab_index_state (owner_id, backfilled_at)
       SELECT ?1, backfilled_at FROM collab_index_state WHERE owner_id = ?2`,
    ).bind(ownerId, aliasId),
    env.DB.prepare('DELETE FROM collab_index_state WHERE owner_id = ?').bind(aliasId),
  ]);
}

// Account deletion: no identity row outlives the account. The index rows
// themselves cascade with the documents' tabs.
export async function deleteCollabIndexForOwner(env: Env, ownerId: string): Promise<void> {
  // Sequential like the rest of deleteAccount's sweep (each statement
  // is independently idempotent, so there is nothing a batch would
  // protect).
  await env.DB.prepare('DELETE FROM owner_aliases WHERE owner_id = ? OR alias_id = ?')
    .bind(ownerId, ownerId)
    .run();
  await env.DB.prepare('DELETE FROM collab_index_state WHERE owner_id = ?').bind(ownerId).run();
}
