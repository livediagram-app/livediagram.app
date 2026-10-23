// The document-level reads and writes of a document's own SQLite (docs/specs/015-api/api.md "Storage") that the
// documents module used to make against D1: the tab outline a document read carries, the slide deck, the document
// row a create makes, and a copy's export and import. Runs inside the document's Durable Object, on
// `env.DOCUMENT_DB`.

import { remapTabLinks, type Element } from '@livedocuments/document';
import { redactTabDataAuthors } from '../comments';
import { tabStatsOfData, tabStatsStatement } from '../db/tab-stats';
import { servableImageIds } from '../db/image-grants';
import { imageRefIdsFromData } from '../image-refs/extract';
import { rowToTabSummary, type TabRow } from '../tab-row';
import type { DocumentEnv, TabSummaryDTO } from '../types';

// What the document knows of itself (document-schema.ts): its name, owner, team and provenance. Null until the
// document is started, by a create or by its first open with a grant (initDocument).
export type DocumentMeta = {
  name: string;
  ownerId: string;
  teamId: string | null;
  source: string | null;
  createdAt: number;
  thumbRenderedAt: number | null;
};

// What a document read takes from the document: its tabs in order (no body), its slide deck, and what it knows of
// itself.
export type DocumentOutline = {
  tabs: TabSummaryDTO[];
  presentation: string | null;
  // The document's last save.
  savedAt: number;
  meta: DocumentMeta | null;
};

type DocumentHeadRow = {
  presentation: string | null;
  saved_at: number;
  created_at: number;
  name: string;
  owner_id: string;
  team_id: string | null;
  source: string | null;
  thumb_rendered_at: number | null;
};

const DOCUMENT_HEAD_COLS =
  'presentation, saved_at, created_at, name, owner_id, team_id, source, thumb_rendered_at';

function metaOf(head: DocumentHeadRow | null): DocumentMeta | null {
  if (!head || !head.created_at) return null;
  return {
    name: head.name,
    ownerId: head.owner_id,
    teamId: head.team_id,
    source: head.source,
    createdAt: head.created_at,
    thumbRenderedAt: head.thumb_rendered_at,
  };
}

export async function readDocumentOutline(
  env: DocumentEnv,
  documentId: string,
): Promise<DocumentOutline> {
  const [tabs, document] = await env.DOCUMENT_DB.batch([
    env.DOCUMENT_DB.prepare(
      `SELECT t.id, dt.document_id, t.name, dt.order_index, '' AS data, t.updated_at, dt.folder
         FROM document_tabs dt
         JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.document_id = ?
        ORDER BY dt.order_index ASC`,
    ).bind(documentId),
    env.DOCUMENT_DB.prepare(`SELECT ${DOCUMENT_HEAD_COLS} FROM document WHERE id = ?`).bind(documentId),
  ]);
  const head = (document?.results?.[0] ?? null) as DocumentHeadRow | null;
  return {
    tabs: ((tabs?.results ?? []) as TabRow[]).map(rowToTabSummary),
    presentation: head?.presentation ?? null,
    savedAt: head?.saved_at ?? 0,
    meta: metaOf(head),
  };
}

// What the document knows of itself, alone (no tabs): for the doors that only need its owner or name.
export async function readDocumentMeta(
  env: DocumentEnv,
  documentId: string,
): Promise<DocumentMeta | null> {
  const head = await env.DOCUMENT_DB.prepare(
    `SELECT ${DOCUMENT_HEAD_COLS} FROM document WHERE id = ?`,
  )
    .bind(documentId)
    .first<DocumentHeadRow>();
  return metaOf(head ?? null);
}

// What a create or a first open writes about the document. A started document keeps its owner, team and
// provenance; only its name and last save move after.
export type DocumentStart = {
  name: string;
  ownerId: string;
  teamId: string | null;
  source: string | null;
  savedAt: number;
  createdAt: number;
  // The slide deck a create carries (an Offline Mode sync's, docs/specs/006-document/offline-mode.md). A started
  // document keeps its deck.
  presentation?: string | null;
};

// Start the document (docs/specs/015-api/api.md "Storage"), or on a document already started rename it and move
// its last save.
export async function initDocument(
  env: DocumentEnv,
  documentId: string,
  d: DocumentStart,
): Promise<void> {
  await env.DOCUMENT_DB.prepare(
    `INSERT INTO document (id, presentation, saved_at, created_at, name, owner_id, team_id, source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT (id) DO UPDATE SET
       presentation = COALESCE(document.presentation, excluded.presentation),
       saved_at = excluded.saved_at,
       name = excluded.name,
       created_at = CASE WHEN document.created_at = 0 THEN excluded.created_at ELSE document.created_at END,
       owner_id = CASE WHEN document.created_at = 0 THEN excluded.owner_id ELSE document.owner_id END,
       team_id = CASE WHEN document.created_at = 0 THEN excluded.team_id ELSE document.team_id END,
       source = CASE WHEN document.created_at = 0 THEN excluded.source ELSE document.source END`,
  )
    .bind(
      documentId,
      d.presentation ?? null,
      d.savedAt,
      d.createdAt,
      d.name,
      d.ownerId,
      d.teamId,
      d.source,
    )
    .run();
}

// A rename (and its save time) on a started document; false when the document is not started.
export async function renameDocument(
  env: DocumentEnv,
  documentId: string,
  name: string,
  savedAt: number,
): Promise<boolean> {
  const res = await env.DOCUMENT_DB.prepare(
    'UPDATE document SET name = ?, saved_at = ? WHERE id = ? AND created_at > 0',
  )
    .bind(name, savedAt, documentId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

// The snapshot cache's freshness stamp (thumbnail.ts).
export async function markThumbRendered(
  env: DocumentEnv,
  documentId: string,
  now: number,
): Promise<void> {
  await env.DOCUMENT_DB.prepare('UPDATE document SET thumb_rendered_at = ? WHERE id = ?')
    .bind(now, documentId)
    .run();
}

// docs/specs/014-identity/transactional-email.md (#1) throttle: claim the right to email the owner about a new
// comment, at most once per window. One conditional UPDATE, so a burst of comment saves can't each fire one.
export async function claimCommentNotify(
  env: DocumentEnv,
  documentId: string,
  now: number,
  cutoff: number,
): Promise<boolean> {
  const res = await env.DOCUMENT_DB.prepare(
    'UPDATE document SET comment_notified_at = ? WHERE id = ? AND (comment_notified_at IS NULL OR comment_notified_at < ?)',
  )
    .bind(now, documentId, cutoff)
    .run();
  return res.meta.changes === 1;
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
    elementCount: number;
  }[];
  // The images its bodies place that the source may serve (db/image-grants.ts): the copy is granted each, so an
  // image a teammate placed in the source still shows in a copy its new owner makes.
  images: string[];
};

// The source side of a copy. `onlyTabId`: a tab-scoped visitor's copy takes that tab only.
// `redactAuthorsFor`: anyone but the owner copies the comments as the tab read serves them to them.
export async function exportDocumentCopy(
  env: DocumentEnv,
  documentId: string,
  onlyTabId: string | null,
  redactAuthorsFor: string | null,
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
      element_count: number;
    }>();
  const rows = tabRows.results ?? [];
  // Every fresh tab id minted up front, so a tab or element link on one tab can be re-pointed at its sibling's copy.
  const tabIdMap = new Map(rows.map((row) => [row.id, crypto.randomUUID()]));
  const copy: DocumentCopy = {
    images: [],
    tabs: rows.map((row) => {
      const remapped = remapTabDataLinks(row.data, tabIdMap);
      return {
        id: tabIdMap.get(row.id)!,
        name: row.name,
        orderIndex: row.order_index,
        folder: row.folder,
        data:
          redactAuthorsFor !== null ? redactTabDataAuthors(remapped, redactAuthorsFor) : remapped,
        // Link remapping rewrites ids inside elements, never their number, so the count carries over.
        elementCount: row.element_count,
      };
    }),
  };
  const placed = copyImageIds(copy);
  if (placed.length > 0) copy.images = [...(await servableImageIds(env, documentId, placed))];
  return copy;
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
        // created_at stays 0: the copy's first open with a grant starts it, as its new owner (initDocument).
        `INSERT INTO document (id, saved_at, created_at) VALUES (?1, ?2, 0)
         ON CONFLICT (id) DO UPDATE SET saved_at = excluded.saved_at`,
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
  // The placement grants the copy carries: only images its own bodies place.
  const placed = new Set(copyImageIds(copy));
  const granted = (copy.images ?? []).filter((id) => placed.has(id));
  if (granted.length > 0) {
    stmts.push(
      db
        .prepare(
          'INSERT OR IGNORE INTO image_grants (image_id, created_at) SELECT value, ? FROM json_each(?)',
        )
        .bind(now, JSON.stringify(granted)),
    );
  }
  await db.batch(stmts);
}
