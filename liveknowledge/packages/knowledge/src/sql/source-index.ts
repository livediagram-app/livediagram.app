// A knowledgebase's sources in other apps (docs/specs/030-knowledgebase/search-and-ask.md "Sources",
// liveworkspace/docs/specs/004-index/knowledge-sources.md): the items it reads, their chunks and the words of those
// chunks in a search index of their own, beside the pages' and with the same tokenizer. A source's rows are
// replaced together, in one transaction, so a search never sees half a source.
import { SEARCH_TOKENIZER } from './schema';
import { ftsExpression } from './search';
import { insertRows, type SqlStatement, type SqlValue } from './statement';

/** Sources a knowledgebase reads at most, and chunks it keeps across them; a source past either is not read. */
export const SOURCES_MAX = 100;
export const SOURCE_CHUNKS_MAX = 6_000;
/** A source read longer ago than this is said to be old ("As of 12 Nov", in amber). */
export const SOURCE_STALE_DAYS = 7;
/** How long a source's change is gathered before it is read again, and the daily look at the set. */
export const SOURCE_REFRESH_SETTLE_MS = 60_000;
export const SOURCE_SYNC_EVERY_MS = 86_400_000;
/** A source whose read failed is tried again after this, at most SOURCE_MAX_TRIES times before the next change. */
export const SOURCE_RETRY_MS = 15 * 60_000;
export const SOURCE_MAX_TRIES = 3;

export type SourceState = 'read' | 'waiting' | 'capped' | 'failed';

export const SOURCE_SCHEMA: readonly string[] = [
  // One row a source: its app, its name as last read, how the knowledgebase came to read it, and how far it is read.
  // `updated_at` is the item's last change as the index listed it; `version` the save its chunks were read from.
  `CREATE TABLE IF NOT EXISTS source_items (
    item_id TEXT PRIMARY KEY,
    app TEXT NOT NULL,
    title TEXT NOT NULL,
    origin TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'waiting',
    chunks INTEGER NOT NULL DEFAULT 0,
    chars INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    version INTEGER NULL,
    read_at INTEGER NULL,
    tries INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS source_passages (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    place TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS source_passages_item ON source_passages (item_id, ordinal)`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS source_passages_fts USING fts5(
    title, text, content='source_passages', content_rowid='rowid', tokenize='${SEARCH_TOKENIZER}'
  )`,
  // An Unanswered question's likely item (insights.md "Likely answered elsewhere"): one a question.
  `CREATE TABLE IF NOT EXISTS question_likely (
    key TEXT PRIMARY KEY,
    app TEXT NOT NULL,
    item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    found_at INTEGER NOT NULL
  )`,
];

/** One chunk as the room keeps it. `place` is the door's place as JSON. */
export type SourceChunkRow = { ref: string; title: string; text: string; place: string };

const forgetSourceWords = (itemId: string): SqlStatement => ({
  sql: `INSERT INTO source_passages_fts (source_passages_fts, rowid, title, text)
    SELECT 'delete', rowid, title, text FROM source_passages WHERE item_id = ?`,
  params: [itemId],
});

/** Replaces a source's chunks and marks it read. Run in order, in one transaction. */
export function replaceSourceIndex(source: {
  itemId: string;
  title: string;
  version: number;
  readAt: number;
  chunks: readonly SourceChunkRow[];
}): SqlStatement[] {
  const { itemId } = source;
  let chars = 0;
  const rows: SqlValue[][] = source.chunks.map((chunk, ordinal) => {
    chars += chunk.text.length;
    return [`${itemId}:${chunk.ref}`, itemId, ordinal, chunk.title, chunk.text, chunk.place];
  });
  return [
    forgetSourceWords(itemId),
    { sql: 'DELETE FROM source_passages WHERE item_id = ?', params: [itemId] },
    ...insertRows(
      'INSERT OR REPLACE INTO',
      'source_passages',
      ['id', 'item_id', 'ordinal', 'title', 'text', 'place'],
      rows,
    ),
    {
      sql: `INSERT INTO source_passages_fts (rowid, title, text)
        SELECT rowid, title, text FROM source_passages WHERE item_id = ?`,
      params: [itemId],
    },
    {
      sql: `UPDATE source_items SET state = 'read', title = ?, chunks = ?, chars = ?, version = ?, read_at = ?, tries = 0
        WHERE item_id = ?`,
      params: [source.title, rows.length, chars, source.version, source.readAt, itemId],
    },
  ];
}

/** Drops a source's chunks and its row: its tab removed, out of the folder, in the Trash, or no longer a source. */
export function deleteSourceIndex(itemId: string): SqlStatement[] {
  return [
    forgetSourceWords(itemId),
    { sql: 'DELETE FROM source_passages WHERE item_id = ?', params: [itemId] },
    { sql: 'DELETE FROM source_items WHERE item_id = ?', params: [itemId] },
  ];
}

/** Drops a source's chunks but keeps its row, in `state` (a source past the cap, or one that failed for good). */
export function clearSourceIndex(itemId: string, state: SourceState): SqlStatement[] {
  return [
    forgetSourceWords(itemId),
    { sql: 'DELETE FROM source_passages WHERE item_id = ?', params: [itemId] },
    {
      sql: 'UPDATE source_items SET state = ?, chunks = 0, chars = 0 WHERE item_id = ?',
      params: [state, itemId],
    },
  ];
}

/** A source chunk as search finds it. */
export type SourceSearchRow = {
  id: string;
  itemId: string;
  app: string;
  itemName: string;
  title: string;
  text: string;
  place: string;
  readAt: number | null;
  snippet: string;
  rank: number;
};

/** The search over the source chunks for words already made safe: the best `limit` by bm25, a title match weighing
 *  more, only of sources read. Undefined when there are no words. */
export function searchSourceChunks(
  terms: readonly string[],
  options: { mode: 'all' | 'any'; limit: number },
): SqlStatement | undefined {
  const match = ftsExpression(terms, options.mode);
  if (!match) return undefined;
  return {
    sql: `SELECT p.id AS id, p.item_id AS itemId, s.app AS app, s.title AS itemName, p.title AS title,
        p.text AS text, p.place AS place, s.read_at AS readAt,
        snippet(source_passages_fts, 1, char(2), char(3), '…', 24) AS snippet,
        bm25(source_passages_fts, 4.0, 1.0) AS rank
      FROM source_passages_fts
      JOIN source_passages p ON p.rowid = source_passages_fts.rowid
      JOIN source_items s ON s.item_id = p.item_id AND s.state = 'read'
      WHERE source_passages_fts MATCH ?
      ORDER BY rank, p.item_id, p.ordinal
      LIMIT ?`,
    params: [match, Math.max(1, Math.floor(options.limit))],
  };
}

/** Unanswered questions keep at most this many likely items (the newest). */
export const QUESTION_LIKELY_KEPT = 500;

/** Keeps the likely item an unanswered question's words matched (insights.md "Likely answered elsewhere"), replacing
 *  the one before, and trims the table to QUESTION_LIKELY_KEPT. */
export function putQuestionLikely(
  key: string,
  item: { app: string; itemId: string; title: string },
  now: number,
): SqlStatement[] {
  return [
    {
      sql: `INSERT OR REPLACE INTO question_likely (key, app, item_id, title, found_at) VALUES (?, ?, ?, ?, ?)`,
      params: [key, item.app, item.itemId, item.title, now],
    },
    {
      sql: `DELETE FROM question_likely WHERE key NOT IN (
        SELECT key FROM question_likely ORDER BY found_at DESC, key LIMIT ?
      )`,
      params: [QUESTION_LIKELY_KEPT],
    },
  ];
}

export type QuestionLikelyRow = { key: string; app: string; itemId: string; title: string };

/** The likely items kept for these questions, leaving out any that became a source since. */
export function readQuestionLikely(keys: readonly string[]): SqlStatement | undefined {
  if (keys.length === 0) return undefined;
  return {
    sql: `SELECT key, app, item_id AS itemId, title FROM question_likely
      WHERE key IN (${keys.map(() => '?').join(', ')})
        AND item_id NOT IN (SELECT item_id FROM source_items)`,
    params: [...keys],
  };
}

/** The ids of every source kept: what a likely look leaves out. */
export const sourceIds = (): SqlStatement => ({
  sql: 'SELECT item_id AS itemId FROM source_items',
  params: [],
});
