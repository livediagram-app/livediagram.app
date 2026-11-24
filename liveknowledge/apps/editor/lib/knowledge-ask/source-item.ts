// A cited item of another app (docs/specs/030-knowledgebase/search-and-ask.md "Sources", "What an answer shows"): its
// chip's words, the address that opens it at the cited place with the Cited by Ask bar, and its "as of" line.
import type { AskSource, AskSourceItem } from '@liveknowledge/api-schema';
import { knowledgePlaceHash } from '@liveworkspace/index-client';
import { APP_ITEMS, siteOfApp } from '@liveworkspace/sites';
import { SOURCE_STALE_DAYS } from '@liveknowledge/knowledge';
import { shortDate } from '@/lib/knowledge/page-trust';

const DAY_MS = 86_400_000;

/** A chip's title: a page's own, or "Checkout Flow (livediagram)" for an item of another app. */
export function citationTitle(source: Pick<AskSource, 'title' | 'source'>): string {
  return source.source
    ? `${source.source.itemName || 'Untitled'} (${source.source.app})`
    : source.title;
}

/** Where a cited item opens: its app's editor at the place, the question and this knowledgebase in the fragment for
 *  the Cited by Ask bar (`origin` the app's, for tests). */
export function sourceHref(
  item: Pick<AskSourceItem, 'app' | 'itemId' | 'place'>,
  question: string,
  knowledgebaseId: string,
  origin: string = siteOfApp(item.app).url,
): string {
  return `${origin}${APP_ITEMS[item.app].itemPath}${encodeURIComponent(item.itemId)}${knowledgePlaceHash(
    item.place,
    { question, from: knowledgebaseId },
  )}`;
}

/** "As of 21 Nov": the day the knowledgebase last read the item; `stale` once SOURCE_STALE_DAYS have passed. */
export function sourceAsOf(readAt: number, now: number): { words: string; stale: boolean } {
  if (!readAt) return { words: 'Not read yet', stale: true };
  return {
    words: `As of ${shortDate(readAt, now)}`,
    stale: now - readAt > SOURCE_STALE_DAYS * DAY_MS,
  };
}
