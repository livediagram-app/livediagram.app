// What a source card says under its passage (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows"):
// where the page sits and who verified it when, or that it is due or was never verified.
import type { KnowledgeTrustState } from '@liveknowledge/api-schema';
import { pageAncestors } from '@liveknowledge/document';
import { shortDate } from '@/lib/knowledge/page-trust';

type TreePage = { id: string; name: string; parent?: string };

/** "Engineering / Release Process": the page's ancestors and the page, or the title alone for a page that has gone. */
export function pagePathText(pages: readonly TreePage[], tab: string, title: string): string {
  const page = pages.find((p) => p.id === tab);
  if (!page) return title;
  return [...pageAncestors(pages, tab).map((p) => p.name), page.name].join(' / ');
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
