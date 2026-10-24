// What a document pushes from its Durable Object (liveworkspace/docs/one-explorer-contracts.md "What an item
// pushes"; docs/specs/015-api/api.md "Storage"): its summary to the index (`PUT /app/items/:id/summary`), each
// changed tab's comment threads and actions for the Inbox (`PUT /app/items/:id/collab/:tabId`) and who edited it for
// the Timeline and their Most Used (`PUT /app/items/:id/events`), all with this app's key through
// @liveworkspace/index-app's drainIndexOutbox; the images it places to liveworkspace's media service
// (liveworkspace/docs/media.md "References"); and the owner's newest save to the liveworkspace accounts Worker for
// its onboarding emails (liveworkspace/activity.ts reportOwnerActivity).
//
// The document's triggers fill `outbox` with a key per changed thing (document-schema.ts), in the same transaction
// as the write, so no write path can forget one and a save makes no network call. The room's alarm drains it on
// idle, at most once a minute (document-room.ts), then deletes the keys it pushed. A key written again meanwhile has
// a new id and stays for the next drain; a drain that fails keeps every key it did not push and retries a minute
// later.

import {
  collabIndexRowsFromElements,
  type CollabActionRow,
  type CollabThreadRow,
  type Element,
} from '@livediagram/document';
import {
  capCollabPush,
  drainIndexOutbox,
  editKeyOf,
  editKeyRange,
  editedOf,
  type OutboxRow,
} from '@liveworkspace/index-app';
import type { CollabPush, IndexAppClient, ItemSummary } from '@liveworkspace/index-client';
import { MEDIA_REFS_PER_DOCUMENT_MAX } from '@liveworkspace/media';
import { grantPlacedImages } from '../db/image-grants';
import { documentImageIds } from '../db/image-refs';
import { documentStatsSql } from '../db/tab-stats';
import { isEmptyCount, type ContentSummary } from '../db/content-summary';
import { indexAppClient } from '../index-service';
import { mediaClient } from '../media';
import { reportOwnerActivity } from '../liveworkspace/activity';
import type { DocumentEnv } from '../types';

type TabRow = {
  id: string;
  name: string;
  data: string;
};

// ---------- The collab push -----------------------------------------------------------------------------------

// A tab's comment threads and actions as the index takes them. Capped as the index caps one push: a tab past it
// keeps its newest. `by` is whoever alone saved the canvas since the last push, when there was one person: the index
// names them on a thread it sees turn resolved and an action it sees turn done (Timeline); with several, nobody is
// named rather than the wrong person.
export function collabPushOf(
  threads: readonly CollabThreadRow[],
  actions: readonly CollabActionRow[],
  by: string | null = null,
): CollabPush {
  return capCollabPush({
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
      latestAuthorId: t.latestAuthorId,
      resolvedById: t.resolved ? by : null,
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
      doneById: a.status === 'done' ? by : null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
  });
}

function parseElements(data: string): Element[] {
  try {
    const body = JSON.parse(data) as { elements?: unknown };
    return Array.isArray(body.elements) ? (body.elements as Element[]) : [];
  } catch {
    return [];
  }
}

// ---------- Summary ------------------------------------------------------------------------------------------

// The document's listing summary (db/content-summary.ts), its last save and its owner, read from its own tables. A
// body is parsed only for a tab whose stored count is 0, to find an article or a body that is not JSON.
export async function readContentSummary(
  env: DocumentEnv,
  documentId: string,
): Promise<{ summary: ContentSummary; savedAt: number; ownerId: string | null }> {
  const [tabs, stats, document, community] = await env.DOCUMENT_DB.batch([
    env.DOCUMENT_DB.prepare(
      // An article's writing lives in `articles`, not in `elements`, and a body that is not JSON fails safe as
      // content: only a tab whose count is 0 is parsed for either.
      // A former Form tab's form (`form`, not an element) counts as content too; a count not yet known (NULL, -1
      // in the summary) is not empty.
      `SELECT dt.tab_id, COALESCE(t.element_count, -1) AS element_count,
              CASE WHEN t.element_count IS NULL OR t.element_count > 0 THEN 1
                   WHEN NOT json_valid(t.data) THEN 1
                   WHEN COALESCE(json_array_length(t.data, '$.elements'), 0) > 0 THEN 1
                   WHEN EXISTS (SELECT 1 FROM json_each(t.data, '$.articles')) THEN 1
                   WHEN json_type(t.data, '$.form') = 'object' THEN 1
                   ELSE 0
              END AS has_content
         FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.document_id = ? ORDER BY dt.order_index ASC`,
    ).bind(documentId),
    env.DOCUMENT_DB.prepare(`SELECT ${documentStatsSql('?1')}`).bind(documentId),
    env.DOCUMENT_DB.prepare('SELECT saved_at, owner_id FROM document WHERE id = ?').bind(
      documentId,
    ),
    // Listed in the Community (community-post.ts): a post not hidden after reports, whose canvas the listing last
    // heard was public (nothing heard yet, just after publishing, counts).
    env.DOCUMENT_DB.prepare(
      `SELECT 1 AS listed FROM community_post
        WHERE hidden_at IS NULL AND (sent_state IS NULL OR sent_state = 'public') LIMIT 1`,
    ),
  ]);
  const tabRows = (tabs?.results ?? []) as {
    tab_id: string;
    element_count: number;
    has_content: number;
  }[];
  const tabCounts: Record<string, number> = {};
  let hasContent = false;
  for (const t of tabRows) {
    tabCounts[t.tab_id] = t.element_count;
    if (t.has_content === 1) hasContent = true;
  }
  const first = tabRows[0];
  const rawStats = (stats?.results?.[0] as { doc_stats?: string | null } | undefined)?.doc_stats;
  const head = document?.results?.[0] as { saved_at?: number; owner_id?: string } | undefined;
  return {
    summary: {
      firstTabCount: first ? first.element_count : null,
      tabCounts,
      stats: rawStats ? (JSON.parse(rawStats) as ContentSummary['stats']) : null,
      hasContent,
      communityListed: (community?.results?.length ?? 0) > 0,
    },
    savedAt: head?.saved_at ?? 0,
    ownerId: head?.owner_id || null,
  };
}

// The summary as the index keeps it (≤ 2 KB): the Explorer's Details numbers, and whether there is anything to
// draw (no tab, or an empty first tab, asks for no thumbnail).
export function itemSummaryOf(summary: ContentSummary): ItemSummary {
  return {
    // The mode of the tab written last: what the Explorer's details view shows beside the counts.
    mode: summary.stats?.mode ?? 'diagram',
    elements: summary.stats?.elements ?? 0,
    comments: summary.stats?.comments ?? 0,
    bytes: summary.stats?.bytes ?? 0,
    empty: isEmptyCount(summary.firstTabCount),
    // Listed in the public Community: the Explorer's Public badge (@liveworkspace/explorer VisibilityBadge).
    ...(summary.communityListed ? { public: true } : {}),
  };
}

// ---------- Who edited -----------------------------------------------------------------------------------------

/**
 * A person's write to the document, for the Timeline and their Most Used: replaces their key with one at `at`
 * (@liveworkspace/index-app's edit keys, one per person). The room calls it after a request that wrote
 * (document-room.ts route()), so the edit is the person's who asked, never a guess from the content. Two plain
 * statements on the room's storage, outside the save's transaction.
 */
export function recordEditor(
  exec: (query: string, ...bindings: (string | number)[]) => unknown,
  documentId: string,
  personId: string,
  at: number,
): void {
  const [from, to] = editKeyRange(personId);
  exec(
    `DELETE FROM outbox WHERE document_id = ? AND kind = 'edit' AND key >= ? AND key < ?`,
    documentId,
    from,
    to,
  );
  exec(
    `INSERT INTO outbox (document_id, kind, key) VALUES (?, 'edit', ?)`,
    documentId,
    editKeyOf(personId, at),
  );
}

// ---------- Images -------------------------------------------------------------------------------------------

// The images the document places, as the media service keeps them: the whole set, replacing what it held. Every
// document reports each change of its set as it happens (and its purge an empty one), so the app's report is
// always whole: `complete`. Then the images whose owners may place them here right now are granted
// (db/image-grants.ts): `editorKeys` are the outbox's edit keys, whoever wrote since the last push. Without the
// service there is nobody to tell, and no image to serve: answers whether it told the service.
export async function pushImageRefs(
  env: DocumentEnv,
  documentId: string,
  editorKeys: readonly string[] = [],
): Promise<boolean> {
  const media = mediaClient(env);
  if (!media) return false;
  const images = await documentImageIds(env, documentId);
  await grantPlacedImages(env, documentId, images, editorKeys, Date.now());
  if (images.length > MEDIA_REFS_PER_DOCUMENT_MAX) {
    // Past any gallery's cap: the rest stay unreported, so the sweep could take one of them.
    console.error('[media] a document places more images than one sync carries', {
      document: documentId,
      images: images.length,
    });
  }
  const sent = await media.syncRefs({
    documents: [{ document: documentId, images: images.slice(0, MEDIA_REFS_PER_DOCUMENT_MAX) }],
    complete: true,
  });
  if (!sent.ok) throw new Error(`media refs sync failed: ${sent.status}`);
  return true;
}

// A purged document places nothing: the media service is told so, and the images only it placed can be swept.
// Without the service there is nobody to tell.
export async function forgetImageRefs(
  env: Pick<DocumentEnv, 'MEDIA_KEY' | 'MEDIA_URL'>,
  documentId: string,
): Promise<void> {
  const media = mediaClient(env);
  if (!media) return;
  const sent = await media.syncRefs({
    documents: [{ document: documentId, images: [] }],
    complete: true,
  });
  if (!sent.ok) throw new Error(`media refs sync failed: ${sent.status}`);
}

// ---------- The drain ----------------------------------------------------------------------------------------

// `more`: keys were left for the next drain (a drain takes at most DRAIN_TABS tabs).
export type DrainResult = { keys: number; pushes: number; more: boolean };

export { DRAIN_TABS } from '@liveworkspace/index-app';

// One drain: the outbox's keys, pushed to the index by @liveworkspace/index-app's drainIndexOutbox and the images to
// the media service. Answers what it pushed; throws when a push fails (keeping its keys), so the alarm retries.
// Without an index configured the index's keys are dropped.
export async function drainOutbox(
  env: DocumentEnv,
  documentId: string,
  client: IndexAppClient | null = indexAppClient(env),
): Promise<DrainResult> {
  const rows = (
    await env.DOCUMENT_DB.prepare(
      'SELECT id, kind, key FROM outbox WHERE document_id = ? ORDER BY id',
    )
      .bind(documentId)
      .all<OutboxRow>()
  ).results;
  const imageRows = rows.filter((r) => r.kind === 'images').map((r) => r.id);
  // Who saved since the last drain: one person is who resolved or closed what this push shows turned so.
  const editors = new Set(
    rows.filter((r) => r.kind === 'edit').map((r) => editedOf(r.key)?.actorId ?? null),
  );
  const soleEditor = editors.size === 1 ? ([...editors][0] ?? null) : null;
  const indexRows = rows.filter((r) => r.kind !== 'images');
  const failures: unknown[] = [];
  const done: number[] = [];
  let imagesPushed = false;

  const [outcome] = await Promise.all([
    drainIndexOutbox(documentId, indexRows, client, {
      collab: async (tabId) => {
        // One body at a time: a drain after a 200-tab import holds one tab in memory, never the document.
        const tab = await env.DOCUMENT_DB.prepare(
          `SELECT t.id, t.name, t.data FROM tabs t JOIN document_tabs dt ON dt.tab_id = t.id
            WHERE dt.document_id = ? AND t.id = ?`,
        )
          .bind(documentId, tabId)
          .first<TabRow>();
        const found = collabIndexRowsFromElements(tab ? parseElements(tab.data) : []);
        return collabPushOf(found.threads, found.actions, soleEditor);
      },
      summary: async () => {
        const { summary, savedAt, ownerId } = await readContentSummary(env, documentId);
        return { summary: itemSummaryOf(summary), updatedAt: savedAt, ownerId };
      },
      // The owner's newest activity, for liveworkspace's onboarding emails; a guest's is not sent.
      onSummary: (ownerId, at) => reportOwnerActivity(env, ownerId, at),
    }),
    imageRows.length > 0
      ? pushImageRefs(
          env,
          documentId,
          rows.filter((r) => r.kind === 'edit').map((r) => r.key),
        ).then(
          (sent) => {
            imagesPushed = sent;
            done.push(...imageRows);
          },
          (err: unknown) => void failures.push(err),
        )
      : null,
  ]);
  done.push(...outcome.done);
  failures.push(...outcome.failures);
  if (done.length > 0)
    await env.DOCUMENT_DB.prepare('DELETE FROM outbox WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(done))
      .run();
  if (failures.length > 0) throw failures[0];
  return {
    keys: done.length,
    pushes: outcome.pushes + (imagesPushed ? 1 : 0),
    more: outcome.more,
  };
}
