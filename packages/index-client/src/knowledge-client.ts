// The index's knowledge-source routes as liveknowledge's server calls them, with its INDEX_KEY
// (liveworkspace/docs/specs/004-index/knowledge-sources.md "The index's routes"): a knowledgebase's sources, one
// source's text, which sources a reader can open, and what an unanswered question was likely answered in.

import { INDEX_API_PATH, INDEX_APP_HEADER } from './constants';
import type { IndexAppClientOptions } from './app-client';
import { IndexError, refusal } from './index-error';
import {
  isKnowledgeText,
  type KnowledgeLikelyItem,
  type KnowledgeSourceListing,
  type KnowledgeText,
} from './knowledge-sources';
import { withoutTrailingSlashes } from '@liveworkspace/api-schema/url-slashes';

// Who a reach or a likely look is for: the account liveknowledge verified, and the teams their token named.
export type KnowledgeReader = { personId: string; teams: readonly string[] };

export type KnowledgeSourcesClient = {
  sources(kb: string, folderId: string | null): Promise<KnowledgeSourceListing[]>;
  // The source's text, or null when it is no longer a source (or gone).
  text(kb: string, itemId: string, folderId: string | null): Promise<KnowledgeText | null>;
  reach(
    kb: string,
    reader: KnowledgeReader,
    itemIds: readonly string[],
    folderId: string | null,
  ): Promise<string[]>;
  likely(
    kb: string,
    reader: KnowledgeReader,
    words: readonly string[],
    exclude: readonly string[],
  ): Promise<KnowledgeLikelyItem[]>;
};

export function createKnowledgeSourcesClient({
  app,
  key,
  baseUrl,
  fetch: doFetch,
}: IndexAppClientOptions): KnowledgeSourcesClient {
  const base = withoutTrailingSlashes(baseUrl || `https://www.liveworkspace.app${INDEX_API_PATH}`);
  // A POST to `/app/items/:kb/<route>`: the answer's JSON, null for a 404, an IndexError for anything else.
  async function post(
    kb: string,
    route: string,
    body: unknown,
  ): Promise<Record<string, unknown> | null> {
    const res = await (doFetch ?? fetch)(`${base}/app/items/${encodeURIComponent(kb)}/${route}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        [INDEX_APP_HEADER]: app,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.status === 404) {
      await res.body?.cancel();
      return null;
    }
    const answer = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) throw refusal(res, answer);
    if (!answer || typeof answer !== 'object') throw new IndexError(res.status, 'invalid_answer');
    return answer;
  }
  const listOf = <T>(answer: Record<string, unknown> | null, field: string): T[] =>
    Array.isArray(answer?.[field]) ? (answer[field] as T[]) : [];

  return {
    async sources(kb, folderId) {
      return listOf(await post(kb, 'knowledge-sources', { folderId }), 'sources');
    },
    async text(kb, itemId, folderId) {
      const answer = await post(kb, 'knowledge-text', { itemId, folderId });
      return answer && isKnowledgeText(answer) ? answer : null;
    },
    async reach(kb, reader, itemIds, folderId) {
      if (itemIds.length === 0) return [];
      const answer = await post(kb, 'knowledge-reach', { ...reader, itemIds, folderId });
      return listOf<unknown>(answer, 'itemIds').filter(
        (id): id is string => typeof id === 'string',
      );
    },
    async likely(kb, reader, words, exclude) {
      if (words.length === 0) return [];
      return listOf(await post(kb, 'knowledge-likely', { ...reader, words, exclude }), 'items');
    },
  };
}
