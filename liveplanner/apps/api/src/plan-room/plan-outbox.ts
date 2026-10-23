// What a plan pushes from its Durable Object (liveworkspace/docs/one-explorer-contracts.md "What an item pushes";
// docs/specs/015-api/api.md "Storage"): its summary to the index (`PUT /app/items/:id/summary`), each changed
// tab's comment threads and actions for the Inbox (`PUT /app/items/:id/collab/:tabId`), who edited it for the
// Timeline and their Most Used (`PUT /app/items/:id/events`), all with this app's key, a Form tab's name and
// heading on its form link (the plan's own form_links, then the index's form row), and the owner's newest save to the liveworkspace accounts Worker
// for its onboarding emails (person/account-app.ts reportOwnerActivity).
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
  capCollabPush,
  drainIndexOutbox,
  editedOf,
  editKeyOf,
  editKeyRange,
  type OutboxRow,
} from '@liveworkspace/index-app';
import {
  COLLAB_CARDS_TAB,
  type CollabPush,
  type IndexAppClient,
  type ItemSummary,
} from '@liveworkspace/index-client';
import { cardsPushOf, noteKnownPeople } from './plan-cards-push';
import { projectStatsSql } from '../db/tab-stats';
import { isEmptyCount, type ContentSummary } from '../db/content-summary';
import { pushFormInbox } from '../forms/form-inbox';
import { indexAppClient } from '../index-service';
import { reportOwnerActivity } from '../person/account-app';
import type { PlanEnv } from '../types';

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
  tabName?: string,
): CollabPush {
  return capCollabPush({
    ...(tabName === undefined ? {} : { tabName }),
    threads: threads.map((t) => ({
      elementId: t.elementId,
      elementLabel: t.elementLabel,
      resolved: t.resolved,
      commentCount: t.commentCount,
      participantIds: t.participantIds,
      mentionedIds: t.mentionedIds,
      latestText: t.latestText,
      latestAuthorName: t.latestAuthorName ?? '',
      latestAuthorColor: t.latestAuthorColor ?? '',
      firstAt: t.firstAt,
      latestAt: t.latestAt,
    })),
    actions: actions.map((a) => ({
      elementId: a.elementId,
      actionId: a.actionId,
      elementLabel: a.elementLabel,
      name: a.name,
      description: a.description,
      status: a.status,
      assigneeId: a.assigneeUserId ?? a.assigneeMemberId ?? null,
      assigneeName: a.assigneeName,
      assignerId: a.assignerId,
      assignerName: a.assignerName,
      teamId: a.teamId,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
  });
}

// A Form tab's name, heading and response board on its link, for the Inbox's form row (forms/form-inbox.ts).
function formLinkStatement(
  env: PlanEnv,
  planId: string,
  tabId: string,
  tab: TabRow,
  form: { heading: string | null; boardTabId: string | null } | null,
): D1PreparedStatement {
  return env.PLAN_DB.prepare(
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
    savedAt: (plan?.results?.[0] as { saved_at?: number } | undefined)?.saved_at ?? 0,
    ownerId: (plan?.results?.[0] as { owner_id?: string | null } | undefined)?.owner_id ?? null,
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

// ---------- Who edited -----------------------------------------------------------------------------------------

/**
 * A person's write to the plan, for the Timeline and their Most Used: replaces their key with one at `at`
 * (@liveworkspace/index-app's edit keys, one per person). The room calls it after a request that wrote
 * (plan-room.ts route()), so the edit is the person's who asked, never a guess from the content. Two plain
 * statements on the room's storage, outside the save's transaction.
 */
export function recordEditor(
  exec: (query: string, ...bindings: (string | number)[]) => unknown,
  planId: string,
  personId: string,
  at: number,
): void {
  const [from, to] = editKeyRange(personId);
  exec(
    `DELETE FROM outbox WHERE plan_id = ? AND kind = 'edit' AND key >= ? AND key < ?`,
    planId,
    from,
    to,
  );
  exec(
    `INSERT INTO outbox (plan_id, kind, key) VALUES (?, 'edit', ?)`,
    planId,
    editKeyOf(personId, at),
  );
}

// ---------- The drain ----------------------------------------------------------------------------------------

// `more`: keys were left for the next drain (a drain takes at most DRAIN_TABS tabs).
export type DrainResult = { keys: number; pushes: number; more: boolean };

export { DRAIN_TABS } from '@liveworkspace/index-app';

// One drain: the outbox's keys, pushed to the index by @liveworkspace/index-app's drainIndexOutbox. Answers what
// it pushed; throws when a push fails (keeping its keys), so the alarm retries. Without an index configured the
// keys are dropped. Beside the pushes, a Form tab's name and heading go on its form link.
export async function drainOutbox(
  env: PlanEnv,
  planId: string,
  client: IndexAppClient | null = indexAppClient(env),
): Promise<DrainResult> {
  const rows = (
    await env.PLAN_DB.prepare('SELECT id, kind, key FROM outbox WHERE plan_id = ? ORDER BY id')
      .bind(planId)
      .all<OutboxRow>()
  ).results;
  const formStmts: D1PreparedStatement[] = [];
  const formTabs: string[] = [];
  // Who wrote to the plan, remembered so a card assigned to them can be named to the index.
  const editors = rows.flatMap((r) => (r.kind === 'edit' ? [editedOf(r.key)?.actorId ?? ''] : []));
  await noteKnownPeople(env, editors.filter(Boolean), Date.now());
  const outcome = await drainIndexOutbox(planId, rows, client, {
    collab: async (tabId) => {
      // The plan's cards and their threads (plan-cards-push.ts).
      if (tabId === COLLAB_CARDS_TAB) {
        const cards = await cardsPushOf(env, planId);
        if (cards.unmatched > 0)
          console.info('[outbox] cards-unmatched', { planId, unmatched: cards.unmatched });
        return cards.push;
      }
      const tab = await env.PLAN_DB.prepare(
        `SELECT t.id, t.name, t.data, dt.order_index FROM tabs t JOIN plan_tabs dt ON dt.tab_id = t.id
          WHERE dt.plan_id = ? AND t.id = ?`,
      )
        .bind(planId, tabId)
        .first<TabRow>();
      const parsed = tab ? parseTab(tab.data) : { elements: [], form: null };
      if (tab && parsed.form) {
        formStmts.push(formLinkStatement(env, planId, tabId, tab, parsed.form));
        formTabs.push(tabId);
      }
      const found = collabIndexRowsFromElements(parsed.elements);
      return collabPushOf(found.threads, found.actions, tab?.name);
    },
    summary: async () => {
      const { summary, savedAt, ownerId } = await readContentSummary(env, planId);
      return { summary: itemSummaryOf(summary), updatedAt: savedAt, ownerId };
    },
    // The owner's newest activity, for liveworkspace's onboarding emails; a guest's is not sent.
    onSummary: (ownerId, at) => reportOwnerActivity(env, ownerId, at),
  });
  if (formStmts.length > 0) {
    await env.PLAN_DB.batch(formStmts);
    // A form's heading and board as the Inbox shows them (forms/form-inbox.ts).
    await Promise.all(formTabs.map((tabId) => pushFormInbox(env, planId, tabId)));
  }
  if (outcome.done.length > 0)
    await env.PLAN_DB.prepare('DELETE FROM outbox WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(outcome.done))
      .run();
  if (outcome.failures.length > 0) throw outcome.failures[0];
  return { keys: outcome.done.length, pushes: outcome.pushes, more: outcome.more };
}
