// What a source card says under its passage (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows"):
// where the page sits and who verified it when, or that it is due or was never verified.
import type { KnowledgeTrustState } from '@liveknowledge/api-schema';
import { pageAncestors } from '@liveknowledge/document';
import { shortDate } from '@/lib/knowledge/page-trust';

type TreePage = { id: string; name: string; parent?: string };

/** "Engineering / Release Process": the page's ancestors and the page, or the title alone for a page that has gone. */
export function pagePathText(pages: readonly TreePage[], tab: string, title: string): string {
  const { parents, name } = pagePath(pages, tab, title);
  return [...parents, name].join(' / ');
}

/** The page's ancestors' names and its own, for a breadcrumb that shortens the parents and never the page. */
export function pagePath(
  pages: readonly TreePage[],
  tab: string,
  title: string,
): { parents: string[]; name: string } {
  const page = pages.find((p) => p.id === tab);
  if (!page) return { parents: [], name: title };
  return { parents: pageAncestors(pages, tab).map((p) => p.name), name: page.name };
}

/** A source's trust as its card shows it (search-and-ask.md "The Ask view"): the badge, then the words beside it,
 *  each a piece that wraps whole ("21 Nov", "by Roger Blake"), never cut mid-name. */
export type SourceTrust = {
  mark: 'verified' | 'review-due' | 'never';
  label: string;
  pieces: string[];
};

export function sourceTrust(
  trust: KnowledgeTrustState,
  verifiedAt: number | undefined,
  verifier: string | undefined,
  now: number,
): SourceTrust {
  const when = verifiedAt === undefined ? [] : [shortDate(verifiedAt, now)];
  if (trust === 'verified')
    return {
      mark: 'verified',
      label: 'Verified',
      pieces: [...when, ...(verifier ? [`by ${verifier}`] : [])],
    };
  if (trust === 'review-due')
    return {
      mark: 'review-due',
      label: 'Review Due',
      pieces: when.length ? [`Last verified ${when[0]}`] : [],
    };
  return { mark: 'never', label: 'Never Verified', pieces: [] };
}

/** "Verified 8 Nov by Priya Nair", "Review Due, Last Verified 8 Nov", "Never Verified". */
export function trustText(
  trust: KnowledgeTrustState,
  verifiedAt: number | undefined,
  verifier: string | undefined,
  now: number,
): string {
  const when = verifiedAt === undefined ? '' : ` ${shortDate(verifiedAt, now)}`;
  if (trust === 'verified') return `Verified${when}${verifier ? ` by ${verifier}` : ''}`;
  if (trust === 'review-due') return when ? `Review Due, Last Verified${when}` : 'Review Due';
  return 'Never Verified';
}
