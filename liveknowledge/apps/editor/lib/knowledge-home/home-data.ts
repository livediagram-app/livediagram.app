// What the Knowledgebase Home shows of the person's knowledgebases (docs/specs/030-knowledgebase/
// knowledgebase-home.md): which ones, each one's summary, the pages changed last, and a search across them. Pure but
// for `summaryCache`, which keeps a summary for a minute so going back to Home asks for nothing twice.
import type {
  KnowledgeHealthCounts,
  KnowledgeSearchResult,
  KnowledgeSummaryResponse,
} from '@liveknowledge/api-schema';

/** Knowledgebases Home reads and shows; the rest are a press away in the Explorer. */
export const HOME_KNOWLEDGEBASES_MAX = 12;
/** How long a summary read is kept (the route's own `max-age`). */
export const HOME_SUMMARY_TTL_MS = 60_000;
export const HOME_RECENT_PAGES = 8;
/** Results the hero's field shows. */
export const HOME_SEARCH_RESULTS = 12;

export type HomeKnowledgebase = { id: string; name: string; at: number };

type Listed = {
  id: string;
  title: string;
  updatedAt: number;
  lastOpenedAt: number | null;
  trashedAt: number | null;
  archivedAt?: number | null;
};

/** The person's knowledgebases, most recent first (opened or changed, whichever is later), twelve at most, and how
 *  many there are in all. One in the Trash or Archived is not listed. */
export function homeKnowledgebases(items: readonly Listed[]): {
  shown: HomeKnowledgebase[];
  total: number;
} {
  const live = items
    .filter((item) => item.trashedAt === null && !item.archivedAt)
    .map((item) => ({
      id: item.id,
      name: item.title.trim() || 'Untitled Knowledgebase',
      at: Math.max(item.updatedAt, item.lastOpenedAt ?? 0),
    }))
    .sort((a, b) => b.at - a.at);
  return { shown: live.slice(0, HOME_KNOWLEDGEBASES_MAX), total: live.length };
}

/** The share of pages verified and not due, as a whole percent; null for a knowledgebase with no pages. */
export function verifiedPercent(health: KnowledgeHealthCounts): number | null {
  return health.total > 0 ? Math.round((health.verified / health.total) * 100) : null;
}

export const pagesText = (pages: number): string =>
  `${pages.toLocaleString('en')} ${pages === 1 ? 'page' : 'pages'}`;

export type HomeRecentPage = {
  documentId: string;
  knowledgebase: string;
  tab: string;
  title: string;
  updatedAt: number;
};

/** The eight pages changed last across the knowledgebases whose summary has been read. */
export function recentPagesAcross(
  knowledgebases: readonly HomeKnowledgebase[],
  summaries: ReadonlyMap<string, KnowledgeSummaryResponse>,
): HomeRecentPage[] {
  const pages: HomeRecentPage[] = [];
  for (const knowledgebase of knowledgebases)
    for (const page of summaries.get(knowledgebase.id)?.recent ?? [])
      pages.push({
        documentId: knowledgebase.id,
        knowledgebase: knowledgebase.name,
        tab: page.tab,
        title: page.title,
        updatedAt: page.updatedAt,
      });
  return pages.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, HOME_RECENT_PAGES);
}

export type HomeSearchResult = KnowledgeSearchResult & {
  documentId: string;
  knowledgebase: string;
};

/** One list from each knowledgebase's own ranked results: every knowledgebase's best first, then each one's second,
 *  and so on, title matches ahead of passages at each rank. The routes share no score, so rank is the common ground. */
export function mergeSearchResults(
  found: readonly { knowledgebase: HomeKnowledgebase; results: readonly KnowledgeSearchResult[] }[],
  max: number = HOME_SEARCH_RESULTS,
): HomeSearchResult[] {
  const merged: HomeSearchResult[] = [];
  const longest = Math.max(0, ...found.map((one) => one.results.length));
  for (let rank = 0; rank < longest && merged.length < max; rank++) {
    const row = found.flatMap(({ knowledgebase, results }) => {
      const result = results[rank];
      return result
        ? [{ ...result, documentId: knowledgebase.id, knowledgebase: knowledgebase.name }]
        : [];
    });
    row.sort((a, b) => Number(b.isTitle) - Number(a.isTitle));
    merged.push(...row.slice(0, max - merged.length));
  }
  return merged;
}

type Cached = { at: number; summary: Promise<KnowledgeSummaryResponse> };

/** Summaries by knowledgebase, each kept `HOME_SUMMARY_TTL_MS`; a failed read is not kept. */
export function createSummaryCache(
  read: (documentId: string) => Promise<KnowledgeSummaryResponse>,
  now: () => number = Date.now,
) {
  const held = new Map<string, Cached>();
  return {
    get(documentId: string): Promise<KnowledgeSummaryResponse> {
      const cached = held.get(documentId);
      if (cached && now() - cached.at < HOME_SUMMARY_TTL_MS) return cached.summary;
      const summary = read(documentId);
      held.set(documentId, { at: now(), summary });
      summary.catch(() => {
        if (held.get(documentId)?.summary === summary) held.delete(documentId);
      });
      return summary;
    },
    clear: () => held.clear(),
  };
}

/** A person's first name from the name on their account: its first word, or nothing when there is none. */
export function firstNameOf(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? '';
}
