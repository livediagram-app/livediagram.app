// The trust fields every page and passage answer carries (docs/specs/024-agents/knowledgebase-for-agents.md), from
// the api's: the state under `verified`, dates as ISO timestamps a model reads without arithmetic, `stale` for a
// review that is due (under the knowledgebase's one Review Period, which the api works the dates out from), and
// the pages an open conflict names. The MCP's tools and the CLI's commands answer the same
// fields, so an agent reads a page the same way through either door.
import {
  isKnowledgePageRow,
  type KnowledgePageRef,
  type KnowledgePageTrust,
  type KnowledgeReviewEvery,
  type KnowledgeSearchResult,
  type KnowledgeTreeRow,
} from '@liveknowledge/api-schema';

/** The knowledgebase's Review Period as an answer states it, once: how long after it was last verified a page
 *  comes due for review. One period for every page; `never` is a knowledgebase whose pages do not come due. */
export const REVIEW_PERIODS = ['30 days', '90 days', '180 days', '365 days', 'never'] as const;
export type ReviewPeriod = (typeof REVIEW_PERIODS)[number];
/** An api that does not say (one from before the period was the knowledgebase's) reads as the default. */
export function reviewPeriodOf(every: KnowledgeReviewEvery | undefined): ReviewPeriod {
  const period = every === 'never' ? 'never' : `${every ?? 90} days`;
  return (REVIEW_PERIODS as readonly string[]).includes(period)
    ? (period as ReviewPeriod)
    : '90 days';
}

/** The period as one phrase of a listing's first line: "reviews every 90 days", "no review period". */
export const reviewPeriodLine = (period: ReviewPeriod): string =>
  period === 'never' ? 'no review period' : `reviews every ${period}`;

export type TrustFields = {
  verified: KnowledgePageTrust['state'];
  verified_at?: string;
  verified_by?: string;
  review_due?: string;
  stale: boolean;
  conflicts_with?: { page: string; title: string }[];
  /** Approval (docs/specs/030-knowledgebase/approval.md): absent for a page never asked about. */
  approval?: 'pending' | 'approved' | 'rejected';
  approval_requested_at?: string;
  approval_note?: string;
};

const iso = (ms: number) => new Date(ms).toISOString();

/** A page as every answer names it: its id under `page`, beside its title. */
export const pageRefOf = (p: KnowledgePageRef) => ({ page: p.tab, title: p.title });

export function trustFieldsOf(trust: KnowledgePageTrust): TrustFields {
  return {
    verified: trust.state,
    ...(trust.verifiedAt === undefined ? {} : { verified_at: iso(trust.verifiedAt) }),
    ...(trust.verifiedBy ? { verified_by: trust.verifiedBy } : {}),
    ...(trust.reviewAt === undefined ? {} : { review_due: iso(trust.reviewAt) }),
    stale: trust.stale,
    ...(trust.conflictsWith?.length ? { conflicts_with: trust.conflictsWith.map(pageRefOf) } : {}),
    ...(trust.approval
      ? {
          approval: trust.approval.state,
          approval_requested_at: iso(trust.approval.requestedAt),
          ...(trust.approval.note ? { approval_note: trust.approval.note } : {}),
        }
      : {}),
  };
}

/** One row of `list_pages` (and the CLI's `pages`): a page with its trust, or a connected file in the tree
 *  (links-and-embeds.md "Connected files in the sidebar"), which is no page and carries no trust. */
export type TreeRowFields =
  | ({
      page: string;
      title: string;
      depth: number;
      parent?: string;
      subpages: number;
      owner?: string;
      always_in_context?: true;
    } & TrustFields)
  | {
      page: string;
      title: string;
      kind: 'connected';
      app: string;
      depth: number;
      parent?: string;
      subpages: 0;
    };

export function treeRowOf(row: KnowledgeTreeRow): TreeRowFields {
  const place = {
    ...pageRefOf(row),
    depth: row.depth,
    ...(row.parent ? { parent: row.parent } : {}),
  };
  if (!isKnowledgePageRow(row)) return { ...place, kind: 'connected', app: row.app, subpages: 0 };
  return {
    ...place,
    subpages: row.subpages,
    ...(row.owner ? { owner: row.owner } : {}),
    ...(row.context ? { always_in_context: true as const } : {}),
    ...trustFieldsOf(row.trust),
  };
}

/** A tree row as one line of a listing: a page's trust, or "connected <app> file, not a page". */
export const treeRowLine = (row: TreeRowFields): string =>
  'kind' in row
    ? `connected ${row.app} file, not a page`
    : trustLine(row) + (row.always_in_context ? ', always in context' : '');

/** A search result's trust: its page's state, and the pages its own passage conflicts with. */
export const resultTrustOf = (result: KnowledgeSearchResult): TrustFields =>
  trustFieldsOf({
    state: result.trust,
    ...(result.verifiedAt === undefined ? {} : { verifiedAt: result.verifiedAt }),
    ...(result.reviewAt === undefined ? {} : { reviewAt: result.reviewAt }),
    stale: result.trust === 'review-due',
    ...(result.conflictsWith ? { conflictsWith: result.conflictsWith } : {}),
  });

const day = (isoDate: string) => isoDate.slice(0, 10);

/** The trust fields as one line of a listing: "verified 2026-10-01 by Webber, review due 2026-12-30". */
export function trustLine(trust: TrustFields): string {
  const parts =
    trust.verified === 'never-verified'
      ? ['never verified']
      : [
          `${trust.stale ? 'REVIEW DUE, last verified' : 'verified'} ${day(trust.verified_at!)}` +
            (trust.verified_by ? ` by ${trust.verified_by}` : ''),
          ...(trust.review_due && !trust.stale ? [`review due ${day(trust.review_due)}`] : []),
        ];
  if (trust.conflicts_with?.length)
    parts.push(`CONFLICTS WITH ${trust.conflicts_with.map((p) => `"${p.title}"`).join(', ')}`);
  if (trust.approval === 'pending') parts.push('PENDING APPROVAL');
  if (trust.approval === 'rejected')
    parts.push(`REJECTED${trust.approval_note ? `: ${trust.approval_note}` : ''}`);
  return parts.join(', ');
}
