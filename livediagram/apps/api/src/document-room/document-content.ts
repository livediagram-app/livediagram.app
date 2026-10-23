// The document-level reads and writes of a document's own SQLite (docs/specs/015-api/api.md "Storage") that the
// documents module used to make against D1: the tab outline a document read carries, the slide deck, the document
// row a create makes, and a copy's export and import. Runs inside the document's Durable Object, on
// `env.DOCUMENT_DB`.

import { remapTabLinks, type Element } from '@livediagram/document';
import { redactTabDataAuthors } from '../comments';
import { redactTabDataForCommunity } from '../community-redact';
import { tabStatsOfData, tabStatsStatement } from '../db/tab-stats';
import { imageRefIdsFromData } from '../image-refs/extract';
import { rowToTabSummary, type TabRow } from '../tab-row';
import type { DocumentEnv, TabSummaryDTO } from '../types';

// What a document read takes from the document: its tabs in order (no body) and its slide deck.
export type DocumentOutline = {
  tabs: TabSummaryDTO[];
  presentation: string | null;
  // The document's last save, ahead of D1's copy until the outbox pushes it.
  savedAt: number;
};

export async function readDocumentOutline(
  env: DocumentEnv,
  documentId: string,
): Promise<DocumentOutline> {
  const [tabs, doc] = await env.DOCUMENT_DB.batch([
    env.DOCUMENT_DB.prepare(
      `SELECT t.id, dt.document_id, t.name, dt.order_index, '' AS data, t.updated_at, dt.folder
         FROM document_tabs dt
         JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.document_id = ?
        ORDER BY dt.order_index ASC`,
    ).bind(documentId),
    env.DOCUMENT_DB.prepare('SELECT presentation, saved_at FROM document WHERE id = ?').bind(
      documentId,
    ),
  ]);
  const head = (doc?.results?.[0] ?? null) as {
    presentation: string | null;
    saved_at: number;
  } | null;
  return {
    tabs: ((tabs?.results ?? []) as TabRow[]).map(rowToTabSummary),
    presentation: head?.presentation ?? null,
    savedAt: head?.saved_at ?? 0,
  };
}

// The document's row, made with the document: its dates and, on a genuine create, the slide deck the create
// carries (an Offline Mode sync's, docs/specs/006-document/offline-mode.md). A re-commit of an existing document
// keeps its deck.
export async function initDocument(
  env: DocumentEnv,
  documentId: string,
  d: { savedAt: number; createdAt: number; presentation?: string | null },
): Promise<void> {
  await env.DOCUMENT_DB.prepare(
    `INSERT INTO document (id, presentation, saved_at, created_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (id) DO UPDATE SET
       presentation = COALESCE(document.presentation, excluded.presentation),
       saved_at = excluded.saved_at,
       created_at = CASE WHEN document.created_at = 0 THEN excluded.created_at ELSE document.created_at END`,
  )
    .bind(documentId, d.presentation ?? null, d.savedAt, d.createdAt)
    .run();
}

// Slide deck write (docs/specs/012-collaboration/presentation-mode.md). Its OWN statement rather than a field on the
// meta save, for the same reason folder / team placement has one: the meta save runs on every rename and autosave,
// and a deck must never be rewritten by a caller that was not thinking about the deck. Passing null clears it,
// which is what the client sends when the last slide is deleted.
export async function setDocumentPresentation(
  env: DocumentEnv,
  documentId: string,
  presentation: string | null,
): Promise<void> {
  await env.DOCUMENT_DB.prepare('UPDATE document SET presentation = ?, saved_at = ? WHERE id = ?')
    .bind(presentation, Date.now(), documentId)
    .run();
}

// ---------- Copies --------------------------------------------------------------------------------------------

// A document's content as one Durable Object hands it to another for a copy (docs/specs/015-api/api.md "Copies"):
// tabs under fresh ids (their links re-pointed). The slide deck stays behind, as it always has: a copy starts
// without one. Sent as one RPC message, so a document past the 32 MiB a message may carry cannot be copied this
// way (the follow-up is to stream it in pages).
export type DocumentCopy = {
  tabs: {
    id: string;
    name: string;
    orderIndex: number;
    folder: string | null;
    data: string;
    elementCount: number | null;
  }[];
};

// The source side of a copy. `onlyTabId`: a tab-scoped visitor's copy takes that tab only.
// `redactAuthorsFor`: anyone but the owner copies the comments as the tab read serves them to them.
// `redactForCommunity`: a copy through a Community post's link (docs/specs/025-community/community.md) carries the
// document without its comments or the people on its actions.
export async function exportDocumentCopy(
  env: DocumentEnv,
  documentId: string,
  onlyTabId: string | null,
  redactAuthorsFor: string | null,
  redactForCommunity = false,
): Promise<DocumentCopy | null> {
  const tabRows = await env.DOCUMENT_DB.prepare(
    `SELECT t.id, t.name, dt.order_index, dt.folder, t.data, t.element_count
       FROM document_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.document_id = ?${onlyTabId === null ? '' : ' AND dt.tab_id = ?'}
      ORDER BY dt.order_index ASC`,
  )
    .bind(...(onlyTabId === null ? [documentId] : [documentId, onlyTabId]))
    .all<{
      id: string;
      name: string;
      order_index: number;
      folder: string | null;
      data: string;
      element_count: number | null;
    }>();
  const rows = tabRows.results ?? [];
  // Every fresh tab id minted up front, so a tab or element link on one tab can be re-pointed at its sibling's copy.
  const tabIdMap = new Map(rows.map((row) => [row.id, crypto.randomUUID()]));
  return {
    tabs: rows.map((row) => {
      const remapped = remapTabDataLinks(row.data, tabIdMap);
      return {
        id: tabIdMap.get(row.id)!,
        name: row.name,
        orderIndex: row.order_index,
        folder: row.folder,
        data: redactForCommunity
          ? redactTabDataForCommunity(remapped).data
          : redactAuthorsFor !== null
            ? redactTabDataAuthors(remapped, redactAuthorsFor)
            : remapped,
        // Link remapping rewrites ids inside elements, never their number, so the count carries over.
        elementCount: row.element_count,
      };
    }),
  };
}

// The images a copy's bodies place, for the placement grants the copy carries (db/image-grants.ts).
export function copyImageIds(copy: DocumentCopy): string[] {
  return [...new Set(copy.tabs.flatMap((tab) => imageRefIdsFromData(tab.data)))];
}

// Re-point the tab / element links inside one tab's stored `data` JSON at the copy's tab ids. The data is only
// parsed when it mentions a tab id, so the common link-free tab is copied byte for byte.
export function remapTabDataLinks(data: string, tabIdMap: Map<string, string>): string {
  // A tab or element link, or a Tab Window's tab: nothing to re-point without one.
  if (!data.includes('"tabId"') && !data.includes('"windowTabId"')) return data;
  try {
    const parsed = JSON.parse(data) as { elements?: Element[] };
    if (!Array.isArray(parsed.elements)) return data;
    return JSON.stringify({ ...parsed, elements: remapTabLinks(parsed.elements, tabIdMap) });
  } catch {
    return data;
  }
}

// The target side of a copy: the document's row and every tab the export carried, with its stats and image
// references from the copied body itself, in one transaction, so a copy lands whole or not at all. The
// collaboration index, the listing summary and D1's document_images follow from the outbox.
export async function importDocumentCopy(
  env: DocumentEnv,
  documentId: string,
  copy: DocumentCopy,
  now = Date.now(),
): Promise<void> {
  const db = env.DOCUMENT_DB;
  // A copy makes a new document: one that already holds content keeps it, and nothing is written. Read and write
  // run back to back in the document's own object, so nothing lands between them.
  const held = await db
    .prepare('SELECT EXISTS (SELECT 1 FROM document_tabs WHERE document_id = ?1) AS held')
    .bind(documentId)
    .first<{ held: number }>();
  if (held?.held) throw new Error('document_not_empty');
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO document (id, saved_at, created_at) VALUES (?1, ?2, ?2)
         ON CONFLICT (id) DO UPDATE SET saved_at = excluded.saved_at,
           created_at = CASE WHEN document.created_at = 0 THEN excluded.created_at ELSE document.created_at END`,
      )
      .bind(documentId, now),
  ];
  for (const tab of copy.tabs) {
    const images = imageRefIdsFromData(tab.data);
    stmts.push(
      db
        .prepare(
          'INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES (?, ?, ?, ?, ?, 1)',
        )
        .bind(tab.id, tab.name, tab.data, now, tab.elementCount),
      db
        .prepare(
          'INSERT INTO document_tabs (document_id, tab_id, order_index, added_at, folder) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(documentId, tab.id, tab.orderIndex, now, tab.folder),
      // From the copied body itself (docs/specs/013-workspace/explorer-details-view.md).
      tabStatsStatement(env, tab.id, tabStatsOfData(tab.data).stats, now),
    );
    // Image references from the copied body itself, so a copy is indexed even if its source never was.
    if (images.length > 0) {
      stmts.push(
        db
          .prepare(
            'INSERT OR IGNORE INTO image_refs (tab_id, image_id) SELECT ?1, value FROM json_each(?2)',
          )
          .bind(tab.id, JSON.stringify(images)),
      );
    }
  }
  await db.batch(stmts);
}
