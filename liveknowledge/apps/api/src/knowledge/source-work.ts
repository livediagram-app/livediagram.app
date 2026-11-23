// What a knowledgebase's alarm does for its sources (docs/specs/030-knowledgebase/search-and-ask.md "Sources";
// blueprint knowledge-sources.md "The room"), off every request's path (the `source` work, knowledge-work.ts):
//
//   - key `~sync`: the set of sources now. The index lists the knowledgebase's connected items and, with a team
//     folder chosen, the items in it; each new one (or one changed since its last read) is owed a read, each gone
//     one is dropped. Owed after a connected tab comes or goes, after Sources changes, and again each day.
//   - key `<item id>`: one source read through the index (the app's text door), its chunks replacing the old ones.
//     Owed when the source joins and when the index says it changed (gathered a minute). A 404 drops it.
//
// Nothing here runs on a request. Each read is one index call and one transaction of at most 200 chunks.
import {
  createKnowledgeSourcesClient,
  isKnowledgeSourceApp,
  type KnowledgeSourceChange,
  type KnowledgeSourcesClient,
} from '@liveworkspace/index-client';
import {
  SOURCE_CHUNKS_MAX,
  SOURCE_MAX_TRIES,
  SOURCE_REFRESH_SETTLE_MS,
  SOURCE_RETRY_MS,
  SOURCE_SYNC_EVERY_MS,
  SOURCES_MAX,
  clearSourceIndex,
  deleteSourceIndex,
  replaceSourceIndex,
  type SqlStatement,
} from '@liveknowledge/knowledge';
import type { ItemSql } from '@liveworkspace/index-app';
import { indexService } from '../index-service';
import type { DocumentEnv } from '../types';
import { rowsOf, runAll, sqlOf } from './knowledge-db';
import { oweWork, type Work } from './knowledge-work';
import { readSourceSettings } from './source-settings';

/** The work key of the set's look; every other key is a source's item id. */
export const SOURCE_SYNC_KEY = '~sync';
/** How soon a connected tab's coming or going is looked at: a few seconds, so a burst of tab writes is one look. */
export const SOURCE_SYNC_SOON_MS = 5_000;

type Client = Pick<KnowledgeSourcesClient, 'sources' | 'text'>;

let clientForTests: Client | null = null;
/** Tests hand in a stand-in for the index. */
export const setKnowledgeSourcesClientForTests = (client: Client | null) => {
  clientForTests = client;
};

/** The index as this knowledgebase reaches it for its sources, or null on a deployment with none (self-hosted
 *  without the index): then a knowledgebase has its pages alone. */
export function sourcesClientOf(env: DocumentEnv): KnowledgeSourcesClient | null {
  if (clientForTests) return clientForTests as KnowledgeSourcesClient;
  const options = indexService.appOptions(env);
  return options ? createKnowledgeSourcesClient(options) : null;
}

type SourceRow = { itemId: string; updatedAt: number; state: string; chunks: number };

/** Owe the set's look, or one source's read, at `dueAt` (the earliest asked stands). */
export function oweSourceWork(sql: ItemSql, key: string, dueAt: number): void {
  oweWork(sql, { kind: 'source', key, dueAt, payload: '' });
}

/** The index's signal (knowledge-sources.md "Keeping in step"): a source gone is dropped now; one changed is read
 *  again after the settle; an item the knowledgebase does not read yet sends it to look at its set. Answers when the
 *  alarm should next wake, or null when nothing was owed. */
export function takeSourceChange(
  sql: ItemSql,
  change: KnowledgeSourceChange,
  now: number,
): number | null {
  const known = sql
    .exec('SELECT 1 AS known FROM source_items WHERE item_id = ?', change.itemId)
    .toArray().length;
  if (change.gone) {
    if (!known) return null;
    for (const s of deleteSourceIndex(change.itemId)) sql.exec(s.sql, ...s.params);
    sql.exec("DELETE FROM knowledge_work WHERE kind = 'source' AND key = ?", change.itemId);
    return null;
  }
  const dueAt = now + (known ? SOURCE_REFRESH_SETTLE_MS : SOURCE_SYNC_SOON_MS);
  oweSourceWork(sql, known ? change.itemId : SOURCE_SYNC_KEY, dueAt);
  return dueAt;
}

/** The alarm's turn for one piece of source work; answers when it is owed again (null: done). */
export async function runSourceWork(
  env: DocumentEnv,
  sql: ItemSql,
  documentId: string,
  work: Work,
  now: number,
): Promise<number | null> {
  const client = sourcesClientOf(env);
  if (!client) return null;
  return work.key === SOURCE_SYNC_KEY
    ? syncSources(env, sql, client, documentId, now)
    : readSource(env, client, documentId, work.key, now);
}

// The set now: new sources are owed a read, changed ones too, gone ones dropped; past SOURCES_MAX they are listed as
// capped and not read. Owed again a day on while any source is kept.
async function syncSources(
  env: DocumentEnv,
  sql: ItemSql,
  client: Client,
  documentId: string,
  now: number,
): Promise<number | null> {
  const settings = await readSourceSettings(env);
  const listed =
    settings.connected || settings.folderId
      ? (await client.sources(documentId, settings.folderId)).filter(
          (s) => isKnowledgeSourceApp(s.app) && (settings.connected || s.origin === 'folder'),
        )
      : [];
  const kept = await rowsOf<SourceRow>(
    env,
    sqlOf(`SELECT item_id AS itemId, updated_at AS updatedAt, state, chunks FROM source_items`),
  );
  const keptById = new Map(kept.map((row) => [row.itemId, row]));
  const listedIds = new Set(listed.map((s) => s.itemId));
  const statements: SqlStatement[] = [];
  for (const row of kept)
    if (!listedIds.has(row.itemId)) statements.push(...deleteSourceIndex(row.itemId));
  const owed: string[] = [];
  listed.forEach((source, at) => {
    const was = keptById.get(source.itemId);
    const capped = at >= SOURCES_MAX;
    if (!was) {
      statements.push(
        sqlOf(
          `INSERT INTO source_items (item_id, app, title, origin, state, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
          source.itemId,
          source.app,
          source.title,
          source.origin,
          capped ? 'capped' : 'waiting',
          source.updatedAt,
        ),
      );
      if (!capped) owed.push(source.itemId);
      return;
    }
    statements.push(
      sqlOf(
        'UPDATE source_items SET title = ?, origin = ?, updated_at = ? WHERE item_id = ?',
        source.title,
        source.origin,
        source.updatedAt,
        source.itemId,
      ),
    );
    if (capped) {
      if (was.state !== 'capped') statements.push(...clearSourceIndex(source.itemId, 'capped'));
      return;
    }
    // Changed since its last read (a signal missed), never read, or capped before and now within the cap.
    if (source.updatedAt > was.updatedAt || was.state !== 'read') owed.push(source.itemId);
  });
  await runAll(env, statements);
  for (const itemId of owed) oweSourceWork(sql, itemId, now);
  console.info('[knowledge] sources synced', {
    documentId,
    listed: listed.length,
    owed: owed.length,
  });
  return listed.length > 0 ? now + SOURCE_SYNC_EVERY_MS : null;
}

// One source read through the index: its chunks replace the old ones, unless the knowledgebase's chunk cap would be
// passed (then it is listed as capped). A source the index no longer counts (404) is dropped; one whose app did not
// answer is tried again later, SOURCE_MAX_TRIES times.
async function readSource(
  env: DocumentEnv,
  client: Client,
  documentId: string,
  itemId: string,
  now: number,
): Promise<number | null> {
  const row = (
    await rowsOf<{ chunks: number; tries: number }>(
      env,
      sqlOf('SELECT chunks, tries FROM source_items WHERE item_id = ?', itemId),
    )
  )[0];
  // Dropped since it was owed.
  if (!row) return null;
  const settings = await readSourceSettings(env);
  let text;
  try {
    text = await client.text(documentId, itemId, settings.folderId);
  } catch (error) {
    const tries = row.tries + 1;
    console.warn('[knowledge] source read failed', { documentId, tries, error: String(error) });
    await runAll(env, [
      sqlOf(
        `UPDATE source_items SET tries = ?, state = CASE WHEN ? >= ? THEN 'failed' ELSE state END WHERE item_id = ?`,
        tries,
        tries,
        SOURCE_MAX_TRIES,
        itemId,
      ),
    ]);
    return tries >= SOURCE_MAX_TRIES ? null : now + SOURCE_RETRY_MS;
  }
  if (!text) {
    await runAll(env, deleteSourceIndex(itemId));
    console.info('[knowledge] source dropped', { documentId });
    return null;
  }
  const others =
    (
      await rowsOf<{ n: number }>(
        env,
        sqlOf('SELECT COALESCE(SUM(chunks), 0) AS n FROM source_items WHERE item_id <> ?', itemId),
      )
    )[0]?.n ?? 0;
  if (others + text.chunks.length > SOURCE_CHUNKS_MAX) {
    await runAll(env, clearSourceIndex(itemId, 'capped'));
    console.info('[knowledge] source capped', { documentId, chunks: text.chunks.length });
    return null;
  }
  await runAll(
    env,
    replaceSourceIndex({
      itemId,
      title: text.name,
      version: text.version,
      readAt: now,
      chunks: text.chunks.map((chunk) => ({
        ref: chunk.ref,
        title: chunk.title,
        text: chunk.text,
        place: JSON.stringify(chunk.place),
      })),
    }),
  );
  console.info('[knowledge] source read', { documentId, chunks: text.chunks.length });
  return null;
}
