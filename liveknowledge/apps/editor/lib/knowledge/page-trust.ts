// A page's verified state as the editor shows it (docs/specs/030-knowledgebase/verification.md "States"): worked
// out when read, from the page's knowledge fields, its knowledgebase's Review Period and the clock, by the
// engine's own `trustState`. Pure.
import {
  parseKnowledgeFields,
  trustState,
  type KnowledgeFields,
  type ReviewEvery,
  type TrustStateName,
} from '@liveknowledge/knowledge';

export type PageTrust = {
  state: TrustStateName;
  fields: KnowledgeFields;
  /** When the review comes, or came, due; absent for a page never verified, and under a period of Never. */
  reviewAt?: number;
};

/** `every` is the knowledgebase's Review Period (lib/knowledge-settings/knowledge-settings-store.ts). */
export function pageTrust(knowledge: unknown, every: ReviewEvery, now: number): PageTrust {
  const fields = parseKnowledgeFields(knowledge);
  const trust = trustState(fields, every, now);
  return {
    state: trust.state,
    fields,
    ...('reviewAt' in trust && trust.reviewAt !== undefined ? { reviewAt: trust.reviewAt } : {}),
  };
}

/** What a row or a link shows of a page: a tick, a pill, or nothing for a page never verified. */
export type TrustMark = 'verified' | 'review-due';
export const trustMark = (state: TrustStateName): TrustMark | undefined =>
  state === 'never-verified' ? undefined : state;

/** The marks of every page that has one, from the tab list alone (the summaries carry each page's fields): one
 *  pass, no request. */
export function trustMarks(
  pages: readonly { id: string; knowledge?: unknown }[],
  every: ReviewEvery,
  now: number,
  fieldsOf: (page: { id: string; knowledge?: unknown }) => unknown = (page) => page.knowledge,
): ReadonlyMap<string, TrustMark> {
  const marks = new Map<string, TrustMark>();
  for (const page of pages) {
    const fields = fieldsOf(page);
    if (fields === undefined) continue;
    const mark = trustMark(pageTrust(fields, every, now).state);
    if (mark) marks.set(page.id, mark);
  }
  return marks;
}

const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "14 Jan", with the year when it is not this one. */
export function shortDate(at: number, now: number): string {
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return (sameYear ? dayMonth : dayMonthYear).format(at);
}

/** "Review due 14 Jan", or "Review was due 14 Jan" once it has passed. */
export function reviewDueText(reviewAt: number, now: number): string {
  return `Review ${reviewAt <= now ? 'was due' : 'due'} ${shortDate(reviewAt, now)}`;
}
