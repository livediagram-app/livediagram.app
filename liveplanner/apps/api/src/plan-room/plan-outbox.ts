// What a plan pushes from its Durable Object (liveworkspace/docs/one-explorer-contracts.md "What an item pushes";
// docs/specs/015-api/api.md "Storage"): its summary to the index (`PUT /app/items/:id/summary`), each changed
// tab's comment threads and actions for the Inbox (`PUT /app/items/:id/collab/:tabId`), both with this app's
// key, a Form tab's name and heading on its form link (D1, form_links), and the owner's newest save for the
// lifecycle email (D1, email_lifecycle.active_at).
//
// The plan's triggers fill `outbox` with a key per changed thing (plan-schema.ts), in the same transaction as the
// write, so no write path can forget one and a save makes no network call. The room's alarm drains it on idle,
// at most once a minute per plan (plan-room.ts FLUSH_MIN_GAP_MS), then deletes the keys it pushed. A key written
// again meanwhile has a new id and stays for the next drain; a drain that fails keeps every key it did not push
// and retries a minute later.

import {
  collabIndexRowsFromElements,
  type CollabActionRow,
  type CollabThreadRow,
  type Element,
} from '@liveplanner/project';
import {
  COLLAB_MAX_ACTIONS,
  COLLAB_MAX_THREADS,
  IndexError,
  type CollabPush,
  type IndexAppClient,
  type ItemSummary,
} from '@liveworkspace/index-client';
import { projectStatsSql } from '../db/tab-stats';
import { isEmptyCount, type ContentSummary } from '../db/content-summary';
import { indexAppClient } from '../index-service';
import { ownerActiveStatement } from '../db/email-lifecycle';
import type { PlanEnv } from '../types';

type OutboxRow = { id: number; kind: string; key: string };

type TabRow = {
  id: string;
  name: string;
  data: string;
  order_index: number;
};

// ---------- The collab push -----------------------------------------------------------------------------------

// A tab's comment threads and actions as the index takes them (`tab` null: the tab is gone, so are its rows).
// Capped as the index caps one push: a tab past it keeps its newest.
export function collabPushOf(
  threads: readonly CollabThreadRow[],
  actions: readonly CollabActionRow[],
): CollabPush {
  return {
    threads: [...threads]
      .sort((a, b) => b.latestAt - a.latestAt)
      .slice(0, COLLAB_MAX_THREADS)
      .map((t) => ({
        elementId: t.elementId,
        elementLabel: t.elementLabel,
        resolved: t.resolved,
        commentCount: t.commentCount,
        participantIds: t.participantIds,
        mentionedIds: t.mentionedIds,
        latestText: t.latestText,
        latestAuthorName: t.latestAuthorName ?? '',
        firstAt: t.firstAt,
        latestAt: t.latestAt,
      })),
    actions: [...actions]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, COLLAB_MAX_ACTIONS)
      .map((a) => ({
        elementId: a.elementId,
        actionId: a.actionId,
        elementLabel: a.elementLabel,
        name: a.name,
        status: a.status,
        assigneeId: a.assigneeUserId ?? a.assigneeMemberId ?? null,
        assignerId: a.assignerId,
        teamId: a.teamId,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
  };
}

// A Form tab's name and heading on its link (the form's public page reads them without waking the plan).
function formLinkStatement(
  env: PlanEnv,
  planId: string,
  tabId: string,
  tab: TabRow,
  form: { heading: string | null; boardTabId: string | null } | null,
): D1PreparedStatement {
  return env.DB.prepare(
    'UPDATE form_links SET tab_name = ?3, heading = ?4, board_tab_id = ?5 WHERE project_id = ?1 AND tab_id = ?2',
  ).bind(planId, tabId, tab.name, form?.heading ?? null, form?.boardTabId ?? null);
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

// ---------- Summary ------------------------------------------------------------------------------------------

// The plan's listing summary (db/content-summary.ts) and its last save, read from its own tables, never a body.
export async function readContentSummary(
  env: PlanEnv,
  planId: string,
): Promise<{ summary: ContentSummary; savedAt: number; ownerId: string | null }> {
  const [tabs, stats, plan] = await env.PLAN_DB.batch([
    env.PLAN_DB.prepare(
      // A Form tab's form is not an element, and still content: only a tab with no elements is parsed for one.
      `SELECT dt.tab_id, t.element_count,
              CASE WHEN t.element_count = 0 THEN json_type(t.data, '$.form') = 'object' ELSE 0 END AS has_form
         FROM plan_tabs dt JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.plan_id = ? ORDER BY dt.order_index ASC`,
    ).bind(planId),
    env.PLAN_DB.prepare(`SELECT ${projectStatsSql('?1')}`).bind(planId),
    env.PLAN_DB.prepare('SELECT saved_at, owner_id FROM plan WHERE id = ?').bind(planId),
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
    ownerId: ((plan?.results?.[0] as { owner_id?: string | null } | undefined)?.owner_id ?? null),
  };
}

// The summary as the index keeps it (≤ 2 KB): the Explorer's Details numbers, and whether there is anything to
// draw (no tab, or an empty first tab, asks for no thumbnail).
export function itemSummaryOf(summary: ContentSummary): ItemSummary {
  return {
    mode: summary.stats?.mode ?? 'plan',
    elements: summary.stats?.elements ?? 0,
    comments: summary.stats?.comments ?? 0,
    bytes: summary.stats?.bytes ?? 0,
    empty: isEmptyCount(summary.firstTabCount),
  };
}

// ---------- The drain ----------------------------------------------------------------------------------------

// `more`: keys were left for the next drain (a drain takes at most DRAIN_TABS tabs).
export type DrainResult = { keys: number; pushes: number; more: boolean };

// Tabs one drain pushes: one request each, so a drain after a 200-tab import stays well inside a Durable Object's
// subrequest budget; the rest go in the next drain, which the room runs straight after.
export const DRAIN_TABS = 50;
// Pushes in flight at once.
const PUSH_CONCURRENCY = 6;

// An item the index does not hold (never made there, or purged) takes no push: the key is done.
function pushed(err: unknown): boolean {
  return err instanceof IndexError && err.status === 404;
}

async function inBatches(tasks: (() => Promise<void>)[]): Promise<void> {
  for (let i = 0; i < tasks.length; i += PUSH_CONCURRENCY) {
    await Promise.all(tasks.slice(i, i + PUSH_CONCURRENCY).map((t) => t()));
  }
}

// One drain: the outbox's keys (up to DRAIN_TABS tabs), pushed to the index. Answers what it pushed; throws when
// a push fails (keeping its keys), so the alarm retries. Without an index configured the keys are dropped.
export async function drainOutbox(
  env: PlanEnv,
  planId: string,
  client: IndexAppClient | null = indexAppClient(env),
): Promise<DrainResult> {
  const all = (
    await env.PLAN_DB.prepare('SELECT id, kind, key FROM outbox WHERE plan_id = ? ORDER BY id')
      .bind(planId)
      .all<OutboxRow>()
  ).results;
  if (all.length === 0) return { keys: 0, pushes: 0, more: false };
  const taken = new Set(all.filter((r) => r.kind === 'tab').map((r) => r.key).slice(0, DRAIN_TABS));
  const pending = all.filter((r) => r.kind !== 'tab' || taken.has(r.key));
  const more = pending.length < all.length;
  const done: number[] = [];
  const failures: unknown[] = [];
  const formStmts: D1PreparedStatement[] = [];
  const tasks: (() => Promise<void>)[] = [];

  for (const row of pending) {
    if (row.kind === 'tab') {
      // One body at a time: a drain after a 200-tab import holds one tab in memory, never the plan.
      const tab = await env.PLAN_DB.prepare(
        `SELECT t.id, t.name, t.data, dt.order_index FROM tabs t JOIN plan_tabs dt ON dt.tab_id = t.id
          WHERE dt.plan_id = ? AND t.id = ?`,
      )
        .bind(planId, row.key)
        .first<TabRow>();
      const parsed = tab ? parseTab(tab.data) : { elements: [], form: null };
      if (tab && parsed.form) formStmts.push(formLinkStatement(env, planId, row.key, tab, parsed.form));
      const rows = collabIndexRowsFromElements(parsed.elements);
      const push = collabPushOf(rows.threads, rows.actions);
      tasks.push(async () => {
        try {
          await client?.pushCollab(planId, row.key, push);
          done.push(row.id);
        } catch (err) {
          if (pushed(err)) done.push(row.id);
          else failures.push(err);
        }
      });
    } else if (row.kind === 'summary') {
      const { summary, savedAt, ownerId } = await readContentSummary(env, planId);
      // The owner's newest activity, for the lifecycle email (db/email-lifecycle.ts): rides the D1 batch below.
      if (ownerId && savedAt > 0) formStmts.push(ownerActiveStatement(env, ownerId, savedAt));
      tasks.push(async () => {
        try {
          await client?.pushSummary(planId, itemSummaryOf(summary), savedAt);
          done.push(row.id);
        } catch (err) {
          if (pushed(err)) done.push(row.id);
          else failures.push(err);
        }
      });
    } else {
      // A kind no longer pushed.
      done.push(row.id);
    }
  }

  await inBatches(tasks);
  if (formStmts.length > 0) await env.DB.batch(formStmts);
  if (done.length > 0)
    await env.PLAN_DB.prepare('DELETE FROM outbox WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(done))
      .run();
  if (failures.length > 0) throw failures[0];
  return { keys: done.length, pushes: tasks.length, more };
}
