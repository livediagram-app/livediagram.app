// What a design pushes from its Durable Object (liveworkspace/docs/one-explorer-contracts.md "What an item pushes";
// docs/specs/015-api/api.md "Storage"): its summary to the index (`PUT /app/items/:id/summary`), each changed
// tab's comment threads and actions for the Inbox (`PUT /app/items/:id/collab/:tabId`), who edited it for the
// Timeline and their Most Used (`PUT /app/items/:id/events`), all with this app's key, the images it places to
// liveworkspace's media service (`POST /app/refs`, src/media.ts), and the owner's newest save to the liveworkspace
// accounts Worker for its onboarding emails (@liveworkspace/index-app reportOwnerActivity).
//
// The design's triggers fill `outbox` with a key per changed thing (design-schema.ts), in the same transaction as the
// write, so no write path can forget one and a save makes no network call. The room's alarm drains it on idle,
// at most once a minute per design (design-room.ts FLUSH_MIN_GAP_MS), then deletes the keys it pushed. A key written
// again meanwhile has a new id and stays for the next drain; a drain that fails keeps every key it did not push
// and retries a minute later.

import {
  collabIndexRowsFromElements,
  type CollabActionRow,
  type CollabThreadRow,
  type Element,
} from '@livedesign/design';
import {
  capCollabPush,
  drainIndexOutbox,
  type OutboxRow,
  reportOwnerActivity,
} from '@liveworkspace/index-app';
import type { CollabPush, IndexAppClient, ItemSummary } from '@liveworkspace/index-client';
import { designStatsSql } from '../db/tab-stats';
import { isEmptyCount, type ContentSummary } from '../db/content-summary';
import { indexAppClient } from '../index-service';
import { accountsClient } from '../accounts/client';
import { grantPlacedImages } from '../db/image-grants';
import { designImageIds, mediaClient, pushDesignMediaRefs } from '../media';
import type { DesignEnv } from '../types';

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
      latestAuthorId: t.latestAuthorId ?? null,
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

function elementsOf(data: string): Element[] {
  try {
    const body = JSON.parse(data) as { elements?: unknown };
    return Array.isArray(body.elements) ? (body.elements as Element[]) : [];
  } catch {
    return [];
  }
}

// ---------- Summary ------------------------------------------------------------------------------------------

// The design's listing summary (db/content-summary.ts) and its last save, read from its own tables, never a body.
export async function readContentSummary(
  env: DesignEnv,
  designId: string,
): Promise<{ summary: ContentSummary; savedAt: number; ownerId: string | null }> {
  const [tabs, stats, design] = await env.DESIGN_DB.batch([
    env.DESIGN_DB.prepare(
      `SELECT dt.tab_id, t.element_count
         FROM design_tabs dt JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.design_id = ? ORDER BY dt.order_index ASC`,
    ).bind(designId),
    env.DESIGN_DB.prepare(`SELECT ${designStatsSql('?1')}`).bind(designId),
    env.DESIGN_DB.prepare('SELECT saved_at, owner_id FROM design WHERE id = ?').bind(designId),
  ]);
  const tabRows = (tabs?.results ?? []) as { tab_id: string; element_count: number | null }[];
  const tabCounts: Record<string, number> = {};
  let hasContent = false;
  for (const t of tabRows) {
    tabCounts[t.tab_id] = t.element_count ?? -1;
    // An unknown count is content: the sweep fails safe.
    if (t.element_count === null || t.element_count > 0) hasContent = true;
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
    savedAt: (design?.results?.[0] as { saved_at?: number } | undefined)?.saved_at ?? 0,
    ownerId: (design?.results?.[0] as { owner_id?: string | null } | undefined)?.owner_id ?? null,
  };
}

// The summary as the index keeps it (≤ 2 KB): the Explorer's Details numbers, and whether there is anything to
// draw (no tab, or an empty first tab, asks for no thumbnail).
export function itemSummaryOf(summary: ContentSummary): ItemSummary {
  return {
    mode: summary.stats?.mode ?? 'pages',
    elements: summary.stats?.elements ?? 0,
    comments: summary.stats?.comments ?? 0,
    bytes: summary.stats?.bytes ?? 0,
    empty: isEmptyCount(summary.firstTabCount),
    // Whether anything is on any tab: false, the index's daily empty clean-up moves the item to the Trash once it has
    // sat unchanged for 30 days (docs/specs/013-workspace/empty-design-cleanup.md).
    hasContent: summary.hasContent,
  };
}

// ---------- Who edited -----------------------------------------------------------------------------------------

// Where a person's write to the design is recorded, for the Timeline and their Most Used: the room calls
// @liveworkspace/index-app's recordItemEditor with this after a request that wrote (design-room.ts route()), so the
// edit is the person's who asked, never a guess from the content. Two plain statements on the room's storage, outside
// the save's transaction.
export const DESIGN_OUTBOX = { table: 'outbox', itemColumn: 'design_id' } as const;

// ---------- The drain ----------------------------------------------------------------------------------------

// `more`: keys were left for the next drain (a drain takes at most DRAIN_TABS tabs).
export type DrainResult = { keys: number; pushes: number; more: boolean };

export { DRAIN_TABS } from '@liveworkspace/index-app';

// One drain: the outbox's keys, pushed to the index by @liveworkspace/index-app's drainIndexOutbox, and a 'media'
// key to the media service. Answers what it pushed; throws when a push fails (keeping its keys), so the alarm
// retries. Without an index configured the index's keys are dropped.
export async function drainOutbox(
  env: DesignEnv,
  designId: string,
  client: IndexAppClient | null = indexAppClient(env),
): Promise<DrainResult> {
  const rows = (
    await env.DESIGN_DB.prepare('SELECT id, kind, key FROM outbox WHERE design_id = ? ORDER BY id')
      .bind(designId)
      .all<OutboxRow>()
  ).results;
  const media = rows.filter((r) => r.kind === 'media');
  const outcome = await drainIndexOutbox(
    designId,
    rows.filter((r) => r.kind !== 'media'),
    client,
    {
      collab: async (tabId) => {
        const tab = await env.DESIGN_DB.prepare(
          `SELECT t.id, t.name, t.data, dt.order_index FROM tabs t JOIN design_tabs dt ON dt.tab_id = t.id
            WHERE dt.design_id = ? AND t.id = ?`,
        )
          .bind(designId, tabId)
          .first<TabRow>();
        const found = collabIndexRowsFromElements(tab ? elementsOf(tab.data) : []);
        return collabPushOf(found.threads, found.actions, tab?.name);
      },
      summary: async () => {
        const { summary, savedAt, ownerId } = await readContentSummary(env, designId);
        return { summary: itemSummaryOf(summary), updatedAt: savedAt, ownerId };
      },
      // The owner's newest activity, for liveworkspace's onboarding emails; a guest's is not sent.
      onSummary: (ownerId, at) => reportOwnerActivity(accountsClient(env), ownerId, at),
    },
  );
  const done = [...outcome.done];
  const failures = [...outcome.failures];
  let pushes = outcome.pushes;
  if (media.length > 0) {
    // The images the design places now, its whole set, to the media service (src/media.ts), once the ones whose
    // owners may place them here right now are granted (db/image-grants.ts): whoever wrote since the last push (the
    // outbox's edit keys, read with this drain's rows) and the team's joined people. Without the service there is
    // no image to serve, and nobody to tell.
    try {
      if (mediaClient(env)) {
        const images = await designImageIds(env, designId);
        const editorKeys = rows.filter((r) => r.kind === 'edit').map((r) => r.key);
        await grantPlacedImages(env, designId, images, editorKeys, Date.now());
        await pushDesignMediaRefs(env, designId, images);
      }
      done.push(...media.map((r) => r.id));
      pushes += 1;
    } catch (err) {
      failures.push(err);
    }
  }
  if (done.length > 0)
    await env.DESIGN_DB.prepare('DELETE FROM outbox WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(done))
      .run();
  if (failures.length > 0) throw failures[0];
  return { keys: done.length, pushes, more: outcome.more };
}
