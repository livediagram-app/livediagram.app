// What a plan pushes to D1 from its Durable Object (docs/specs/015-api/api.md "Storage"; liveworkspace's
// one-explorer-contracts.md "What an item pushes"). The plan's content lives in its own SQLite; D1 keeps only the
// index tables the cross-plan reads need (the Inbox, Home, the Explorer's listings), and this is the one place
// they are written from.
//
// The plan's triggers fill `outbox` with a key per changed thing (plan-schema.ts), in the same transaction as the
// write, so no write path can forget one and a save makes no D1 round trip. The room's alarm drains it on idle,
// at most once a minute (plan-room.ts): one D1 batch per drain, then the keys it read are deleted. A key written
// again meanwhile has a new id and stays for the next drain; a drain that fails keeps every key and retries.

import {
  collabIndexRowsFromElements,
  planBoardRowsFromElements,
  type CollabActionRow,
  type CollabThreadRow,
  type Element,
} from '@liveplanner/project';
import { projectStatsSql } from '../db/tab-stats';
import type { ContentSummary } from '../db/content-summary';
import type { PlanEnv } from '../types';

type OutboxRow = { id: number; kind: string; key: string };

type TabRow = {
  id: string;
  name: string;
  data: string;
  order_index: number;
};

const EXISTS_PROJECT = 'EXISTS (SELECT 1 FROM projects WHERE id = ?1)';

// A bound JSON array stays under D1's 2 MB per value: rows go in chunks of at most this many bytes.
const CHUNK_BYTES = 1_000_000;

export function jsonChunks(rows: readonly unknown[]): string[] {
  const chunks: string[] = [];
  let part: string[] = [];
  let size = 2;
  for (const row of rows) {
    const text = JSON.stringify(row);
    if (part.length > 0 && size + text.length + 1 > CHUNK_BYTES) {
      chunks.push(`[${part.join(',')}]`);
      part = [];
      size = 2;
    }
    part.push(text);
    size += text.length + 1;
  }
  if (part.length > 0) chunks.push(`[${part.join(',')}]`);
  return chunks;
}

// ---------- The collab seam ---------------------------------------------------------------------------------

// A tab's comment threads and actions, replacing that tab's rows in the Inbox's index. Today they land in D1's
// collab tables, which the Inbox reads; the index step points this at liveworkspace's index instead
// (`PUT /app/items/:id/collab/:tabId`), with the same rows. `tab` null: the tab is gone, so are its rows.
export function onTabCollabChanged(
  env: PlanEnv,
  planId: string,
  tabId: string,
  tab: { name: string } | null,
  threads: readonly CollabThreadRow[],
  actions: readonly CollabActionRow[],
): D1PreparedStatement[] {
  const stmts = [
    env.DB.prepare('DELETE FROM collab_actions WHERE project_id = ?1 AND tab_id = ?2').bind(
      planId,
      tabId,
    ),
    env.DB.prepare('DELETE FROM collab_threads WHERE project_id = ?1 AND tab_id = ?2').bind(
      planId,
      tabId,
    ),
  ];
  if (!tab) return stmts;
  for (const chunk of jsonChunks(actions)) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO collab_actions
           (project_id, tab_id, tab_name, element_id, action_id, element_label, name, description, status,
            assignee_user_id, assignee_member_id, assignee_name, assigner_id, assigner_name, team_id,
            created_at, updated_at)
         SELECT ?1, ?2, ?3, value ->> '$.elementId', value ->> '$.actionId', value ->> '$.elementLabel',
                value ->> '$.name', value ->> '$.description', value ->> '$.status',
                value ->> '$.assigneeUserId', value ->> '$.assigneeMemberId', value ->> '$.assigneeName',
                value ->> '$.assignerId', value ->> '$.assignerName', value ->> '$.teamId',
                value ->> '$.createdAt', value ->> '$.updatedAt'
           FROM json_each(?4)
          WHERE ${EXISTS_PROJECT}`,
      ).bind(planId, tabId, tab.name, chunk),
    );
  }
  for (const chunk of jsonChunks(threads)) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO collab_threads
           (project_id, tab_id, tab_name, element_id, element_label, resolved, comment_count,
            participant_ids, mentioned_ids, latest_text, latest_author_name, latest_author_color,
            first_at, latest_at)
         SELECT ?1, ?2, ?3, value ->> '$.elementId', value ->> '$.elementLabel',
                CASE WHEN value ->> '$.resolved' THEN 1 ELSE 0 END, value ->> '$.commentCount',
                value -> '$.participantIds', value -> '$.mentionedIds', value ->> '$.latestText',
                value ->> '$.latestAuthorName', value ->> '$.latestAuthorColor',
                value ->> '$.firstAt', value ->> '$.latestAt'
           FROM json_each(?4)
          WHERE ${EXISTS_PROJECT}`,
      ).bind(planId, tabId, tab.name, chunk),
    );
  }
  return stmts;
}

// The tab's Plan board columns (Home's plans, the Inbox's cards), and a Form tab's name and heading on its link.
function tabBoardStatements(
  env: PlanEnv,
  planId: string,
  tabId: string,
  tab: TabRow | null,
  elements: readonly Element[],
  form: { heading: string | null; boardTabId: string | null } | null,
): D1PreparedStatement[] {
  const stmts = [
    env.DB.prepare('DELETE FROM plan_board_statuses WHERE project_id = ?1 AND tab_id = ?2').bind(
      planId,
      tabId,
    ),
  ];
  if (!tab) {
    // A tab-scoped share link of a tab now gone opens nothing (docs/specs/013-workspace/tab-scoped-share-links.md);
    // the tab delete route drops it at once, this catches every other way a tab goes.
    stmts.push(
      env.DB.prepare('DELETE FROM share_links WHERE project_id = ?1 AND tab_id = ?2').bind(planId, tabId),
    );
    return stmts;
  }
  const rows = planBoardRowsFromElements(elements);
  for (const chunk of jsonChunks(rows)) {
    stmts.push(
      env.DB.prepare(
        `INSERT OR REPLACE INTO plan_board_statuses
           (project_id, tab_id, tab_name, tab_order, element_id, board_title, status, done, board_order, position)
         SELECT ?1, ?2, ?3, ?4, value ->> '$.elementId', value ->> '$.boardTitle', value ->> '$.status',
                CASE WHEN value ->> '$.done' THEN 1 ELSE 0 END, value ->> '$.boardOrder', value ->> '$.position'
           FROM json_each(?5)
          WHERE ${EXISTS_PROJECT}`,
      ).bind(planId, tabId, tab.name, tab.order_index, chunk),
    );
  }
  stmts.push(
    env.DB.prepare(
      'UPDATE form_links SET tab_name = ?3, heading = ?4, board_tab_id = ?5 WHERE project_id = ?1 AND tab_id = ?2',
    ).bind(planId, tabId, tab.name, form?.heading ?? null, form?.boardTabId ?? null),
  );
  return stmts;
}

type ParsedTab = {
  elements: Element[];
  form: { heading: string | null; boardTabId: string | null } | null;
};

function parseTab(data: string): ParsedTab {
  try {
    const body = JSON.parse(data) as {
      elements?: unknown;
      form?: { heading?: unknown; sheet?: { tabId?: unknown }; destination?: { tabId?: unknown } };
    };
    const form = body.form && typeof body.form === 'object' ? body.form : null;
    const boardTab = form?.sheet?.tabId ?? form?.destination?.tabId;
    return {
      elements: Array.isArray(body.elements) ? (body.elements as Element[]) : [],
      form: form
        ? {
            heading: typeof form.heading === 'string' ? form.heading : null,
            boardTabId: typeof boardTab === 'string' ? boardTab : null,
          }
        : null,
    };
  } catch {
    return { elements: [], form: null };
  }
}

// ---------- Cards --------------------------------------------------------------------------------------------

// A card the Inbox can list: one assigned to someone, or holding a comment thread. Only what it reads leaves.
function inboxFields(fields: string): string | null {
  try {
    const f = JSON.parse(fields) as Record<string, unknown>;
    const assignee = f.assignee as { id?: unknown } | undefined;
    const comments = f.comments as { comments?: unknown[] } | undefined;
    const listed =
      (assignee && typeof assignee.id === 'string') ||
      (Array.isArray(comments?.comments) && comments.comments.length > 0);
    if (!listed) return null;
    return JSON.stringify({
      title: f.title,
      status: f.status,
      assignee: f.assignee,
      archived: f.archived,
      linked: f.linked,
      comments: f.comments,
    });
  } catch {
    return null;
  }
}

function cardStatements(env: PlanEnv, planId: string, ids: string[], rows: CardRow[]): D1PreparedStatement[] {
  const keep: { id: string; item_key: number; type: string; fields: string; updated_at: number }[] = [];
  for (const row of rows) {
    const fields = inboxFields(row.fields);
    if (fields) keep.push({ ...row, fields });
  }
  const stmts = [
    env.DB.prepare(
      'DELETE FROM plan_cards WHERE project_id = ?1 AND id IN (SELECT value FROM json_each(?2))',
    ).bind(planId, JSON.stringify(ids)),
  ];
  for (const chunk of jsonChunks(keep)) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO plan_cards (project_id, id, item_key, type, fields, updated_at)
         SELECT ?1, value ->> '$.id', value ->> '$.item_key', value ->> '$.type', value ->> '$.fields',
                value ->> '$.updated_at'
           FROM json_each(?2)
          WHERE ${EXISTS_PROJECT}`,
      ).bind(planId, chunk),
    );
  }
  return stmts;
}

type CardRow = { id: string; item_key: number; type: string; fields: string; updated_at: number };

// ---------- Summary ------------------------------------------------------------------------------------------

// The plan's listing summary (db/content-summary.ts) and its last save, read from its own tables, never a body.
export async function readContentSummary(
  env: PlanEnv,
  planId: string,
): Promise<{ summary: ContentSummary; savedAt: number }> {
  const [tabs, stats, plan] = await env.PLAN_DB.batch([
    env.PLAN_DB.prepare(
      // A Form tab's form is not an element, and still content: only a tab with no elements is parsed for one.
      `SELECT dt.tab_id, t.element_count,
              CASE WHEN t.element_count = 0 THEN json_type(t.data, '$.form') = 'object' ELSE 0 END AS has_form
         FROM plan_tabs dt JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.plan_id = ? ORDER BY dt.order_index ASC`,
    ).bind(planId),
    env.PLAN_DB.prepare(`SELECT ${projectStatsSql('?1')}`).bind(planId),
    env.PLAN_DB.prepare('SELECT saved_at FROM plan WHERE id = ?').bind(planId),
  ]);
  const tabRows = (tabs?.results ?? []) as {
    tab_id: string;
    element_count: number | null;
    has_form: number | null;
  }[];
  const tabCounts: Record<string, number> = {};
  let hasContent = false;
  for (const t of tabRows) {
    tabCounts[t.tab_id] = t.element_count ?? -1;
    // An unknown count is content: the sweep fails safe.
    if (t.element_count === null || t.element_count > 0 || t.has_form === 1) hasContent = true;
  }
  const first = tabRows[0];
  const rawStats = (stats?.results?.[0] as { doc_stats?: string | null } | undefined)?.doc_stats;
  return {
    summary: {
      firstTabCount: first ? (first.element_count ?? -1) : null,
      tabCounts,
      stats: rawStats ? (JSON.parse(rawStats) as ContentSummary['stats']) : null,
      hasContent,
    },
    savedAt: ((plan?.results?.[0] as { saved_at?: number } | undefined)?.saved_at ?? 0),
  };
}

// ---------- The drain ----------------------------------------------------------------------------------------

// `more`: keys were left for the next drain (a drain takes at most DRAIN_TABS tabs).
export type DrainResult = { keys: number; statements: number; more: boolean };

// Tabs one drain pushes. Each costs D1 about four statements plus one per 1 MB of rows, so a drain after a 200-tab
// import or copy stays a batch of a few hundred statements, well inside D1's per-invocation limits; the rest go
// in the next drain, which the room runs straight after.
export const DRAIN_TABS = 50;

// One drain: the outbox's keys (up to DRAIN_TABS tabs), as one D1 batch. Answers what it pushed; throws (keeping
// every key) when D1 refuses, so the alarm retries.
export async function drainOutbox(env: PlanEnv, planId: string): Promise<DrainResult> {
  const all = (
    await env.PLAN_DB.prepare('SELECT id, kind, key FROM outbox WHERE plan_id = ? ORDER BY id')
      .bind(planId)
      .all<OutboxRow>()
  ).results;
  if (all.length === 0) return { keys: 0, statements: 0, more: false };
  const taken = new Set(all.filter((r) => r.kind === 'tab').map((r) => r.key).slice(0, DRAIN_TABS));
  const pending = all.filter((r) => r.kind !== 'tab' || taken.has(r.key));
  const more = pending.length < all.length;
  const byKind = (kind: string) => pending.filter((r) => r.kind === kind).map((r) => r.key);
  const stmts: D1PreparedStatement[] = [];

  const tabIds = byKind('tab');
  // One body at a time: a drain after a 200-tab import holds one tab in memory, never the plan.
  for (const tabId of tabIds) {
    const tab = await env.PLAN_DB.prepare(
      `SELECT t.id, t.name, t.data, dt.order_index FROM tabs t JOIN plan_tabs dt ON dt.tab_id = t.id
        WHERE dt.plan_id = ? AND t.id = ?`,
    )
      .bind(planId, tabId)
      .first<TabRow>();
    const parsed = tab ? parseTab(tab.data) : { elements: [], form: null };
    const rows = collabIndexRowsFromElements(parsed.elements);
    stmts.push(...onTabCollabChanged(env, planId, tabId, tab, rows.threads, rows.actions));
    stmts.push(...tabBoardStatements(env, planId, tabId, tab, parsed.elements, parsed.form));
  }

  const orderIds = byKind('order').filter((id) => !tabIds.includes(id));
  if (orderIds.length > 0) {
    const order = (
      await env.PLAN_DB.prepare(
        `SELECT tab_id, order_index FROM plan_tabs WHERE plan_id = ? AND tab_id IN (SELECT value FROM json_each(?))`,
      )
        .bind(planId, JSON.stringify(orderIds))
        .all<{ tab_id: string; order_index: number }>()
    ).results;
    if (order.length > 0) {
      stmts.push(
        env.DB.prepare(
          `UPDATE plan_board_statuses
              SET tab_order = (SELECT value ->> '$.order_index' FROM json_each(?2) WHERE value ->> '$.tab_id' = plan_board_statuses.tab_id)
            WHERE project_id = ?1 AND tab_id IN (SELECT value ->> '$.tab_id' FROM json_each(?2))`,
        ).bind(planId, JSON.stringify(order)),
      );
    }
  }

  const itemIds = byKind('item');
  if (itemIds.length > 0) {
    const items = (
      await env.PLAN_DB.prepare(
        `SELECT id, item_key, type, fields, updated_at FROM items
          WHERE plan_id = ? AND id IN (SELECT value FROM json_each(?))`,
      )
        .bind(planId, JSON.stringify(itemIds))
        .all<CardRow>()
    ).results;
    stmts.push(...cardStatements(env, planId, itemIds, items));
  }

  if (byKind('summary').length > 0) {
    const { summary, savedAt } = await readContentSummary(env, planId);
    stmts.push(
      env.DB.prepare(
        'UPDATE projects SET content_summary = ?2, saved_at = MAX(saved_at, ?3) WHERE id = ?1',
      ).bind(planId, JSON.stringify(summary), savedAt),
    );
  }

  if (stmts.length > 0) await env.DB.batch(stmts);
  await env.PLAN_DB.prepare('DELETE FROM outbox WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(pending.map((r) => r.id)))
    .run();
  return { keys: pending.length, statements: stmts.length, more };
}
