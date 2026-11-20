// The trust fields every page and passage answer carries (docs/specs/024-agents/knowledgebase-for-agents.md), from
// the api's: the state under `verified`, dates as ISO timestamps a model reads without arithmetic, `stale` for a
// review that is due, and the pages an open conflict names.
import type {
  KnowledgePageRef,
  KnowledgePageTrust,
  KnowledgeSearchResult,
} from '@liveknowledge/api-schema';

export type TrustFields = {
  verified: KnowledgePageTrust['state'];
  verified_at?: string;
  verified_by?: string;
  review_due?: string;
  stale: boolean;
  conflicts_with?: { page: string; title: string }[];
};

const iso = (ms: number) => new Date(ms).toISOString();
const refs = (pages: readonly KnowledgePageRef[]) =>
  pages.map((p) => ({ page: p.tab, title: p.title }));

export function trustFieldsOf(trust: KnowledgePageTrust): TrustFields {
  return {
    verified: trust.state,
    ...(trust.verifiedAt === undefined ? {} : { verified_at: iso(trust.verifiedAt) }),
    ...(trust.verifiedBy ? { verified_by: trust.verifiedBy } : {}),
    ...(trust.reviewAt === undefined ? {} : { review_due: iso(trust.reviewAt) }),
    stale: trust.stale,
    ...(trust.conflictsWith?.length ? { conflicts_with: refs(trust.conflictsWith) } : {}),
  };
}

/** A search result's trust: its page's state, and the pages its own passage conflicts with. */
export const resultTrustOf = (result: KnowledgeSearchResult): TrustFields =>
  trustFieldsOf({
    state: result.trust,
    ...(result.verifiedAt === undefined ? {} : { verifiedAt: result.verifiedAt }),
    ...(result.reviewAt === undefined ? {} : { reviewAt: result.reviewAt }),
    stale: result.trust === 'review-due',
    ...(result.conflictsWith ? { conflictsWith: result.conflictsWith } : {}),
  });
