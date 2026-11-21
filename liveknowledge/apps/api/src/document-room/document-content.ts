// The document-level reads and writes of a document's own SQLite (docs/specs/015-api/api.md "Storage"): the tab
// outline a document read carries, the slide deck, the document row a create makes, and a copy's export and
// import. Runs inside the document's Durable Object, on `env.DOCUMENT_DB`.

import {
  applyDeckSlidePatch,
  mergePresentationNoteCards,
  parseKnowledgeSettings,
  parseKnowledgeStyle,
  parseStoredPresentation,
  remapTabLinks,
  settleStoredArticlesData,
  storedKnowledgeSettings,
  storedKnowledgeStyle,
  type DeckSlidePatch,
  type Element,
  type KnowledgeSettings,
  type KnowledgeStyle,
} from '@liveknowledge/document';
import { MAX_DECK_LEN } from '../limits';
import { redactTabDataForCommunity } from '@liveworkspace/community/app';
import { redactTabDataAuthors } from '../comments';
import { tabStatsOfData, tabStatsStatement } from '../db/tab-stats';
import { servableImageIds } from '../db/image-grants';
import { imageRefIdsFromData } from '@liveworkspace/api-kit/image-refs';
import { rowToTabSummary, type TabRow } from '../tab-row';
import { storedTabConnection, tabConnectionStatement } from '@liveworkspace/index-app';
import type { TabConnection } from '@liveworkspace/index-client';
import type { DocumentEnv, TabSummaryDTO } from '../types';
import { KINDS } from '@liveknowledge/document/automations';
import {
  copiedRulesOf,
  landedRuleStatements,
  type CopiedRules,
} from '@liveworkspace/automations/room';

// What the document knows of itself (document-schema.ts): its name, owner, team and provenance. Null until the
// document is started, by a create or by its first open with a grant (initDocument).
export type DocumentMeta = {
  name: string;
  ownerId: string;
  teamId: string | null;
  source: string | null;
  createdAt: number;
  // The knowledgebase's settings (the Review Period), read with the row: every 90 days when none is stored.
  knowledgeSettings: KnowledgeSettings;
  // The Knowledgebase Style, read with the row: the Everyday look in the product's theme when none is stored.
  knowledgeStyle: KnowledgeStyle;
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
  knowledge_settings: string | null;
  knowledge_style: string | null;
};

const DOCUMENT_HEAD_COLS =
  'presentation, saved_at, created_at, name, owner_id, team_id, source, knowledge_settings, knowledge_style';

function metaOf(head: DocumentHeadRow | null): DocumentMeta | null {
  if (!head || !head.created_at) return null;
  return {
    name: head.name,
    ownerId: head.owner_id,
    teamId: head.team_id,
    source: head.source,
    createdAt: head.created_at,
    knowledgeSettings: parseKnowledgeSettings(head.knowledge_settings),
    knowledgeStyle: parseKnowledgeStyle(head.knowledge_style),
  };
}

export async function readDocumentOutline(
  env: DocumentEnv,
  documentId: string,
): Promise<DocumentOutline> {
  const [tabs, document] = await env.DOCUMENT_DB.batch([
    env.DOCUMENT_DB.prepare(
      `SELECT t.id, dt.document_id, t.name, dt.order_index, '' AS data, t.updated_at, dt.folder, t.connection,
              CASE WHEN json_valid(t.data) THEN json_extract(t.data, '$.parent') END AS parent,
              CASE WHEN json_valid(t.data) THEN json_extract(t.data, '$.knowledge') END AS knowledge
         FROM document_tabs dt
         JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.document_id = ?
        ORDER BY dt.order_index ASC`,
    ).bind(documentId),
    env.DOCUMENT_DB.prepare(`SELECT ${DOCUMENT_HEAD_COLS} FROM document WHERE id = ?`).bind(
      documentId,
    ),
  ]);
  const head = (document?.results?.[0] ?? null) as DocumentHeadRow | null;
  return {
    tabs: ((tabs?.results ?? []) as TabRow[]).map(rowToTabSummary),
    presentation: head?.presentation ?? null,
    savedAt: head?.saved_at ?? 0,
    meta: metaOf(head),
  };
}

// The document's tabs alone, in order: id and name, no tab's body read, parsed or sent. For the tab picker's read
// (routes/documents.ts, `GET /api/documents/:id/tabs`). Every tab holds pages, so none has a kind of its own.
export async function readDocumentTabs(
  env: DocumentEnv,
  documentId: string,
): Promise<{ id: string; name: string }[]> {
  const { results } = await env.DOCUMENT_DB.prepare(
    `SELECT t.id, t.name
       FROM document_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.document_id = ?
      ORDER BY dt.order_index ASC`,
  )
    .bind(documentId)
    .all<{ id: string; name: string }>();
  return results ?? [];
}

// What the document knows of itself, alone (no tabs): for the doors that only need its owner or name.
export async function readDocumentMeta(
  env: DocumentEnv,
  documentId: string,
): Promise<DocumentMeta | null> {
  return (await readDocumentHead(env, documentId)).meta;
}

// What the document knows of itself, its last save and its slide deck, in one read: the export door's version
// (liveworkspace/docs/specs/006-media/previews.md), without the tab outline.
export async function readDocumentHead(
  env: DocumentEnv,
  documentId: string,
): Promise<{ meta: DocumentMeta | null; savedAt: number; presentation: string | null }> {
  const head = await env.DOCUMENT_DB.prepare(
    `SELECT ${DOCUMENT_HEAD_COLS} FROM document WHERE id = ?`,
  )
    .bind(documentId)
    .first<DocumentHeadRow>();
  return {
    meta: metaOf(head ?? null),
    savedAt: head?.saved_at ?? 0,
    presentation: head?.presentation ?? null,
  };
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
  // The knowledgebase's settings a create carries (an Offline sync's, a Drive file's). A started document, and a
  // copy that landed with its source's, keeps its own.
  knowledgeSettings?: KnowledgeSettings;
  // The Knowledgebase Style a create carries, on the same terms.
  knowledgeStyle?: KnowledgeStyle;
};

// Start the document (docs/specs/015-api/api.md "Storage"), or on a document already started rename it and move
// its last save.
export async function initDocument(
  env: DocumentEnv,
  documentId: string,
  d: DocumentStart,
): Promise<void> {
  await env.DOCUMENT_DB.prepare(
    `INSERT INTO document (id, presentation, saved_at, created_at, name, owner_id, team_id, source,
                           knowledge_settings, knowledge_style)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     ON CONFLICT (id) DO UPDATE SET
       presentation = COALESCE(document.presentation, excluded.presentation),
       knowledge_settings = COALESCE(document.knowledge_settings, excluded.knowledge_settings),
       knowledge_style = COALESCE(document.knowledge_style, excluded.knowledge_style),
       saved_at = excluded.saved_at,
       -- A copy lands unstarted with the index's title for it (its import): starting it keeps that name.
       name = CASE WHEN document.created_at = 0 AND document.name <> '' THEN document.name ELSE excluded.name END,
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
      d.knowledgeSettings ? storedKnowledgeSettings(d.knowledgeSettings) : null,
      d.knowledgeStyle ? storedKnowledgeStyle(d.knowledgeStyle) : null,
    )
    .run();
}

// The Knowledgebase Style (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style") on a started
// document: one row written, whatever the knowledgebase holds, since every page is drawn with it when shown and
// none stores it. False when the document is not started. It is an edit: the last save moves, so the Drive file
// follows.
export async function setKnowledgeStyle(
  env: DocumentEnv,
  documentId: string,
  style: KnowledgeStyle,
  savedAt: number,
): Promise<boolean> {
  const res = await env.DOCUMENT_DB.prepare(
    'UPDATE document SET knowledge_style = ?, saved_at = ? WHERE id = ? AND created_at > 0',
  )
    .bind(storedKnowledgeStyle(style), savedAt, documentId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

// The knowledgebase's settings (docs/specs/030-knowledgebase/verification.md "The Review Period") on a started
// document: one row written, whatever the knowledgebase holds, since every page's state is worked out when read.
// False when the document is not started. It is an edit: the last save moves, so the Drive file follows.
export async function setKnowledgeSettings(
  env: DocumentEnv,
  documentId: string,
  settings: KnowledgeSettings,
  savedAt: number,
): Promise<boolean> {
  const res = await env.DOCUMENT_DB.prepare(
    'UPDATE document SET knowledge_settings = ?, saved_at = ? WHERE id = ? AND created_at > 0',
  )
    .bind(storedKnowledgeSettings(settings), savedAt, documentId)
    .run();
  if ((res.meta.changes ?? 0) === 0) return false;
  // The next review to wait for moved (knowledge-emails.ts): the room looks again.
  env.REVIEW_PERIOD_CHANGED?.();
  return true;
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

// What a merged deck write did: written, or refused because the merged deck is past the deck cap.
export type DeckWrite = 'written' | 'too_large';

async function readStoredPresentation(env: DocumentEnv, documentId: string) {
  const row = await env.DOCUMENT_DB.prepare('SELECT presentation FROM document WHERE id = ?')
    .bind(documentId)
    .first<{ presentation: string | null }>();
  return parseStoredPresentation(row?.presentation ?? null);
}

// A merge never stores a deck past the cap (speaker-note-cards.md "Two people writing at once"): refused whole, so the
// stored deck keeps the other person's cards and the sender is told.
async function writeMergedPresentation(
  env: DocumentEnv,
  documentId: string,
  merged: string,
): Promise<DeckWrite> {
  if (merged.length > MAX_DECK_LEN) {
    console.warn('[deck] merged deck refused past the cap', { length: merged.length });
    return 'too_large';
  }
  await setDocumentPresentation(env, documentId, merged);
  return 'written';
}

// A deck save that says what it was built on (docs/specs/012-collaboration/speaker-note-cards.md "Two people writing at
// once"): each slide's note cards merged by card id with the stored deck, then written. The read and the write are
// this object's own storage with no other I/O between them, so a second save cannot slip in between and be lost. A
// base that does not parse, or no stored deck, writes the deck as sent.
export async function mergeDocumentPresentation(
  env: DocumentEnv,
  documentId: string,
  presentation: string,
  base: string | null,
): Promise<DeckWrite> {
  const theirs = await readStoredPresentation(env, documentId);
  const mine = parseStoredPresentation(presentation);
  const before = base === null ? null : parseStoredPresentation(base);
  const merged =
    mine && theirs && (base === null || before)
      ? JSON.stringify(mergePresentationNoteCards(mine, before, theirs))
      : presentation;
  return writeMergedPresentation(env, documentId, merged);
}

// The unload save of a large deck (speaker-note-cards.md "Saving"): only the slides the editor changed, each merged
// into the stored deck card by card (applyDeckSlidePatch), the rest of the stored deck left as it is. The same one
// read and one write as a merge, under the same cap.
export async function patchDocumentPresentation(
  env: DocumentEnv,
  documentId: string,
  patch: DeckSlidePatch,
): Promise<DeckWrite> {
  const stored = await readStoredPresentation(env, documentId);
  return writeMergedPresentation(
    env,
    documentId,
    JSON.stringify(applyDeckSlidePatch(stored, patch)),
  );
}

// ---------- Copies --------------------------------------------------------------------------------------------

// A document's content as one Durable Object hands it to another for a copy (docs/specs/015-api/api.md "Copies"):
// tabs under fresh ids (their links re-pointed). The slide deck stays behind, as it always has: a copy starts
// without one. Sent as one RPC message, so a document past the 32 MiB a message may carry cannot be copied this
// way (the follow-up is to stream it in pages).
export type DocumentCopy = {
  // The copy's name, the index's title for it (internal-items.ts); absent from an index that does not send one,
  // and from a Drive file's import, which names the document as it starts it.
  name?: string;
  // The source's settings (its Review Period) when they are not the default; a copy of one tab carries none.
  knowledgeSettings?: KnowledgeSettings;
  // The source's Knowledgebase Style when it is not the default; a copy of one tab carries none.
  knowledgeStyle?: KnowledgeStyle;
  tabs: {
    id: string;
    name: string;
    orderIndex: number;
    folder: string | null;
    data: string;
    elementCount: number;
    // A connected tab's connection, carried as exactly `{ id, app, itemId }` (connected-tabs.md "Copies carry
    // nothing"): the index opens it only in its own host and tab, so in the copy it offers Connect Again.
    connection?: TabConnection | null;
  }[];
  // The images its bodies place that the source may serve (db/image-grants.ts): the copy is granted each, so an
  // image a teammate placed in the source still shows in a copy its new owner makes.
  images: string[];
  // The source's Automations rules (docs/specs/013-workspace/automations.md), for a copy its own people make and a
  // file's import: they land turned off, their tabs at the copy's ids. Absent from a copy made through a share link
  // or a Community post, whose maker never saw the rules.
  automations?: CopiedRules;
};

// Every tab of the document (or one) with its body, in order: the read a copy makes, and the Drive file's
// (document-file.ts).
export type ContentTabRow = {
  id: string;
  name: string;
  order_index: number;
  folder: string | null;
  data: string;
  element_count: number;
  connection: string | null;
};

export async function readContentTabRows(
  env: DocumentEnv,
  documentId: string,
  onlyTabId: string | null,
): Promise<ContentTabRow[]> {
  const tabRows = await env.DOCUMENT_DB.prepare(
    `SELECT t.id, t.name, dt.order_index, dt.folder, t.data, t.element_count, t.connection
       FROM document_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.document_id = ?${onlyTabId === null ? '' : ' AND dt.tab_id = ?'}
      ORDER BY dt.order_index ASC`,
  )
    .bind(...(onlyTabId === null ? [documentId] : [documentId, onlyTabId]))
    .all<ContentTabRow>();
  return tabRows.results ?? [];
}

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
  // The copy carries the document's Automations rules (document-room-doors.ts exportCopy decides).
  withRules = false,
): Promise<DocumentCopy | null> {
  const rows = await readContentTabRows(env, documentId, onlyTabId);
  // Every fresh tab id minted up front, so a tab or element link on one tab can be re-pointed at its sibling's copy.
  const tabIdMap = new Map(rows.map((row) => [row.id, crypto.randomUUID()]));
  const copy: DocumentCopy = {
    images: [],
    tabs: rows.map((row) => {
      // No copy carries a legacy article suggestion (docs/specs/007-editor/suggestions.md "Writing stored with a
      // suggestion"): the copy takes the stored JSON as it is, so it is settled here.
      const remapped = settleStoredArticlesData(remapTabDataLinks(row.data, tabIdMap));
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
        // Not through a Community post's link: a stranger's copy names no other item.
        connection: redactForCommunity ? null : storedTabConnection(row.connection),
      };
    }),
  };
  const placed = copyImageIds(copy);
  if (placed.length > 0) copy.images = [...(await servableImageIds(env, documentId, placed))];
  const rules = withRules && !redactForCommunity ? copiedRulesOf(env, tabIdMap) : null;
  if (rules) copy.automations = rules;
  if (onlyTabId === null) {
    const meta = await readDocumentMeta(env, documentId);
    const settings = meta?.knowledgeSettings;
    if (settings && storedKnowledgeSettings(settings) !== null) copy.knowledgeSettings = settings;
    if (meta && storedKnowledgeStyle(meta.knowledgeStyle) !== null)
      copy.knowledgeStyle = meta.knowledgeStyle;
  }
  return copy;
}

// The source side of a copy for whoever copies (`copiedBy`, as the index names them; null when it does not say):
// anyone but the owner takes the comments as the tab read serves them, other people's authors redacted; through a
// Community post's open link (`community`), without its comments or the people on its actions.
export async function exportDocumentCopyFor(
  env: DocumentEnv,
  documentId: string,
  onlyTabId: string | null,
  copiedBy: string | null,
  community = false,
  withRules = false,
): Promise<DocumentCopy | null> {
  const ownerId =
    copiedBy === null ? null : ((await readDocumentMeta(env, documentId))?.ownerId ?? null);
  const redact = copiedBy !== null && copiedBy !== ownerId ? copiedBy : null;
  return exportDocumentCopy(env, documentId, onlyTabId, redact, community, withRules);
}

// The images a copy's bodies place, for the placement grants the copy carries (db/image-grants.ts).
export function copyImageIds(copy: DocumentCopy): string[] {
  return [...new Set(copy.tabs.flatMap((tab) => imageRefIdsFromData(tab.data)))];
}

// Re-point the tab / element links inside one tab's stored `data` JSON at the copy's tab ids. The data is only
// parsed when it mentions a tab id, so the common link-free tab is copied byte for byte.
export function remapTabDataLinks(data: string, tabIdMap: Map<string, string>): string {
  // A tab or element link, a Tab Window's tab, or the page it sits under: nothing to re-point without one.
  const links = data.includes('"tabId"') || data.includes('"windowTabId"');
  if (!links && !data.includes('"parent"')) return data;
  try {
    const parsed = JSON.parse(data) as { elements?: Element[]; parent?: unknown };
    // The page tree goes with the copy (docs/specs/030-knowledgebase/blueprints/page-tree.md "Storage"): a parent
    // is re-pointed at its copy, and one the copy does not carry (a tab-scoped copy) is dropped, so the page
    // surfaces at the top level.
    const { parent: _was, ...rest } = parsed;
    void _was;
    const parent = typeof parsed.parent === 'string' ? tabIdMap.get(parsed.parent) : undefined;
    const placed = parent === undefined ? rest : { ...rest, parent };
    if (!Array.isArray(parsed.elements)) {
      return 'parent' in parsed ? JSON.stringify(placed) : data;
    }
    if (!links && !('parent' in parsed)) return data;
    return JSON.stringify({ ...placed, elements: remapTabLinks(parsed.elements, tabIdMap) });
  } catch {
    return data;
  }
}

// The target side of a copy: the document's row and every tab the export carried, with its stats and image
// references from the copied body itself, in one transaction, so a copy lands whole or not at all. The
// collaboration index, the listing summary and the media service's references follow from the outbox.
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
        // Its name is the index's title for it, which that start keeps (initDocument).
        `INSERT INTO document (id, saved_at, created_at, name, knowledge_settings, knowledge_style)
         VALUES (?1, ?2, 0, ?3, ?4, ?5)
         ON CONFLICT (id) DO UPDATE SET saved_at = excluded.saved_at,
           knowledge_settings = COALESCE(excluded.knowledge_settings, document.knowledge_settings),
           knowledge_style = COALESCE(excluded.knowledge_style, document.knowledge_style),
           name = CASE WHEN document.created_at = 0 AND excluded.name <> '' THEN excluded.name
                       ELSE document.name END`,
      )
      .bind(
        documentId,
        now,
        copy.name ?? '',
        copy.knowledgeSettings ? storedKnowledgeSettings(copy.knowledgeSettings) : null,
        copy.knowledgeStyle ? storedKnowledgeStyle(copy.knowledgeStyle) : null,
      ),
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
    if (tab.connection) stmts.push(tabConnectionStatement(db, tab.id, tab.connection));
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
  // Its rules, turned off, in the same transaction (@liveworkspace/automations/room rules-file.ts). All off, so
  // nothing is heard or scheduled until someone turns one on.
  stmts.push(...landedRuleStatements(env.DOCUMENT_DB, KINDS, copy.automations, now));
  await db.batch(stmts);
}
