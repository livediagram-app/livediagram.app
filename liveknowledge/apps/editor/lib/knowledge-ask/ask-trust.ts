// An answer's trust line (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows"): how many of the
// pages it cites are verified, and how many are due a review or were never verified. Pages, not passages: two
// passages of one page count once.
import type { AskSource } from '@liveknowledge/api-schema';

export type AnswerTrust = {
  verified: number;
  reviewDue: number;
  neverVerified: number;
  /** "Answered From 3 Verified Pages"; "Answered From 2 Pages" when none is verified. */
  pill: string;
  /** Every cited page is verified. */
  solid: boolean;
  /** "1 page is due a review and 2 were never verified.", or nothing when all are verified. */
  rest: string;
  /** Items of other apps cited (search-and-ask.md "Sources"); absent with none. */
  items?: number;
};

const pages = (n: number) => (n === 1 ? '1 Page' : `${n} Pages`);
const items = (n: number) => (n === 1 ? '1 Connected Item' : `${n} Connected Items`);

/** The items of other apps an answer cites (search-and-ask.md "Sources"): counted apart from the pages, each once,
 *  never verified here. "and 2 Connected Items" after the pages' pill, or the pill itself with no page. */
function withItems(trust: AnswerTrust | null, count: number): AnswerTrust | null {
  if (count === 0) return trust;
  if (!trust)
    return {
      verified: 0,
      reviewDue: 0,
      neverVerified: 0,
      items: count,
      pill: `Answered From ${items(count)}`,
      solid: false,
      rest: count === 1 ? 'Nobody has verified it here.' : 'Nobody has verified them here.',
    };
  return { ...trust, items: count, pill: `${trust.pill} and ${items(count)}`, solid: false };
}

export function answerTrust(
  sources: readonly Pick<AskSource, 'tab' | 'trust' | 'source'>[],
): AnswerTrust | null {
  const itemCount = new Set(sources.flatMap((s) => (s.source ? [s.source.itemId] : []))).size;
  return withItems(pageTrust(sources.filter((s) => !s.source)), itemCount);
}

function pageTrust(sources: readonly Pick<AskSource, 'tab' | 'trust'>[]): AnswerTrust | null {
  const byPage = new Map(sources.map((source) => [source.tab, source.trust]));
  // Verification off (a Review Period of Never): the answer says nothing of it (search-and-ask.md).
  if (byPage.size === 0 || [...byPage.values()].every((trust) => trust === 'off')) return null;
  let verified = 0;
  let reviewDue = 0;
  let neverVerified = 0;
  for (const trust of byPage.values()) {
    if (trust === 'verified') verified++;
    else if (trust === 'review-due') reviewDue++;
    else neverVerified++;
  }
  const others: string[] = [];
  if (reviewDue) others.push(`${reviewDue} ${reviewDue === 1 ? 'is' : 'are'} due a review`);
  if (neverVerified)
    others.push(`${neverVerified} ${neverVerified === 1 ? 'was' : 'were'} never verified`);
  const rest =
    others.length === 0
      ? ''
      : verified === 0 && others.length === 1 && byPage.size === 1
        ? reviewDue
          ? 'It is due a review.'
          : 'It was never verified.'
        : `${verified ? 'Of the others, ' : ''}${others.join(' and ')}.`;
  return {
    verified,
    reviewDue,
    neverVerified,
    pill: verified
      ? `Answered From ${verified} Verified ${verified === 1 ? 'Page' : 'Pages'}`
      : `Answered From ${pages(byPage.size)}`,
    solid: verified === byPage.size,
    rest,
  };
}
