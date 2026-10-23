// What a document pushes to D1 from its Durable Object (docs/specs/015-api/api.md "Storage"; liveworkspace's
// one-explorer-contracts.md "What an item pushes"). The document's content lives in its own SQLite; D1 keeps only
// the index tables the cross-document reads need (the Inbox, Home, the Explorer's listings, the image gallery's
// usage and the media service's references), and this is the one place they are written from.
//
// The document's triggers fill `outbox` with a key per changed thing (document-schema.ts), in the same transaction
// as the write, so no write path can forget one and a save makes no D1 round trip. The room's alarm drains it on
// idle, at most once a minute (document-room.ts): one D1 batch per drain, then the keys it read are deleted. A key
// written again meanwhile has a new id and stays for the next drain; a drain that fails keeps every key and retries.

import {
  collabIndexRowsFromElements,
  type CollabActionRow,
  type CollabThreadRow,
  type Element,
} from '@livediagram/document';
import { imageGrantPlacementStatements } from '../db/image-grants';
import { documentImageIds } from '../db/image-refs';
import { documentStatsSql } from '../db/tab-stats';
import type { ContentSummary } from '../db/content-summary';
import { mediaRefQueueSetStatement } from '../media';
import type { DocumentEnv } from '../types';

type OutboxRow = { id: number; kind: string; key: string };

type TabRow = {
  id: string;
  name: string;
  data: string;
};

const EXISTS_DOCUMENT = 'EXISTS (SELECT 1 FROM documents WHERE id = ?1)';

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
  env: DocumentEnv,
  documentId: string,
  tabId: string,
  tab: { name: string } | null,
  threads: readonly CollabThreadRow[],
  actions: readonly CollabActionRow[],
): D1PreparedStatement[] {
  const stmts = [
    env.DB.prepare('DELETE FROM collab_actions WHERE document_id = ?1 AND tab_id = ?2').bind(
      documentId,
      tabId,
    ),
    env.DB.prepare('DELETE FROM collab_threads WHERE document_id = ?1 AND tab_id = ?2').bind(
      documentId,
      tabId,
    ),
  ];
  if (!tab) return stmts;
  for (const chunk of jsonChunks(actions)) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO collab_actions
           (document_id, tab_id, tab_name, element_id, action_id, element_label, name, description, status,
            assignee_user_id, assignee_member_id, assignee_name, assigner_id, assigner_name, team_id,
            created_at, updated_at)
         SELECT ?1, ?2, ?3, value ->> '$.elementId', value ->> '$.actionId', value ->> '$.elementLabel',
                value ->> '$.name', value ->> '$.description', value ->> '$.status',
                value ->> '$.assigneeUserId', value ->> '$.assigneeMemberId', value ->> '$.assigneeName',
                value ->> '$.assignerId', value ->> '$.assignerName', value ->> '$.teamId',
                value ->> '$.createdAt', value ->> '$.updatedAt'
           FROM json_each(?4)
          WHERE ${EXISTS_DOCUMENT}`,
      ).bind(documentId, tabId, tab.name, chunk),
    );
  }
  for (const chunk of jsonChunks(threads)) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO collab_threads
           (document_id, tab_id, tab_name, element_id, element_label, resolved, comment_count,
            participant_ids, mentioned_ids, latest_text, latest_author_name, latest_author_color,
            first_at, latest_at)
         SELECT ?1, ?2, ?3, value ->> '$.elementId', value ->> '$.elementLabel',
                CASE WHEN value ->> '$.resolved' THEN 1 ELSE 0 END, value ->> '$.commentCount',
                value -> '$.participantIds', value -> '$.mentionedIds', value ->> '$.latestText',
                COALESCE(value ->> '$.latestAuthorName', ''), COALESCE(value ->> '$.latestAuthorColor', ''),
                COALESCE(value ->> '$.firstAt', 0), COALESCE(value ->> '$.latestAt', 0)
           FROM json_each(?4)
          WHERE ${EXISTS_DOCUMENT}`,
      ).bind(documentId, tabId, tab.name, chunk),
    );
  }
  return stmts;
}

function parseElements(data: string): Element[] {
  try {
    const body = JSON.parse(data) as { elements?: unknown };
    return Array.isArray(body.elements) ? (body.elements as Element[]) : [];
  } catch {
    return [];
  }
}

// ---------- Images -------------------------------------------------------------------------------------------

// The images the document places (db/image-refs.ts), as D1 keeps them: the media service hears of a changed set
// first (compared with the rows still there), then `document_images` takes the new set, then the images whose
// owners may place them here right now are granted (db/image-grants.ts). A document D1 no longer has gets none
// of it: every statement is conditioned on its row.
function imageStatements(
  env: DocumentEnv,
  documentId: string,
  ids: string[],
  now: number,
): D1PreparedStatement[] {
  const set = JSON.stringify(ids);
  return [
    mediaRefQueueSetStatement(env, documentId, ids),
    env.DB.prepare(
      `DELETE FROM document_images
        WHERE document_id = ?1 AND image_id NOT IN (SELECT value FROM json_each(?2))`,
    ).bind(documentId, set),
    env.DB.prepare(
      `INSERT OR IGNORE INTO document_images (document_id, image_id)
       SELECT ?1, value FROM json_each(?2) WHERE ${EXISTS_DOCUMENT}`,
    ).bind(documentId, set),
    ...imageGrantPlacementStatements(env, documentId, ids, now),
  ];
}

// ---------- Summary ------------------------------------------------------------------------------------------

// The document's listing summary (db/content-summary.ts) and its last save, read from its own tables. A body is
// parsed only for a tab whose stored count is 0, to find an article or a body that is not JSON.
export async function readContentSummary(
  env: DocumentEnv,
  documentId: string,
): Promise<{ summary: ContentSummary; savedAt: number }> {
  const [tabs, stats, document] = await env.DOCUMENT_DB.batch([
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
    env.DOCUMENT_DB.prepare('SELECT saved_at FROM document WHERE id = ?').bind(documentId),
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
  return {
    summary: {
      firstTabCount: first ? first.element_count : null,
      tabCounts,
      stats: rawStats ? (JSON.parse(rawStats) as ContentSummary['stats']) : null,
      hasContent,
    },
    savedAt: (document?.results?.[0] as { saved_at?: number } | undefined)?.saved_at ?? 0,
  };
}

// ---------- The drain ----------------------------------------------------------------------------------------

// `more`: keys were left for the next drain (a drain takes at most DRAIN_TABS tabs).
export type DrainResult = { keys: number; statements: number; more: boolean };

// Tabs one drain pushes. Each costs D1 about three statements plus one per 1 MB of rows, so a drain after a 200-tab
// import or copy stays a batch of a few hundred statements, well inside D1's per-invocation limits; the rest go
// in the next drain, which the room runs straight after.
export const DRAIN_TABS = 50;

// One drain: the outbox's keys (up to DRAIN_TABS tabs), as one D1 batch. Answers what it pushed; throws (keeping
// every key) when D1 refuses, so the alarm retries.
export async function drainOutbox(env: DocumentEnv, documentId: string): Promise<DrainResult> {
  const all = (
    await env.DOCUMENT_DB.prepare(
      'SELECT id, kind, key FROM outbox WHERE document_id = ? ORDER BY id',
    )
      .bind(documentId)
      .all<OutboxRow>()
  ).results;
  if (all.length === 0) return { keys: 0, statements: 0, more: false };
  const taken = new Set(
    all
      .filter((r) => r.kind === 'tab')
      .map((r) => r.key)
      .slice(0, DRAIN_TABS),
  );
  const pending = all.filter((r) => r.kind !== 'tab' || taken.has(r.key));
  const more = pending.length < all.length;
  const byKind = (kind: string) => pending.filter((r) => r.kind === kind).map((r) => r.key);
  const stmts: D1PreparedStatement[] = [];
  const now = Date.now();

  // One body at a time: a drain after a 200-tab import holds one tab in memory, never the document.
  for (const tabId of byKind('tab')) {
    const tab = await env.DOCUMENT_DB.prepare(
      `SELECT t.id, t.name, t.data FROM tabs t JOIN document_tabs dt ON dt.tab_id = t.id
        WHERE dt.document_id = ? AND t.id = ?`,
    )
      .bind(documentId, tabId)
      .first<TabRow>();
    const rows = collabIndexRowsFromElements(tab ? parseElements(tab.data) : []);
    stmts.push(...onTabCollabChanged(env, documentId, tabId, tab, rows.threads, rows.actions));
    // A tab-scoped share link of a tab now gone opens nothing (docs/specs/013-workspace/tab-scoped-share-links.md);
    // the tab delete route drops it at once, this catches every other way a tab goes.
    if (!tab) {
      stmts.push(
        env.DB.prepare('DELETE FROM share_links WHERE document_id = ?1 AND tab_id = ?2').bind(
          documentId,
          tabId,
        ),
      );
    }
  }

  if (byKind('images').length > 0) {
    stmts.push(...imageStatements(env, documentId, await documentImageIds(env, documentId), now));
  }

  if (byKind('summary').length > 0) {
    const { summary, savedAt } = await readContentSummary(env, documentId);
    stmts.push(
      env.DB.prepare(
        'UPDATE documents SET content_summary = ?2, saved_at = MAX(saved_at, ?3) WHERE id = ?1',
      ).bind(documentId, JSON.stringify(summary), savedAt),
    );
  }

  if (stmts.length > 0) await env.DB.batch(stmts);
  await env.DOCUMENT_DB.prepare('DELETE FROM outbox WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(pending.map((r) => r.id)))
    .run();
  return { keys: pending.length, statements: stmts.length, more };
}
