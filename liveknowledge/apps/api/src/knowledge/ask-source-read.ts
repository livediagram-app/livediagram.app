// The sources a question may answer from (docs/specs/030-knowledgebase/search-and-ask.md "Sources", "Answering"):
// the source chunks its words find, kept to the items the asker can open themselves, checked at the index once per
// question. Never the owner's access, never a connected tab's pass. A guest, a visitor through a share link, a tab's
// link or a Community post's reader, and a question under a label scope get pages alone.
import type {
  AskSourceItem,
  KnowledgeLikelySource,
  KnowledgeSourceHit,
} from '@liveknowledge/api-schema';
import {
  askSourceSearch,
  contentWords,
  foundSourcePassage,
  putQuestionLikely,
  readQuestionLikely,
  sourceIds,
  sourceSearch,
  type FoundPassage,
  type QuestionLikelyRow,
  type SourceSearchRow,
  type SqlStatement,
} from '@liveknowledge/knowledge';
import {
  KNOWLEDGE_LIKELY_WORDS_MAX,
  KNOWLEDGE_SOURCES_MAX,
  isKnowledgeSourceApp,
} from '@liveworkspace/index-client';
import type { DocumentAccess, RouteContext } from '../routes/context';
import type { KnowledgeRoute } from '../routes/knowledge-routes';
import { accountOf } from './knowledge-caller';
import { rowsOf } from './knowledge-db';
import { readSourceSettings } from './source-settings';
import { sourcesClientOf } from './source-work';

/** Whether this caller may be answered from sources at all: an account of its own, on a grant of its own. */
export function mayReadSources(
  ctx: Pick<RouteContext, 'accountUserId' | 'verifiedUserId' | 'token'>,
  grant: Pick<DocumentAccess, 'shareCode' | 'tabScope' | 'community'>,
): boolean {
  return Boolean(accountOf(ctx)) && !grant.shareCode && !grant.tabScope && !grant.community;
}

type Ctx = Pick<
  KnowledgeRoute['ctx'],
  'accountUserId' | 'verifiedUserId' | 'token' | 'teams' | 'env'
>;

/** The rows a search found, kept to the items the reader can open (one index call). The index away: none, so a
 *  question is answered from pages rather than refused. */
async function reachable(
  ctx: Ctx,
  documentId: string,
  rows: readonly SourceSearchRow[],
): Promise<SourceSearchRow[]> {
  const personId = accountOf(ctx);
  const client = sourcesClientOf(ctx.env);
  if (!personId || !client || rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.itemId))];
  try {
    const { folderId } = await readSourceSettings(ctx.env);
    const open = new Set(
      await client.reach(
        documentId,
        { personId, teams: (ctx.teams ?? []).map((t) => t.id) },
        ids,
        folderId,
      ),
    );
    return rows.filter((r) => open.has(r.itemId) && isKnowledgeSourceApp(r.app));
  } catch (error) {
    console.warn('[knowledge] source reach failed', { documentId, error: String(error) });
    return [];
  }
}

/** The source chunks a question may send, best first. */
export async function askSourcePassages(
  ctx: Ctx,
  grant: Pick<DocumentAccess, 'shareCode' | 'tabScope' | 'community'>,
  documentId: string,
  question: string,
): Promise<FoundPassage[]> {
  if (!mayReadSources(ctx, grant)) return [];
  const search = askSourceSearch(question);
  if (!search) return [];
  const rows = await rowsOf<SourceSearchRow>(ctx.env, search);
  return (await reachable(ctx, documentId, rows)).map(foundSourcePassage);
}

/** What search_pages and the search panel list after the pages: the reader's own source hits. */
export async function searchSourceHits(
  ctx: Ctx,
  grant: Pick<DocumentAccess, 'shareCode' | 'tabScope' | 'community'>,
  documentId: string,
  query: string,
): Promise<KnowledgeSourceHit[]> {
  if (!mayReadSources(ctx, grant)) return [];
  const search = sourceSearch(query);
  if (!search) return [];
  const rows = await reachable(ctx, documentId, await rowsOf<SourceSearchRow>(ctx.env, search));
  return rows.map((row) => ({
    app: row.app as KnowledgeSourceHit['app'],
    itemId: row.itemId,
    itemName: row.itemName,
    title: row.title,
    place: placeOf(row.place),
    snippet: row.snippet,
    readAt: row.readAt ?? 0,
  }));
}

/** A stored place, read defensively: `{}` for anything unreadable (the item opens at its start). */
export function placeOf(text: string): AskSourceItem['place'] {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    const place: AskSourceItem['place'] = {};
    if (typeof value.tabId === 'string') place.tabId = value.tabId;
    if (typeof value.cardId === 'string') place.cardId = value.cardId;
    if (Array.isArray(value.elementIds))
      place.elementIds = value.elementIds.filter((id): id is string => typeof id === 'string');
    return place;
  } catch {
    return {};
  }
}

/** A cited passage's source, for the `done` event; undefined for a page. */
export function askSourceItemOf(passage: FoundPassage): AskSourceItem | undefined {
  const source = passage.source;
  if (!source || !isKnowledgeSourceApp(source.app)) return undefined;
  return {
    app: source.app,
    itemId: source.itemId,
    itemName: source.itemName,
    place: placeOf(source.place),
    readAt: source.readAt,
  };
}

/** Gaps a likely look is made for at most, after one answer. */
export const LIKELY_GAPS_MAX = 3;

/** After an answer left gaps (insights.md "Likely answered elsewhere"): for each, the first item the asker can open
 *  whose name holds its words and that is not a source yet, kept beside the question. One index call a gap, at most
 *  LIKELY_GAPS_MAX. The index away: nothing kept, the gap stands alone. */
export async function likelyWrites(
  ctx: Ctx,
  grant: Pick<DocumentAccess, 'shareCode' | 'tabScope' | 'community'>,
  documentId: string,
  gaps: readonly { key: string; question: string }[],
  now: number,
): Promise<SqlStatement[]> {
  const personId = accountOf(ctx);
  const client = sourcesClientOf(ctx.env);
  if (!personId || !client || !mayReadSources(ctx, grant) || gaps.length === 0) return [];
  const exclude = (await rowsOf<{ itemId: string }>(ctx.env, sourceIds()))
    .map((r) => r.itemId)
    .slice(0, KNOWLEDGE_SOURCES_MAX);
  const reader = { personId, teams: (ctx.teams ?? []).map((t) => t.id) };
  const writes: SqlStatement[] = [];
  for (const gap of gaps.slice(0, LIKELY_GAPS_MAX)) {
    const words = contentWords(gap.question).slice(0, KNOWLEDGE_LIKELY_WORDS_MAX);
    try {
      const [item] = await client.likely(documentId, reader, words, exclude);
      if (item && isKnowledgeSourceApp(item.app))
        writes.push(
          ...putQuestionLikely(
            gap.key,
            { app: item.app, itemId: item.itemId, title: item.title },
            now,
          ),
        );
    } catch (error) {
      console.warn('[knowledge] likely look failed', { documentId, error: String(error) });
      break;
    }
  }
  return writes;
}

/** Each question's likely item, for Insights, kept to those this reader can open (one index call). A guest, a link
 *  reader or the index away: none. */
export async function likelyForReader(
  ctx: Ctx,
  grant: Pick<DocumentAccess, 'shareCode' | 'tabScope' | 'community'>,
  documentId: string,
  keys: readonly string[],
): Promise<Map<string, KnowledgeLikelySource>> {
  const personId = accountOf(ctx);
  const client = sourcesClientOf(ctx.env);
  const found = new Map<string, KnowledgeLikelySource>();
  if (!personId || !client || !mayReadSources(ctx, grant)) return found;
  const read = readQuestionLikely(keys);
  if (!read) return found;
  const rows = await rowsOf<QuestionLikelyRow>(ctx.env, read);
  if (rows.length === 0) return found;
  try {
    const { folderId } = await readSourceSettings(ctx.env);
    const open = new Set(
      await client.reach(
        documentId,
        { personId, teams: (ctx.teams ?? []).map((t) => t.id) },
        [...new Set(rows.map((r) => r.itemId))],
        folderId,
      ),
    );
    for (const row of rows)
      if (open.has(row.itemId) && isKnowledgeSourceApp(row.app))
        found.set(row.key, { app: row.app, itemId: row.itemId, title: row.title });
  } catch (error) {
    console.warn('[knowledge] likely reach failed', { documentId, error: String(error) });
  }
  return found;
}
